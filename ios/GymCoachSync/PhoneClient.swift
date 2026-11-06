import Foundation

enum PhonePhase { case login, ready }

enum PhoneError: LocalizedError {
    case badURL, unauthorized, oldServer, decode
    case server(Int, String)
    var errorDescription: String? {
        switch self {
        case .badURL: return "Vul een geldig serveradres in. Voorbeeld: http://192.168.1.50:8765"
        case .unauthorized: return "Log opnieuw in."
        case .oldServer: return "Deze GymCoach-server kent het scherm onderweg nog niet. Werk de server bij naar 2.12.0 of nieuwer."
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
    var steps: PhoneSteps
    var food: PhoneFood?
    var sessions: [PhoneSession]
    var nextKey: String?
    var goal: PhoneGoal?
    var body: PhoneBody?
    var recent: [PhoneRecent]
    var progress: [PhoneProgress]
    var records: [PhoneRecord]
}

struct PhoneWeek: Codable {
    var done: Int
    var target: Int
    var minutes: Int
    var streak: Int
    var kcal: Int
}

struct PhoneRecovery: Codable {
    var state: String
    var label: String
    var detail: String
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
}

struct PhoneSession: Codable, Identifiable {
    var key: String
    var name: String
    var minutes: Int?
    var outdoor: Bool
    var advice: String
    var done: Bool
    var doneDate: String
    var exercises: [PhoneExercise]
    var id: String { key }
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

struct PhoneBody: Codable {
    var kg: Double?
    var date: String
    var muscle: Double?
    var muscleDate: String
    var fat: Double?
    var slope: Double?
    var spark: [Double]
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
    static func baseURL() throws -> URL {
        var s = (UserDefaults.standard.string(forKey: "serverURL") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !s.lowercased().hasPrefix("http") { s = "http://" + s }
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

    static func fetchPhone() async throws -> PhoneSnapshot {
        let (data, http) = try await send(try request("api/phone"))
        if http.statusCode == 401 { throw PhoneError.unauthorized }
        if http.statusCode == 404 { throw PhoneError.oldServer }
        guard http.statusCode == 200 else { throw PhoneError.server(http.statusCode, message(data) ?? "HTTP \(http.statusCode)") }
        do { return try JSONDecoder().decode(PhoneSnapshot.self, from: data) }
        catch { throw PhoneError.decode }
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
    }
}
