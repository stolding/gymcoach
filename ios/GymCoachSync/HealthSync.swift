import Foundation
import HealthKit
import Network

/// Houdt bij of de iPhone op wifi zit (voor "alleen thuis synchroniseren").
final class NetWatch: @unchecked Sendable {
    static let shared = NetWatch()
    private let monitor = NWPathMonitor()
    private(set) var onWifi = false
    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.onWifi = path.status == .satisfied && path.usesInterfaceType(.wifi)
        }
        monitor.start(queue: DispatchQueue(label: "netwatch"))
    }
}

/// Fouten met een Nederlandse uitleg voor in de app.
enum SyncError: LocalizedError {
    case noHealth, badURL, noToken, server(Int, String)
    var errorDescription: String? {
        switch self {
        case .noHealth: return "Apple Health is niet beschikbaar op dit toestel."
        case .badURL: return "Ongeldig serveradres. Voorbeeld: http://192.168.1.50:8765"
        case .noToken: return "Vul eerst de koppelsleutel uit GymCoach in."
        case let .server(code, msg): return "Server antwoordde \(code): \(msg)"
        }
    }
}

/// Leest precies wat GymCoach nodig heeft uit Apple Health en stuurt het naar /api/health/ingest.
/// Formaat is gelijk aan dat van Health Auto Export, zodat de server één ontvanger heeft.
@MainActor
final class SyncModel: ObservableObject {
    static let shared = SyncModel()
    let store = HKHealthStore()

    @Published var serverURL: String = UserDefaults.standard.string(forKey: "serverURL") ?? "" {
        didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") }
    }
    @Published var token: String = Keychain.get("token") ?? "" {
        didSet { Keychain.set(token.trimmingCharacters(in: .whitespacesAndNewlines), for: "token") }
    }
    @Published var busy = false
    @Published var message = ""
    @Published var lastSync: Date? = UserDefaults.standard.object(forKey: "lastSync") as? Date
    @Published var lastResult: String = UserDefaults.standard.string(forKey: "lastResult") ?? ""
    /// Automatisch alleen thuis: op wifi én de server reageert binnen een paar seconden.
    @Published var homeOnly: Bool = UserDefaults.standard.object(forKey: "homeOnly") as? Bool ?? true {
        didSet { UserDefaults.standard.set(homeOnly, forKey: "homeOnly") }
    }
    @Published var autoNote: String = ""
    static let autoInterval: TimeInterval = 3600  // hooguit één automatische sync per uur

    private var observing = false

    var isConfigured: Bool { !serverURL.isEmpty && !token.isEmpty }

    // MARK: toegang

    private var readTypes: Set<HKObjectType> {
        [
            HKObjectType.workoutType(),
            HKQuantityType(.stepCount),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.distanceCycling),
            HKQuantityType(.distanceSwimming),
            HKQuantityType(.heartRate),
            HKQuantityType(.restingHeartRate),
        ]
    }

    /// Vraagt toestemming om de benodigde Health-gegevens te lezen.
    func requestAccess() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw SyncError.noHealth }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    /// Nieuwe trainingen op de achtergrond doorsturen (Apple Watch-workout klaar → sync).
    func startBackgroundDelivery() {
        guard !observing, isConfigured else { return }
        observing = true
        let type = HKObjectType.workoutType()
        let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, _ in
            Task { @MainActor in
                await SyncModel.shared.autoSync()
                completion()
            }
        }
        store.execute(query)
        // iOS wekt de app hooguit eens per uur voor nieuwe workouts
        store.enableBackgroundDelivery(for: type, frequency: .hourly) { _, _ in }
    }

    /// Automatische sync: hooguit eens per uur, en (standaard) alleen thuis.
    func autoSync() async {
        guard isConfigured, !busy else { return }
        if let last = lastSync, Date().timeIntervalSince(last) < Self.autoInterval {
            autoNote = "Volgende automatische sync na \(last.addingTimeInterval(Self.autoInterval).formatted(date: .omitted, time: .shortened))"
            return
        }
        if homeOnly {
            if !NetWatch.shared.onWifi { try? await Task.sleep(nanoseconds: 700_000_000) } // netwerkstatus is net na de start soms nog onbekend
            guard NetWatch.shared.onWifi else { autoNote = "Niet op wifi: automatische sync overgeslagen"; return }
            guard await serverReachable() else { autoNote = "Server niet bereikbaar (niet thuis?): overgeslagen"; return }
        }
        await sync(full: false, quiet: true)
        autoNote = ""
    }

    /// Snelle controle of de GymCoach-server bereikbaar is (max. 3 seconden).
    func serverReachable() async -> Bool {
        guard var url = try? endpoint() else { return false }
        url.deleteLastPathComponent(); url.deleteLastPathComponent(); url.deleteLastPathComponent()
        url.appendPathComponent("api/auth/status")
        var req = URLRequest(url: url)
        req.timeoutInterval = 3
        guard let result = try? await URLSession.shared.data(for: req) else { return false }
        return (result.1 as? HTTPURLResponse) != nil
    }

    // MARK: synchroniseren

    func testConnection() async {
        busy = true; defer { busy = false }
        do {
            let empty: [String: Any] = ["workouts": [[String: Any]](), "metrics": [[String: Any]]()]
            let r = try await post(["data": empty])
            message = (r["ok"] as? Bool) == true ? "Verbinding in orde ✓" : "Onverwacht antwoord van de server"
        } catch { message = error.localizedDescription }
    }

    /// Stuurt workouts en dagwaarden sinds de laatste sync (of de volledige historie) naar de server.
    func sync(full: Bool, quiet: Bool = false) async {
        guard !busy else { return }
        guard isConfigured else { if !quiet { message = SyncError.noToken.localizedDescription }; return }
        busy = true; defer { busy = false }
        if !quiet { message = full ? "Volledige historie ophalen…" : "Synchroniseren…" }
        do {
            try await requestAccess()
            let cal = Calendar.current
            let now = Date()
            // workouts: alles (volledig) of vanaf de vorige sync met een marge van 3 dagen
            let workoutSince: Date = full ? cal.date(byAdding: .year, value: -15, to: now)!
                : min(cal.date(byAdding: .day, value: -3, to: lastSync ?? now)!, cal.date(byAdding: .day, value: -30, to: now)!)
            // dagwaarden: hele dagen opnieuw sturen, de server vervangt ze per dag
            let daysSince: Date = full ? cal.date(byAdding: .year, value: -3, to: now)!
                : cal.date(byAdding: .day, value: -7, to: cal.startOfDay(for: lastSync ?? now))!

            let workouts = try await fetchWorkouts(since: workoutSince)
            let metrics = try await fetchDaily(since: daysSince)

            var acts = 0, linked = 0, days = 0
            // in porties, zodat ook jaren historie probleemloos doorkomen
            let chunk = 150
            var i = 0
            repeat {
                let part = Array(workouts[i..<min(i + chunk, workouts.count)])
                let payload: [String: Any] = ["workouts": part, "metrics": i == 0 ? metrics : [[String: Any]]()]
                let body: [String: Any] = ["data": payload]
                let r = try await post(body)
                acts += r["activities"] as? Int ?? 0
                linked += r["linked"] as? Int ?? 0
                days += r["days"] as? Int ?? 0
                i += chunk
                if !quiet && workouts.count > chunk { message = "Versturen… \(min(i, workouts.count)) van \(workouts.count)" }
            } while i < workouts.count

            lastSync = now
            UserDefaults.standard.set(now, forKey: "lastSync")
            lastResult = "\(acts) activiteiten · \(days) dagen" + (linked > 0 ? " · hartslag bij \(linked) Gym Monster-trainingen" : "")
            UserDefaults.standard.set(lastResult, forKey: "lastResult")
            if !quiet { message = "Klaar ✓" }
            startBackgroundDelivery()
        } catch {
            if !quiet { message = error.localizedDescription }
        }
    }

    // MARK: Apple Health uitlezen

    private static let dateFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd HH:mm:ss Z"
        return f
    }()
    /// Datum als ISO 8601-tekst.
    private func fmt(_ d: Date) -> String { Self.dateFormat.string(from: d) }

    /// Workouts sinds een datum, met afstand, energie, hartslag en hartslagverloop.
    private func fetchWorkouts(since: Date) async throws -> [[String: Any]] {
        let pred = HKQuery.predicateForSamples(withStart: since, end: nil)
        let descriptor = HKSampleQueryDescriptor(predicates: [.workout(pred)], sortDescriptors: [SortDescriptor(\.startDate, order: .forward)])
        let workouts = try await descriptor.result(for: store)
        var result: [[String: Any]] = []
        for w in workouts {
            var o: [String: Any] = [
                "id": w.uuid.uuidString,
                "name": Self.activityName(w.workoutActivityType),
                "start": fmt(w.startDate),
                "end": fmt(w.endDate),
                "duration": w.duration,
                "source": "\(w.sourceRevision.source.name) (\(w.sourceRevision.source.bundleIdentifier))",
            ]
            let km = Self.sum(w, .distanceWalkingRunning, .meterUnit(with: .kilo))
                ?? Self.sum(w, .distanceCycling, .meterUnit(with: .kilo))
                ?? Self.sum(w, .distanceSwimming, .meterUnit(with: .kilo))
            if let km { o["distance"] = ["qty": km, "units": "km"] as [String: Any] }
            if let kcal = Self.sum(w, .activeEnergyBurned, .kilocalorie()) { o["activeEnergyBurned"] = ["qty": kcal, "units": "kcal"] as [String: Any] }
            let bpm = HKUnit.count().unitDivided(by: .minute())
            // hartslag van de workout zelf, of anders alle metingen (bijv. Apple Watch) tijdens die training.
            // Zo krijgt ook een Gym Monster-training die Speediance in Health zet een hartslag.
            var hr = w.statistics(for: HKQuantityType(.heartRate))
            if hr?.averageQuantity() == nil { hr = await windowStats(.heartRate, w.startDate, w.endDate, [.discreteAverage, .discreteMax]) }
            if let hr {
                var h: [String: Any] = [:]
                if let a = hr.averageQuantity()?.doubleValue(for: bpm) { h["avg"] = ["qty": a, "units": "bpm"] as [String: Any] }
                if let m = hr.maximumQuantity()?.doubleValue(for: bpm) { h["max"] = ["qty": m, "units": "bpm"] as [String: Any] }
                if !h.isEmpty { o["heartRate"] = h }
            }
            // hartslagverloop voor de grafiek met zones (alleen recente workouts, om de volledige historie licht te houden)
            if w.startDate > Calendar.current.date(byAdding: .day, value: -400, to: Date())! {
                let series = await heartSeries(w.startDate, w.endDate)
                if series.count >= 3 { o["heartRateData"] = series }
            }
            if o["activeEnergyBurned"] == nil,
               let kcal = await windowStats(.activeEnergyBurned, w.startDate, w.endDate, .cumulativeSum)?.sumQuantity()?.doubleValue(for: .kilocalorie()),
               kcal > 0 {
                o["activeEnergyBurned"] = ["qty": kcal, "units": "kcal"] as [String: Any]
            }
            result.append(o)
        }
        return result
    }

    /// Hartslag per tijdvak (30 s tot 2 min, afhankelijk van de duur) als [{date, Avg, Max}].
    private func heartSeries(_ start: Date, _ end: Date) async -> [[String: Any]] {
        let duration = end.timeIntervalSince(start)
        guard duration > 120 else { return [] }
        let step = duration > 2 * 3600 ? 120 : duration > 3600 ? 60 : 30
        let type = HKQuantityType(.heartRate)
        let pred = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let descriptor = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: pred),
            options: [.discreteAverage, .discreteMax], anchorDate: start, intervalComponents: DateComponents(second: step))
        guard let collection = try? await descriptor.result(for: store) else { return [] }
        let bpm = HKUnit.count().unitDivided(by: .minute())
        var out: [[String: Any]] = []
        collection.enumerateStatistics(from: start, to: end) { stats, _ in
            guard let avg = stats.averageQuantity()?.doubleValue(for: bpm) else { return }
            var p: [String: Any] = ["date": self.fmt(stats.startDate), "Avg": (avg * 10).rounded() / 10, "units": "bpm"]
            if let mx = stats.maximumQuantity()?.doubleValue(for: bpm) { p["Max"] = mx.rounded() }
            out.append(p)
        }
        return out
    }

    /// Statistiek over een tijdvak, uit alle bronnen (iPhone, Watch …).
    private func windowStats(_ id: HKQuantityTypeIdentifier, _ start: Date, _ end: Date, _ options: HKStatisticsOptions) async -> HKStatistics? {
        let type = HKQuantityType(id)
        let pred = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let descriptor = HKStatisticsQueryDescriptor(predicate: .quantitySample(type: type, predicate: pred), options: options)
        return try? await descriptor.result(for: store)
    }

    private static func sum(_ w: HKWorkout, _ id: HKQuantityTypeIdentifier, _ unit: HKUnit) -> Double? {
        guard let q = w.statistics(for: HKQuantityType(id))?.sumQuantity() else { return nil }
        let v = q.doubleValue(for: unit)
        return v > 0 ? v : nil
    }

    /// Dagtotalen (iPhone en Watch samengevoegd zoals Apple Health dat zelf doet).
    private func fetchDaily(since: Date) async throws -> [[String: Any]] {
        let defs: [(String, HKQuantityTypeIdentifier, HKUnit, String)] = [
            ("step_count", .stepCount, .count(), "count"),
            ("active_energy", .activeEnergyBurned, .kilocalorie(), "kcal"),
            ("walking_running_distance", .distanceWalkingRunning, .meterUnit(with: .kilo), "km"),
        ]
        let anchor = Calendar.current.startOfDay(for: since)
        var out: [[String: Any]] = []
        for (name, id, unit, units) in defs {
            let type = HKQuantityType(id)
            let descriptor = HKStatisticsCollectionQueryDescriptor(
                predicate: .quantitySample(type: type, predicate: HKQuery.predicateForSamples(withStart: anchor, end: nil)),
                options: .cumulativeSum, anchorDate: anchor, intervalComponents: DateComponents(day: 1))
            let collection = try await descriptor.result(for: store)
            var data: [[String: Any]] = []
            collection.enumerateStatistics(from: anchor, to: Date()) { stats, _ in
                if let q = stats.sumQuantity() {
                    data.append(["date": self.fmt(stats.startDate), "qty": q.doubleValue(for: unit)] as [String: Any])
                }
            }
            out.append(["name": name, "units": units, "data": data] as [String: Any])
        }
        // hartslag in rust: gemiddelde per dag (Apple Watch)
        let restType = HKQuantityType(.restingHeartRate)
        let restDescriptor = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: restType, predicate: HKQuery.predicateForSamples(withStart: anchor, end: nil)),
            options: .discreteAverage, anchorDate: anchor, intervalComponents: DateComponents(day: 1))
        if let rest = try? await restDescriptor.result(for: store) {
            var data: [[String: Any]] = []
            let bpm = HKUnit.count().unitDivided(by: .minute())
            rest.enumerateStatistics(from: anchor, to: Date()) { stats, _ in
                if let q = stats.averageQuantity() { data.append(["date": self.fmt(stats.startDate), "qty": q.doubleValue(for: bpm)] as [String: Any]) }
            }
            if !data.isEmpty { out.append(["name": "resting_heart_rate", "units": "count/min", "data": data] as [String: Any]) }
        }
        return out
    }

    /// Engelse naam van een workoutsoort (de server vertaalt naar het Nederlands).
    static func activityName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .walking: return "Walking"
        case .hiking: return "Hiking"
        case .cycling: return "Cycling"
        case .handCycling: return "Hand Cycling"
        case .running: return "Running"
        case .swimming: return "Swimming"
        case .rowing: return "Rowing"
        case .traditionalStrengthTraining: return "Traditional Strength Training"
        case .functionalStrengthTraining: return "Functional Strength Training"
        case .coreTraining: return "Core Training"
        case .highIntensityIntervalTraining: return "HIIT"
        case .crossTraining: return "Cross Training"
        case .mixedCardio: return "Mixed Cardio"
        case .elliptical: return "Elliptical"
        case .stairClimbing: return "Stair Climbing"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .flexibility: return "Flexibility"
        case .cooldown: return "Cooldown"
        case .dance: return "Dance"
        case .tennis: return "Tennis"
        case .golf: return "Golf"
        default: return "Other \(t.rawValue)"
        }
    }

    // MARK: versturen

    private func endpoint() throws -> URL {
        var s = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if !s.lowercased().hasPrefix("http") { s = "http://" + s }
        guard var url = URL(string: s), url.host != nil else { throw SyncError.badURL }
        if !url.path.hasSuffix("/api/health/ingest") { url.appendPathComponent("api/health/ingest") }
        return url
    }

    /// Stuurt JSON naar de server met de koppelsleutel; geeft het antwoord terug.
    private func post(_ body: [String: Any]) async throws -> [String: Any] {
        guard !token.isEmpty else { throw SyncError.noToken }
        var req = URLRequest(url: try endpoint())
        req.httpMethod = "POST"
        req.timeoutInterval = 120
        req.setValue("Bearer \(token.trimmingCharacters(in: .whitespacesAndNewlines))", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard code == 200 else { throw SyncError.server(code, json["error"] as? String ?? "HTTP \(code)") }
        return json
    }
}
