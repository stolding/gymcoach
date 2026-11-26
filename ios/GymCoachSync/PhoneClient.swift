import Foundation
import WidgetKit

enum PhonePhase { case login, ready }

enum PhoneError: LocalizedError {
    case badURL, unauthorized, oldServer, decode
    case server(Int, String)
    var errorDescription: String? {
        switch self {
        case .badURL: return "Vul een geldig adres in voor het scherm. Voorbeeld: https://gymcoach.stolding.com"
        case .unauthorized: return "Log opnieuw in."
        case .oldServer: return "Deze GymCoach-server kent het scherm onderweg nog niet. Werk de server bij naar 2.13.1 of nieuwer."
        case .decode: return "Het antwoord van de server was niet te lezen."
        case let .server(_, msg): return msg
        }
    }
}

struct PhoneSnapshot: Codable {
    var version: String
    var name: String
    var today: String
    var iso: String
    var fetchedAt: String
    var week: PhoneWeek
    var tip: String
    var deload: Bool
    var recovery: PhoneRecovery?
    var muscleRecovery: PhoneMuscleRecovery?
    var steps: PhoneSteps
    var food: PhoneFood?
    var sessions: [PhoneSession]
    var nextKey: String?
    var goal: PhoneGoal?
    var tracks: [PhoneTrack]?
    var body: PhoneBody?
    var composition: PhoneComposition
    var recent: [PhoneRecent]
    var progress: [PhoneProgress]
    var records: [PhoneRecord]
    var weekPlan: PhoneWeekPlan
    var health: PhoneHealth?
    var score: PhoneHealthScore?
}

struct GuideDoc: Codable {
    var sections: [GuideSection]
}

struct GuideSection: Codable, Identifiable {
    var id: String
    var title: String
    var html: String
}

struct PhoneHealth: Codable {
    var text: String
    var at: String
    var blocks: [PhoneHealthBlock]?
}

struct PhoneHealthBlock: Codable {
    var type: String
    var text: String?
    var icon: String?
    var items: [String]?
    var columns: [String]?
    var kinds: [String]?
    var rows: [PhoneHealthRow]?
}

struct PhoneHealthRow: Codable {
    var cells: [String]
    var tone: String
}

struct PhoneHealthScore: Codable {
    var total: Double
    var delta: Double?
    var trend: String
    var since: String
    var categories: [PhoneHealthCat]
}

struct PhoneHealthCat: Codable, Identifiable {
    var id: String
    var label: String
    var score: Double
}

struct PhoneWeek: Codable {
    var done: Int
    var target: Int
    var planned: Int
    var minutes: Int
    var streak: Int
    var kcal: Int
    var volume: Int
    var volumeNote: String

    enum CodingKeys: String, CodingKey {
        case done, target, planned, minutes, streak, kcal, volume, volumeNote
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        done = try c.decode(Int.self, forKey: .done)
        target = try c.decode(Int.self, forKey: .target)
        planned = try c.decodeIfPresent(Int.self, forKey: .planned) ?? 0
        minutes = try c.decode(Int.self, forKey: .minutes)
        streak = try c.decode(Int.self, forKey: .streak)
        kcal = try c.decode(Int.self, forKey: .kcal)
        volume = try c.decode(Int.self, forKey: .volume)
        volumeNote = try c.decode(String.self, forKey: .volumeNote)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(done, forKey: .done)
        try c.encode(target, forKey: .target)
        try c.encode(planned, forKey: .planned)
        try c.encode(minutes, forKey: .minutes)
        try c.encode(streak, forKey: .streak)
        try c.encode(kcal, forKey: .kcal)
        try c.encode(volume, forKey: .volume)
        try c.encode(volumeNote, forKey: .volumeNote)
    }
}

struct PhoneRecovery: Codable {
    var state: String
    var label: String
    var detail: String
    var note: String
}

struct PhoneMuscleNow: Codable, Identifiable {
    var key: String
    var name: String
    var pct: Double
    var id: String { key }
}

struct PhoneMuscleSeries: Codable {
    var key: String
    var points: [PhonePoint]
}

struct PhoneMuscleRecovery: Codable {
    var note: String
    var legend: String
    var empty: String?
    var fresh: Double
    var muscles: [PhoneMuscleNow]
    var series: [PhoneMuscleSeries]
    var scores: [PhoneScore]
    var figure: String
}

struct PhoneSteps: Codable {
    var today: Int?
    var goal: Int
}

struct PhoneFood: Codable {
    var kcal: Int?
    var target: Int?
    var protein: Int?
    var proteinTarget: Int?
    var carbs: Int?
    var fat: Int?
    var line: String
    var maintenance: Int?
    var rmr: Int?
    var tone: String?
}

struct PhoneSession: Codable, Identifiable {
    var key: String
    var name: String
    var minutes: Int?
    var when: String = ""
    var outdoor: Bool
    var advice: String
    var done: Bool
    var doneDate: String
    var onDevice: Bool
    var superset: Bool
    var exercises: [PhoneExercise]
    var shifts: [String] = []
    var id: String { key }

    enum CodingKeys: String, CodingKey {
        case key, name, minutes, when, outdoor, advice, done, doneDate, onDevice, superset, exercises, shifts
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = try c.decode(String.self, forKey: .key)
        name = try c.decode(String.self, forKey: .name)
        minutes = try c.decodeIfPresent(Int.self, forKey: .minutes)
        when = try c.decodeIfPresent(String.self, forKey: .when) ?? ""
        outdoor = try c.decode(Bool.self, forKey: .outdoor)
        advice = try c.decode(String.self, forKey: .advice)
        done = try c.decode(Bool.self, forKey: .done)
        doneDate = try c.decode(String.self, forKey: .doneDate)
        onDevice = try c.decode(Bool.self, forKey: .onDevice)
        superset = try c.decode(Bool.self, forKey: .superset)
        exercises = try c.decode([PhoneExercise].self, forKey: .exercises)
        shifts = try c.decodeIfPresent([String].self, forKey: .shifts) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(key, forKey: .key)
        try c.encode(name, forKey: .name)
        try c.encodeIfPresent(minutes, forKey: .minutes)
        try c.encode(when, forKey: .when)
        try c.encode(outdoor, forKey: .outdoor)
        try c.encode(advice, forKey: .advice)
        try c.encode(done, forKey: .done)
        try c.encode(doneDate, forKey: .doneDate)
        try c.encode(onDevice, forKey: .onDevice)
        try c.encode(superset, forKey: .superset)
        try c.encode(exercises, forKey: .exercises)
        try c.encode(shifts, forKey: .shifts)
    }
}

struct PhoneExercise: Codable {
    var title: String
    var muscle: String
    var note: String
    var summary: String
    var sets: [PhoneSet]
    var index: Int
}

struct PhoneSet: Codable {
    var text: String
    var rest: Int?
}

struct PhoneGoal: Codable {
    var lines: [String]
    var pace: String
    var paceState: String
}

struct PhoneTrack: Codable {
    var name: String
    var unit: String
    var note: String
    var start: Double?
    var now: Double?
    var target: Double?
    var state: String
    var pace: String
    var place: String
    var line: [PhonePoint]?
    var points: [PhonePoint]?
}

struct PhoneBody: Codable {
    var kg: Double?
    var date: String
    var muscle: Double?
    var muscleDate: String
    var fat: Double?
    var slope: Double?
    var slopeNote: String
    var spark: [Double]
}

struct PhoneComposition: Codable {
    var measured: String
    var metrics: [PhoneMetric]
    var marks: [PhoneMark]
    var legend: [PhoneLegend]
}

struct PhoneMetric: Codable, Identifiable {
    var key: String
    var label: String
    var unit: String
    var value: Double
    var delta: Double?
    var since: String
    var better: Bool?
    var zone: String
    var note: String
    var bands: [PhoneBand]
    var points: [PhonePoint]
    var id: String { key }
}

struct PhonePoint: Codable {
    var d: String
    var y: Double
}

struct PhoneBand: Codable {
    var from: Double
    var to: Double
    var cls: String
}

struct PhoneMark: Codable {
    var d: String
    var kind: String
}

struct PhoneLegend: Codable, Identifiable {
    var kind: String
    var label: String
    var color: String
    var id: String { kind }
}

struct PhoneBalanceCell: Codable {
    var pct: Int
    var role: String
}

struct PhoneBalanceHit: Codable {
    var block: Int
    var role: String
}

struct PhoneBalanceRow: Codable, Identifiable {
    var name: String
    var cells: [PhoneBalanceCell]
    var blocks: [Int]?
    var hits: [PhoneBalanceHit]?
    var id: String { name }
}

struct PhoneBalance: Codable {
    var days: [String]
    var rows: [PhoneBalanceRow]
    var mode: String?
}

struct PhoneWeekPlan: Codable {
    var week: Int
    var goal: String
    var focus: [String]
    var figure: String
    var sessions: Int
    var avgMinutes: Int
    var sets: Int
    var exercises: Int
    var volume: Int
    var heavier: Int
    var scores: [PhoneScore]
    var muscles: [PhoneMuscle]
    var balance: PhoneBalance?

    enum CodingKeys: String, CodingKey {
        case week, goal, focus, figure, sessions, avgMinutes, sets, exercises, volume, heavier, scores, muscles, balance
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        week = try c.decode(Int.self, forKey: .week)
        goal = try c.decode(String.self, forKey: .goal)
        focus = try c.decode([String].self, forKey: .focus)
        figure = try c.decode(String.self, forKey: .figure)
        sessions = try c.decode(Int.self, forKey: .sessions)
        avgMinutes = try c.decode(Int.self, forKey: .avgMinutes)
        sets = try c.decode(Int.self, forKey: .sets)
        exercises = try c.decode(Int.self, forKey: .exercises)
        volume = try c.decode(Int.self, forKey: .volume)
        heavier = try c.decode(Int.self, forKey: .heavier)
        scores = try c.decode([PhoneScore].self, forKey: .scores)
        muscles = try c.decode([PhoneMuscle].self, forKey: .muscles)
        balance = try c.decodeIfPresent(PhoneBalance.self, forKey: .balance)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(week, forKey: .week)
        try c.encode(goal, forKey: .goal)
        try c.encode(focus, forKey: .focus)
        try c.encode(figure, forKey: .figure)
        try c.encode(sessions, forKey: .sessions)
        try c.encode(avgMinutes, forKey: .avgMinutes)
        try c.encode(sets, forKey: .sets)
        try c.encode(exercises, forKey: .exercises)
        try c.encode(volume, forKey: .volume)
        try c.encode(heavier, forKey: .heavier)
        try c.encode(scores, forKey: .scores)
        try c.encode(muscles, forKey: .muscles)
        try c.encodeIfPresent(balance, forKey: .balance)
    }
}

struct PhoneScore: Codable, Identifiable {
    var key: String
    var value: Double
    var id: String { key }
}

struct PhoneMuscle: Codable {
    var name: String
    var value: Double
    var share: Double
}

struct PhoneRecent: Codable {
    var date: String
    var title: String
    var minutes: Int?
}

struct PhoneProgress: Codable {
    var name: String
    var e1rm: Double
    var delta: Double
    var spark: [Double]
}

struct PhoneRecord: Codable {
    var name: String
    var date: String
    var e1rm: Double
}

enum GymServer {
    static let defaultsKey = "phoneServerURL"
    static let defaultAddress = "https://gymcoach.stolding.com"

    static func storedAddress() -> String {
        UserDefaults.standard.string(forKey: defaultsKey) ?? defaultAddress
    }

    static func baseURL() throws -> URL {
        var s = storedAddress().trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { throw PhoneError.badURL }
        if !s.lowercased().hasPrefix("http") { s = "https://" + s }
        while s.hasSuffix("/") { s.removeLast() }
        guard let url = URL(string: s), let host = url.host, !host.isEmpty else { throw PhoneError.badURL }
        return url
    }

    static func url(_ path: String) throws -> URL {
        try baseURL().appending(path: path)
    }
}

enum PhoneClient {
    static func login(username: String, password: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["username": username, "password": password])
        let (data, http) = try await send(try request("api/auth/login", method: "POST", body: body))
        guard http.statusCode == 200 else { throw PhoneError.server(http.statusCode, message(data) ?? "Inloggen mislukt.") }
    }

    static func logout() async {
        if let req = try? request("api/auth/logout", method: "POST") {
            _ = try? await URLSession.shared.data(for: req)
        }
        guard let host = try? GymServer.baseURL().host else { return }
        let store = HTTPCookieStorage.shared
        for cookie in store.cookies ?? [] where cookie.domain.contains(host) || host.hasSuffix(cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))) {
            store.deleteCookie(cookie)
        }
    }

    static func fetchGuide() async throws -> [GuideSection] {
        let (data, http) = try await send(try request("api/guide"))
        if http.statusCode == 401 { throw PhoneError.unauthorized }
        if http.statusCode == 404 { throw PhoneError.oldServer }
        guard http.statusCode == 200 else { throw PhoneError.server(http.statusCode, message(data) ?? "HTTP \(http.statusCode)") }
        do { return try JSONDecoder().decode(GuideDoc.self, from: data).sections }
        catch { throw PhoneError.decode }
    }

    static func fetchPhone() async throws -> PhoneSnapshot {
        let (data, http) = try await send(try request("api/phone"))
        if http.statusCode == 401 { throw PhoneError.unauthorized }
        if http.statusCode == 404 { throw PhoneError.oldServer }
        guard http.statusCode == 200 else { throw PhoneError.server(http.statusCode, message(data) ?? "HTTP \(http.statusCode)") }
        do {
            let snap = try JSONDecoder().decode(PhoneSnapshot.self, from: data)
            WidgetBridge.save(data)
            return snap
        } catch { throw PhoneError.decode }
    }

    private static func request(_ path: String, method: String = "GET", body: Data? = nil) throws -> URLRequest {
        var req = URLRequest(url: try GymServer.url(path))
        req.httpMethod = method
        req.timeoutInterval = 8
        req.setValue(Locale.preferredLanguages.prefix(4).joined(separator: ","), forHTTPHeaderField: "Accept-Language")
        if let body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return req
    }

    private static func send(_ req: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw PhoneError.decode }
        return (data, http)
    }

    private static func message(_ data: Data) -> String? {
        (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
    }
}

@MainActor
final class PhoneModel: ObservableObject {
    static let shared = PhoneModel()
    @Published var serverURL: String = GymServer.storedAddress() {
        didSet { UserDefaults.standard.set(serverURL, forKey: GymServer.defaultsKey) }
    }
    @Published var phase: PhonePhase = .login
    @Published var snapshot: PhoneSnapshot?
    @Published var stale = false
    @Published var busy = false
    @Published var error = ""
    @Published var username: String = UserDefaults.standard.string(forKey: "phoneUser") ?? "" {
        didSet { UserDefaults.standard.set(username, forKey: "phoneUser") }
    }

    private var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("gymcoach-phone.json")
    }

    func loadCache() {
        if let data = try? Data(contentsOf: cacheURL), let snap = try? JSONDecoder().decode(PhoneSnapshot.self, from: data) {
            snapshot = snap
            WidgetBridge.publish(snap)
        }
    }

    func bootstrap() async {
        loadCache()
        await refresh()
    }

    func refresh() async {
        do {
            let snap = try await PhoneClient.fetchPhone()
            snapshot = snap
            WidgetBridge.publish(snap)
            stale = false
            phase = .ready
            error = ""
            try? JSONEncoder().encode(snap).write(to: cacheURL, options: .atomic)
        } catch PhoneError.unauthorized {
            phase = .login
            stale = false
        } catch PhoneError.oldServer {
            phase = .login
            stale = false
            error = PhoneError.oldServer.localizedDescription
        } catch {
            if snapshot != nil {
                stale = true
                phase = .ready
            } else {
                phase = .login
                self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    func login(password: String) async {
        busy = true
        error = ""
        defer { busy = false }
        do {
            try await PhoneClient.login(username: username.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            await refresh()
            if phase != .ready && error.isEmpty {
                error = "Inloggen lukte, maar het scherm kon niet laden."
            }
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func logout() async {
        await PhoneClient.logout()
        snapshot = nil
        stale = false
        phase = .login
        error = ""
        try? FileManager.default.removeItem(at: cacheURL)
        WidgetBridge.clear()
    }
}

/// Korte samenvatting van het scherm, in de App Group. Het ruwe antwoord is te groot en een enkel verkeerd getal maakte de hele widget leeg.
enum WidgetBridge {
    static let group = "group.com.stolding.gymcoachsync"
    static let filename = "widget.json"
    static let defaultsKey = "widget"

    static func publish(_ snap: PhoneSnapshot) {
        let sessions: [[String: Any]] = snap.sessions.map { s in
            var row: [String: Any] = ["key": s.key, "name": s.name, "done": s.done]
            if let minutes = s.minutes { row["minutes"] = minutes }
            let titles = s.exercises.map(\.title).filter { !$0.isEmpty }
            if !titles.isEmpty { row["titles"] = titles }
            return row
        }
        let muscles: [[String: Any]] = (snap.muscleRecovery?.muscles ?? []).map {
            ["key": $0.key, "name": $0.name, "pct": $0.pct]
        }
        var payload: [String: Any] = [
            "done": snap.week.done,
            "target": snap.week.target,
            "planned": snap.week.planned,
            "sessions": sessions,
            "figure": snap.muscleRecovery?.figure ?? "man",
            "muscles": muscles,
        ]
        if let key = snap.nextKey { payload["nextKey"] = key }
        if let score = snap.score {
            payload["score"] = score.total
            if let delta = score.delta { payload["delta"] = delta }
        }
        if let food = snap.food {
            if let kcal = food.kcal { payload["kcal"] = kcal }
            if let target = food.target { payload["kcalTarget"] = target }
            if let maintenance = food.maintenance { payload["maintenance"] = maintenance }
            if let rmr = food.rmr { payload["rmr"] = rmr }
            if let tone = food.tone { payload["tone"] = tone }
        }
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        if let url = fileURL() {
            try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? data.write(to: url, options: .atomic)
        }
        UserDefaults(suiteName: group)?.set(data, forKey: defaultsKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func save(_ data: Data) {
        // Het ruwe scherm blijft als reserve. publish(_:) schrijft de samenvatting die de widget leest.
        guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent("phone-snapshot.json") else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func clear() {
        if let url = fileURL() { try? FileManager.default.removeItem(at: url) }
        UserDefaults(suiteName: group)?.removeObject(forKey: defaultsKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    private static func fileURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent(filename)
    }
}
