import WidgetKit
import SwiftUI

private let appGroup = "group.com.stolding.gymcoachsync"
private let snapshotName = "phone-snapshot.json"

private struct WeekBits: Decodable {
    var done: Int
    var target: Int
    var planned: Int
}

private struct StandSets: Decodable {
    var done: Int
    var planned: Int
    var expected: Int
}

private struct WeekStand: Decodable {
    var state: String
    var sets: StandSets?
}

private struct SessionBits: Decodable {
    var key: String
    var name: String
    var minutes: Int?
    var done: Bool
}

private struct FoodBits: Decodable {
    var kcal: Int?
    var target: Int?
}

private struct MuscleBits: Decodable {
    var name: String
    var pct: Double
}

private struct RecoveryBits: Decodable {
    var muscles: [MuscleBits]
}

/// Alleen de velden die de widgets tonen. De rest van de payload mag blijven staan.
private struct WidgetSnap: Decodable {
    var week: WeekBits
    var weekStand: WeekStand?
    var sessions: [SessionBits]
    var nextKey: String?
    var food: FoodBits?
    var muscleRecovery: RecoveryBits?

    static let sample = WidgetSnap(
        week: WeekBits(done: 1, target: 3, planned: 3),
        weekStand: WeekStand(state: "on", sets: StandSets(done: 12, planned: 40, expected: 12)),
        sessions: [SessionBits(key: "a", name: "Full Body A", minutes: 45, done: false)],
        nextKey: "a",
        food: FoodBits(kcal: 1400, target: 1900),
        muscleRecovery: RecoveryBits(muscles: [MuscleBits(name: "Borst", pct: 38)])
    )
}

private enum WidgetStore {
    static func load() -> WidgetSnap? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let url = base.appendingPathComponent(snapshotName)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(WidgetSnap.self, from: data)
    }
}

private struct LockEntry: TimelineEntry {
    let date: Date
    let snap: WidgetSnap?
}

private struct LockProvider: TimelineProvider {
    func placeholder(in context: Context) -> LockEntry {
        LockEntry(date: Date(), snap: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (LockEntry) -> Void) {
        let snap = WidgetStore.load() ?? (context.isPreview ? .sample : nil)
        completion(LockEntry(date: Date(), snap: snap))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LockEntry>) -> Void) {
        let entry = LockEntry(date: Date(), snap: WidgetStore.load())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

private struct WeekLine {
    var short: String
    var status: String
    var detail: String
    var fraction: Double
}

private func weekLine(_ snap: WidgetSnap?) -> WeekLine {
    guard let snap else {
        return WeekLine(short: "—", status: "Open GymCoach", detail: "Nog geen gegevens", fraction: 0)
    }
    if let stand = snap.weekStand, stand.state != "empty" {
        let done = stand.sets?.done ?? 0
        let planned = stand.sets?.planned ?? 0
        let fraction = planned > 0 ? min(1, Double(done) / Double(planned)) : 0
        let (short, status): (String, String) = switch stand.state {
        case "ahead": ("Voor", "Voor op schema")
        case "on": ("Op schema", "Op schema")
        case "behind": ("Achter", "Achter op schema")
        case "done": ("Binnen", "De week is binnen")
        case "wait": ("Wacht", "Nog niets verwacht")
        default: ("Week", "Deze week")
        }
        let detail = planned > 0 ? "\(done)/\(planned) sets" : status
        return WeekLine(short: short, status: status, detail: detail, fraction: fraction)
    }
    let planned = snap.week.planned > 0 ? snap.week.planned : snap.week.target
    let done = snap.week.done
    if planned <= 0 {
        return WeekLine(short: "—", status: "Nog geen weekplan", detail: "Geen plan", fraction: 0)
    }
    let expected = Double(planned) * weekElapsed()
    let slack = max(0.5, expected * 0.1)
    let (short, status): (String, String)
    if done >= planned {
        (short, status) = ("Binnen", "De week is binnen")
    } else if expected < 0.5 && done == 0 {
        (short, status) = ("Wacht", "Nog niets verwacht")
    } else if Double(done) > expected + slack {
        (short, status) = ("Voor", "Voor op schema")
    } else if Double(done) + slack < expected {
        (short, status) = ("Achter", "Achter op schema")
    } else {
        (short, status) = ("Op schema", "Op schema")
    }
    return WeekLine(short: short, status: status, detail: "\(done)/\(planned)", fraction: min(1, Double(done) / Double(planned)))
}

private func weekElapsed() -> Double {
    let cal = Calendar.current
    let weekday = cal.component(.weekday, from: Date())
    let mondayIndex = (weekday + 5) % 7
    let hour = cal.component(.hour, from: Date())
    let minute = cal.component(.minute, from: Date())
    let hours = Double(mondayIndex) * 24 + Double(hour) + Double(minute) / 60
    return min(1, max(0, hours / (7 * 24)))
}

private struct SessionLine {
    var name: String
    var detail: String
}

private func sessionLine(_ snap: WidgetSnap?) -> SessionLine {
    guard let snap else { return SessionLine(name: "Training", detail: "Open GymCoach") }
    if let key = snap.nextKey, let session = snap.sessions.first(where: { $0.key == key }) {
        let detail = session.minutes.map { "\($0) min" } ?? (session.done ? "gedaan" : "volgende")
        return SessionLine(name: session.name, detail: detail)
    }
    if snap.sessions.isEmpty { return SessionLine(name: "Geen plan", detail: "Nog geen training") }
    return SessionLine(name: "Klaar", detail: "Alles gedaan")
}

private struct MuscleLine {
    var name: String
    var fatigue: Int?
}

private func muscleLine(_ snap: WidgetSnap?) -> MuscleLine {
    guard let muscles = snap?.muscleRecovery?.muscles, !muscles.isEmpty else {
        return MuscleLine(name: snap == nil ? "Open GymCoach" : "Nog geen sets", fatigue: nil)
    }
    let tired = muscles.min { $0.pct < $1.pct } ?? muscles[0]
    let fatigue = Int((100 - min(100, max(0, tired.pct))).rounded())
    return MuscleLine(name: tired.name, fatigue: fatigue)
}

private struct DeficitLine {
    var title: String
    var value: String
}

private func deficitLine(_ snap: WidgetSnap?) -> DeficitLine {
    guard let food = snap?.food, let target = food.target, target > 0 else {
        return DeficitLine(title: "Inname", value: snap == nil ? "Open GymCoach" : "Geen doel")
    }
    guard let kcal = food.kcal else {
        return DeficitLine(title: "Streef", value: "\(target) kcal")
    }
    let gap = target - kcal
    if gap >= 0 { return DeficitLine(title: "Tekort", value: "\(gap) kcal") }
    return DeficitLine(title: "Overschot", value: "\(-gap) kcal")
}

private let widgetFamilies: [WidgetFamily] = [
    .systemSmall, .systemMedium, .systemLarge,
    .accessoryCircular, .accessoryRectangular, .accessoryInline,
]

private extension View {
    @ViewBuilder
    func gymWidgetBackground(_ family: WidgetFamily) -> some View {
        switch family {
        case .accessoryInline, .accessoryCircular, .accessoryRectangular:
            containerBackground(for: .widget) { AccessoryWidgetBackground() }
        default:
            containerBackground(.fill.tertiary, for: .widget)
        }
    }
}

private struct WeekWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let snap: WidgetSnap?

    var body: some View {
        let line = weekLine(snap)
        Group {
            switch family {
            case .accessoryInline:
                Text("Week: \(line.status) \(line.detail)")
            case .accessoryCircular:
                Gauge(value: line.fraction) {
                    Text("Week")
                } currentValueLabel: {
                    Text(line.short).minimumScaleFactor(0.5)
                }
                .gaugeStyle(.accessoryCircular)
            case .accessoryRectangular:
                CompactStack(kicker: "Week", title: line.status, detail: line.detail)
            case .systemMedium:
                HStack(alignment: .center, spacing: 12) {
                    HomeStack(kicker: "Weekvoortgang", title: line.status, detail: line.detail)
                    Gauge(value: line.fraction) {
                        Text("Week")
                    } currentValueLabel: {
                        Text(line.short).minimumScaleFactor(0.6)
                    }
                    .gaugeStyle(.accessoryCircular)
                    .frame(width: 72, height: 72)
                }
            case .systemLarge:
                VStack(alignment: .leading, spacing: 10) {
                    HomeStack(kicker: "Weekvoortgang", title: line.status, detail: line.detail, large: true)
                    ProgressView(value: line.fraction)
                        .tint(.accentColor)
                }
            default:
                HomeStack(kicker: "Weekvoortgang", title: line.status, detail: line.detail)
            }
        }
        .gymWidgetBackground(family)
    }
}

private struct SessionWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let snap: WidgetSnap?

    var body: some View {
        let line = sessionLine(snap)
        Group {
            switch family {
            case .accessoryInline:
                Text("Vandaag: \(line.name)")
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Text(line.detail).font(.caption2).minimumScaleFactor(0.6)
                    Text(initials(line.name)).font(.headline).minimumScaleFactor(0.5)
                }
            case .accessoryRectangular:
                CompactStack(kicker: "Vandaag", title: line.name, detail: line.detail)
            case .systemMedium:
                HomeStack(kicker: "Training vandaag", title: line.name, detail: line.detail)
            case .systemLarge:
                HomeStack(kicker: "Training vandaag", title: line.name, detail: line.detail, large: true)
            default:
                HomeStack(kicker: "Training vandaag", title: line.name, detail: line.detail)
            }
        }
        .gymWidgetBackground(family)
    }
}

private struct FatigueWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let snap: WidgetSnap?

    var body: some View {
        let line = muscleLine(snap)
        let pct = line.fatigue.map { "\($0)%" } ?? "—"
        let fraction = Double(line.fatigue ?? 0) / 100
        let detail = line.fatigue == nil ? "geen meting" : "\(pct) vermoeid"
        Group {
            switch family {
            case .accessoryInline:
                Text("Vermoeid: \(line.name) \(pct)")
            case .accessoryCircular:
                Gauge(value: fraction) {
                    Text("Spier")
                } currentValueLabel: {
                    Text(pct)
                }
                .gaugeStyle(.accessoryCircular)
            case .accessoryRectangular:
                CompactStack(kicker: "Vermoeidheid", title: line.name, detail: detail)
            case .systemMedium:
                HStack(alignment: .center, spacing: 12) {
                    HomeStack(kicker: "Spiervermoeidheid", title: line.name, detail: "Meest vermoeid")
                    Text(pct).font(.largeTitle).minimumScaleFactor(0.5).lineLimit(1)
                }
            case .systemLarge:
                VStack(alignment: .leading, spacing: 10) {
                    HomeStack(kicker: "Spiervermoeidheid", title: line.name, detail: detail, large: true)
                    ProgressView(value: fraction).tint(.accentColor)
                }
            default:
                HomeStack(kicker: "Spiervermoeidheid", title: line.name, detail: detail)
            }
        }
        .gymWidgetBackground(family)
    }
}

private struct DeficitWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let snap: WidgetSnap?

    var body: some View {
        let line = deficitLine(snap)
        Group {
            switch family {
            case .accessoryInline:
                Text("\(line.title) \(line.value)")
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Text(line.title).font(.caption2)
                    Text(line.value.replacingOccurrences(of: " kcal", with: "")).font(.headline).minimumScaleFactor(0.5)
                }
            case .accessoryRectangular:
                CompactStack(kicker: "Calorieën", title: line.title, detail: line.value)
            case .systemMedium:
                HStack(alignment: .center) {
                    HomeStack(kicker: "Calorietekort", title: line.title, detail: "Vandaag")
                    Text(line.value).font(.title).minimumScaleFactor(0.5).lineLimit(1)
                }
            case .systemLarge:
                HomeStack(kicker: "Calorietekort", title: line.title, detail: line.value, large: true)
            default:
                HomeStack(kicker: "Calorietekort", title: line.title, detail: line.value)
            }
        }
        .gymWidgetBackground(family)
    }
}

private struct CompactStack: View {
    var kicker: String
    var title: String
    var detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(kicker).font(.caption2).widgetAccentable()
            Text(title).font(.headline).minimumScaleFactor(0.65).lineLimit(2)
            Text(detail).font(.caption).minimumScaleFactor(0.7).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct HomeStack: View {
    var kicker: String
    var title: String
    var detail: String
    var large: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: large ? 8 : 4) {
            Text(kicker)
                .font(large ? .headline : .caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text(title)
                .font(large ? .largeTitle : .title2)
                .fontWeight(.semibold)
                .minimumScaleFactor(0.5)
                .lineLimit(large ? 3 : 2)
            Text(detail)
                .font(large ? .title3 : .body)
                .minimumScaleFactor(0.6)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private func initials(_ name: String) -> String {
    let parts = name.split(separator: " ").prefix(2)
    let letters = parts.compactMap { $0.first }.map(String.init).joined()
    return letters.isEmpty ? "·" : letters
}

struct WeekProgressWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "weekProgress", provider: LockProvider()) { entry in
            WeekWidgetView(snap: entry.snap)
        }
        .configurationDisplayName("Weekvoortgang")
        .description("Voor op schema, op schema of achter op schema.")
        .supportedFamilies(widgetFamilies)
    }
}

struct TodaySessionWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "todaySession", provider: LockProvider()) { entry in
            SessionWidgetView(snap: entry.snap)
        }
        .configurationDisplayName("Training vandaag")
        .description("De volgende training uit het weekplan.")
        .supportedFamilies(widgetFamilies)
    }
}

struct MuscleFatigueWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "muscleFatigue", provider: LockProvider()) { entry in
            FatigueWidgetView(snap: entry.snap)
        }
        .configurationDisplayName("Spiervermoeidheid")
        .description("De spiergroep die nu het meest vermoeid is.")
        .supportedFamilies(widgetFamilies)
    }
}

struct CalorieDeficitWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "calorieDeficit", provider: LockProvider()) { entry in
            DeficitWidgetView(snap: entry.snap)
        }
        .configurationDisplayName("Calorietekort")
        .description("Hoeveel kcal je vandaag nog onder de streeflijn zit.")
        .supportedFamilies(widgetFamilies)
    }
}

@main
struct GymCoachWidgets: WidgetBundle {
    var body: some Widget {
        WeekProgressWidget()
        TodaySessionWidget()
        MuscleFatigueWidget()
        CalorieDeficitWidget()
    }
}
