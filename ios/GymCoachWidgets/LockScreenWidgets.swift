import WidgetKit
import SwiftUI
import UIKit

private let appGroup = "group.com.stolding.gymcoachsync"

private let ink = Color(red: 0.925, green: 0.922, blue: 0.906)
private let muted = Color(red: 0.604, green: 0.612, blue: 0.631)
private let card = Color(red: 0.102, green: 0.106, blue: 0.118)
private let accent = Color(red: 1, green: 0.478, blue: 0.180)
private let ok = Color(red: 0.298, green: 0.761, blue: 0.416)
private let warn = Color(red: 1, green: 0.420, blue: 0.420)
private let targetBlue = Color(red: 0.424, green: 0.612, blue: 1)
private let need = Color(red: 0.906, green: 0.922, blue: 0.949)
private let bmrGold = Color(red: 0.878, green: 0.765, blue: 0.416)

private let families: [WidgetFamily] = [
    .systemSmall, .systemMedium, .systemLarge,
    .accessoryCircular, .accessoryRectangular, .accessoryInline,
]

struct PhoneScore: Codable, Identifiable {
    var key: String
    var value: Double
    var id: String { key }
}

private struct Sess {
    var key: String
    var name: String
    var minutes: Int?
    var done: Bool
    var titles: [String]
}

private struct MuscleBit {
    var key: String
    var name: String
    var pct: Double
}

private struct Snap {
    var done: Int?
    var target: Int?
    var planned: Int?
    var score: Double?
    var delta: Double?
    var sessions: [Sess]
    var nextKey: String?
    var muscles: [MuscleBit]
    var figure: String
    var kcal: Int?
    var kcalTarget: Int?
    var maintenance: Int?
    var rmr: Int?
    var tone: String?
}

private func num(_ value: Any?) -> Int? {
    guard let n = value as? NSNumber else { return nil }
    if CFGetTypeID(n) == CFBooleanGetTypeID() { return nil }
    return Int(n.doubleValue.rounded())
}

private func dbl(_ value: Any?) -> Double? {
    guard let n = value as? NSNumber else { return nil }
    if CFGetTypeID(n) == CFBooleanGetTypeID() { return nil }
    return n.doubleValue
}

private func parse(_ data: Data) -> Snap? {
    guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    let week = root["week"] as? [String: Any]
    let food = root["food"] as? [String: Any]
    let score = root["score"] as? [String: Any]
    let rec = root["muscleRecovery"] as? [String: Any]
    let srcSessions = (root["sessions"] as? [[String: Any]]) ?? []
    let srcMuscles = (root["muscles"] as? [[String: Any]]) ?? (rec?["muscles"] as? [[String: Any]]) ?? []
    let sessions: [Sess] = srcSessions.compactMap { row in
        let name = row["name"] as? String ?? ""
        if name.isEmpty && row["key"] == nil { return nil }
        let titles = (row["titles"] as? [String]) ?? ((row["exercises"] as? [[String: Any]])?.compactMap { $0["title"] as? String } ?? [])
        return Sess(key: row["key"] as? String ?? "", name: name, minutes: num(row["minutes"]), done: (row["done"] as? Bool) ?? false, titles: titles)
    }
    let muscles: [MuscleBit] = srcMuscles.compactMap { row in
        guard let key = row["key"] as? String, let pct = dbl(row["pct"]) else { return nil }
        return MuscleBit(key: key, name: (row["name"] as? String) ?? key, pct: pct)
    }
    let snap = Snap(
        done: num(root["done"]) ?? num(week?["done"]),
        target: num(root["target"]) ?? num(week?["target"]),
        planned: num(root["planned"]) ?? num(week?["planned"]),
        score: dbl(root["score"]) ?? dbl(score?["total"]),
        delta: dbl(root["delta"]) ?? dbl(score?["delta"]),
        sessions: sessions,
        nextKey: root["nextKey"] as? String,
        muscles: muscles,
        figure: (root["figure"] as? String) ?? (rec?["figure"] as? String) ?? "man",
        kcal: num(root["kcal"]) ?? num(food?["kcal"]),
        kcalTarget: num(root["kcalTarget"]) ?? num(food?["target"]),
        maintenance: num(root["maintenance"]) ?? num(food?["maintenance"]),
        rmr: num(root["rmr"]) ?? num(food?["rmr"]),
        tone: (root["tone"] as? String) ?? (food?["tone"] as? String)
    )
    let empty = snap.done == nil && snap.target == nil && snap.score == nil && snap.sessions.isEmpty && snap.muscles.isEmpty && snap.kcal == nil
    return empty ? nil : snap
}

private enum Store {
    static func load() -> Snap? {
        let defaults = UserDefaults(suiteName: appGroup)
        if let data = defaults?.data(forKey: "widget"), let snap = parse(data) { return snap }
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        for name in ["widget.json", "phone-snapshot.json"] {
            if let data = try? Data(contentsOf: base.appendingPathComponent(name)), let snap = parse(data) { return snap }
        }
        return nil
    }
}

private struct Entry: TimelineEntry {
    let date: Date
    let snap: Snap?
}

private struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), snap: sample) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), snap: Store.load() ?? (context.isPreview ? sample : nil)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [Entry(date: Date(), snap: Store.load())], policy: .after(next)))
    }
}

private let sample = Snap(
    done: 2, target: 4, planned: 4, score: 7.4, delta: 0.3,
    sessions: [Sess(key: "a", name: "Full Body A", minutes: 45, done: false, titles: ["Squat", "Bankdrukken"])],
    nextKey: "a",
    muscles: [MuscleBit(key: "pecs", name: "Borst", pct: 42)],
    figure: "man", kcal: 1460, kcalTarget: 1900, maintenance: 2400, rmr: 1680, tone: "ok"
)

private func recoveryColor(_ pct: Double) -> Color {
    let f = 100 - min(100, max(0, pct))
    if f < 20 { return ok }
    if f <= 75 { return mix(ok, accent, (f - 20) / 55) }
    if f <= 100 { return mix(accent, warn, (f - 75) / 25) }
    return warn
}

private func mix(_ a: Color, _ b: Color, _ t: Double) -> Color {
    let u = min(1, max(0, t))
    let ar = UIColor(a), br = UIColor(b)
    var arR: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
    var brR: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
    ar.getRed(&arR, green: &ag, blue: &ab, alpha: &aa)
    br.getRed(&brR, green: &bg, blue: &bb, alpha: &ba)
    return Color(red: Double(arR + (brR - arR) * u), green: Double(ag + (bg - ag) * u), blue: Double(ab + (bb - ab) * u))
}

private func toneColor(_ tone: String?) -> Color {
    switch tone {
    case "bad": return warn
    case "warn": return bmrGold
    default: return ok
    }
}

private func home(_ family: WidgetFamily) -> Bool {
    family == .systemSmall || family == .systemMedium || family == .systemLarge
}

private extension View {
    @ViewBuilder
    func gymBackground(_ family: WidgetFamily) -> some View {
        if home(family) {
            containerBackground(for: .widget) { card }
        } else {
            containerBackground(for: .widget) { AccessoryWidgetBackground() }
        }
    }
}

private struct RowItem {
    var label: String
    var value: String
    var color: Color = ink
}

private struct EvpCard: View {
    var kicker: String
    var hero: String
    var unit: String
    var rows: [RowItem]
    var strip: String
    var wide: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(kicker).font(.caption2.weight(.bold)).foregroundStyle(accent).lineLimit(1)
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(hero)
                        .font(.system(size: wide ? 42 : 34, weight: .bold))
                        .foregroundStyle(ink)
                        .minimumScaleFactor(0.4)
                        .lineLimit(1)
                    if !unit.isEmpty {
                        Text(unit).font(.caption).foregroundStyle(muted).lineLimit(1)
                    }
                }
                if wide {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(rows.prefix(4).enumerated()), id: \.offset) { _, row in
                            HStack(spacing: 8) {
                                Text(row.label).font(.caption).foregroundStyle(muted).lineLimit(1)
                                Spacer(minLength: 4)
                                Text(row.value).font(.caption.weight(.semibold)).foregroundStyle(row.color).lineLimit(1).minimumScaleFactor(0.7)
                            }
                        }
                    }
                }
            }
            if !wide {
                VStack(alignment: .leading, spacing: 1) {
                    ForEach(Array(rows.prefix(3).enumerated()), id: \.offset) { _, row in
                        Text("\(row.label)  \(row.value)").font(.caption2).foregroundStyle(muted).lineLimit(1)
                    }
                }
            }
            if !strip.isEmpty {
                Text(strip).font(.caption2.weight(.semibold)).foregroundStyle(accent).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct RecoveryFigure: View {
    var muscles: [MuscleBit]
    var figure: String

    var body: some View {
        Canvas { ctx, size in
            let shapes = BodyShapes.make(figure.isEmpty ? "man" : figure)
            let vb = CGSize(width: 400, height: 424)
            let s = min(size.width / vb.width, size.height / vb.height)
            let ox = (size.width - vb.width * s) / 2
            let oy = (size.height - vb.height * s) / 2
            let byKey = Dictionary(muscles.map { ($0.key, $0.pct) }, uniquingKeysWith: { a, _ in a })
            func paint(_ parts: [(String, String)], _ base: [String], _ dx: CGFloat) {
                for d in base {
                    ctx.fill(BodyShapes.path(d, scale: s, ox: ox + dx * s, oy: oy), with: .color(Color.white.opacity(0.08)))
                }
                for (key, d) in parts {
                    let path = BodyShapes.path(d, scale: s, ox: ox + dx * s, oy: oy)
                    ctx.fill(path, with: .color(byKey[key].map(recoveryColor) ?? Color.white.opacity(0.16)))
                    ctx.stroke(path, with: .color(Color(red: 0.07, green: 0.07, blue: 0.08)), lineWidth: max(0.6, 1.1 * s))
                }
            }
            paint(shapes.front, shapes.base, 0)
            paint(shapes.back, shapes.base, 200)
        }
        .aspectRatio(400 / 424, contentMode: .fit)
    }
}

private func txt(_ n: Int?) -> String { n.map(String.init) ?? "—" }

private func nextSession(_ snap: Snap) -> Sess? {
    if let key = snap.nextKey, let hit = snap.sessions.first(where: { $0.key == key }) { return hit }
    return snap.sessions.first { !$0.done } ?? snap.sessions.last
}

private struct ScoreView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let text = snap?.score.map { String(format: "%.1f", $0) } ?? "—"
        Group {
            if home(family) {
                EvpCard(
                    kicker: "GEZONDHEID",
                    hero: text,
                    unit: "van 10",
                    rows: [
                        RowItem(label: "4 weken", value: delta, color: accent),
                        RowItem(label: "stand", value: snap?.score == nil ? "open de app" : "hoger is beter"),
                    ],
                    strip: snap == nil ? "Open GymCoach Sync" : "",
                    wide: family != .systemSmall
                )
            } else if family == .accessoryInline {
                Text("Score \(text)")
            } else if family == .accessoryCircular {
                Text(text).font(.headline).minimumScaleFactor(0.5)
            } else {
                VStack(alignment: .leading) {
                    Text("Score").font(.caption2)
                    Text(text).font(.headline)
                }
            }
        }
        .gymBackground(family)
    }

    private var delta: String {
        guard let d = snap?.delta else { return "—" }
        return (d > 0 ? "+" : "") + String(format: "%.1f", d)
    }
}

private struct WeekView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let done = txt(snap?.done)
        let target = txt(snap?.target)
        let names = (snap?.sessions ?? []).prefix(4).map { ($0.done ? "●" : "○") + " " + $0.name }.joined(separator: "  ")
        Group {
            if home(family) {
                EvpCard(
                    kicker: "WEEKDOEL",
                    hero: "\(done)/\(target)",
                    unit: "trainingen",
                    rows: [
                        RowItem(label: "gedaan", value: done, color: accent),
                        RowItem(label: "doel", value: target),
                        RowItem(label: "gepland", value: txt(snap?.planned)),
                    ],
                    strip: names.isEmpty ? (snap == nil ? "Open GymCoach Sync" : "geen trainingen") : names,
                    wide: family != .systemSmall
                )
            } else if family == .accessoryInline {
                Text("Week \(done)/\(target)")
            } else if family == .accessoryCircular {
                Text("\(done)/\(target)").font(.headline).minimumScaleFactor(0.4)
            } else {
                VStack(alignment: .leading) {
                    Text("Weekdoel").font(.caption2)
                    Text("\(done)/\(target)").font(.headline)
                }
            }
        }
        .gymBackground(family)
    }
}

private struct MuscleView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let tired = snap?.muscles.min { $0.pct < $1.pct }
        let points = tired.map { Int((100 - $0.pct).rounded()) }
        Group {
            if family == .systemMedium || family == .systemLarge {
                HStack(spacing: 8) {
                    RecoveryFigure(muscles: snap?.muscles ?? [], figure: snap?.figure ?? "man")
                        .frame(maxWidth: family == .systemLarge ? 160 : 100)
                    EvpCard(
                        kicker: "SPIEREN",
                        hero: points.map(String.init) ?? "—",
                        unit: "punten",
                        rows: [
                            RowItem(label: "meest", value: tired?.name ?? "—", color: tired.map { recoveryColor($0.pct) } ?? muted),
                            RowItem(label: "groepen", value: txt(snap?.muscles.count)),
                        ],
                        strip: (snap?.muscles ?? []).prefix(3).map(\.name).joined(separator: " · "),
                        wide: true
                    )
                }
            } else if family == .systemSmall {
                EvpCard(
                    kicker: "SPIEREN",
                    hero: points.map(String.init) ?? "—",
                    unit: tired?.name ?? "vermoeid",
                    rows: [RowItem(label: "punten", value: points.map(String.init) ?? "—", color: accent)],
                    strip: "",
                    wide: false
                )
            } else if family == .accessoryInline {
                Text("Spier \(tired?.name ?? "—")")
            } else if family == .accessoryCircular {
                Text(points.map(String.init) ?? "—").font(.headline)
            } else {
                HStack {
                    RecoveryFigure(muscles: snap?.muscles ?? [], figure: snap?.figure ?? "man").frame(width: 44)
                    Text(tired?.name ?? "—").font(.caption).lineLimit(2)
                }
            }
        }
        .gymBackground(family)
    }
}

private struct TodayView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let session = snap.flatMap(nextSession)
        let minutes = txt(session?.minutes)
        Group {
            if home(family) {
                EvpCard(
                    kicker: "VANDAAG",
                    hero: session == nil ? "—" : minutes,
                    unit: session == nil ? "geen plan" : "min",
                    rows: [
                        RowItem(label: "training", value: session?.name ?? "—", color: ink),
                        RowItem(label: "stand", value: session?.done == true ? "gedaan" : (session == nil ? "—" : "volgende"), color: accent),
                    ],
                    strip: (session?.titles ?? []).prefix(3).joined(separator: " · "),
                    wide: family != .systemSmall
                )
            } else if family == .accessoryInline {
                Text("Vandaag: \(session?.name ?? "—")")
            } else {
                VStack(alignment: .leading) {
                    Text(session?.name ?? "—").font(.headline).lineLimit(1).minimumScaleFactor(0.6)
                    Text(session == nil ? "—" : "\(minutes) min").font(.caption2)
                }
            }
        }
        .gymBackground(family)
    }
}

private struct CalorieView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        Group {
            if home(family) {
                EvpCard(
                    kicker: "CALORIEËN",
                    hero: txt(snap?.kcal),
                    unit: "inname",
                    rows: [
                        RowItem(label: "streef", value: txt(snap?.kcalTarget), color: targetBlue),
                        RowItem(label: "onderhoud", value: txt(snap?.maintenance), color: need),
                        RowItem(label: "BMR", value: txt(snap?.rmr), color: bmrGold),
                    ],
                    strip: snap?.kcal == nil ? "Open GymCoach Sync" : "vandaag",
                    wide: family != .systemSmall
                )
            } else if family == .accessoryInline {
                Text("Inname \(txt(snap?.kcal)) · streef \(txt(snap?.kcalTarget))")
            } else if family == .accessoryCircular {
                Text(txt(snap?.kcal)).font(.headline).minimumScaleFactor(0.4)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Streef \(txt(snap?.kcalTarget))").font(.caption2)
                    Text("Onderhoud \(txt(snap?.maintenance))").font(.caption2)
                    Text("Inname \(txt(snap?.kcal))").font(.headline)
                }
            }
        }
        .gymBackground(family)
    }
}

private func widget<V: View>(_ name: String, _ about: String, kind: String, @ViewBuilder view: @escaping (Entry) -> V) -> some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in view(entry) }
        .configurationDisplayName(name)
        .description(about)
        .supportedFamilies(families)
}

struct ScoreWidget: Widget {
    var body: some WidgetConfiguration {
        widget("Gezondheidsscore", "Je score van 0 tot 10.", kind: "healthScore") { ScoreView(snap: $0.snap) }
    }
}
struct WeekGoalWidget: Widget {
    var body: some WidgetConfiguration {
        widget("Weekdoel", "Trainingen gedaan tegen het doel van deze week.", kind: "weekProgress") { WeekView(snap: $0.snap) }
    }
}
struct MuscleWidget: Widget {
    var body: some WidgetConfiguration {
        widget("Spierherstel", "Het lichaamsschema, gekleurd naar herstel.", kind: "muscleFatigue") { MuscleView(snap: $0.snap) }
    }
}
struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        widget("Training vandaag", "De volgende training uit het weekplan.", kind: "todaySession") { TodayView(snap: $0.snap) }
    }
}
struct CalorieWidget: Widget {
    var body: some WidgetConfiguration {
        widget("Calorieën", "Inname, streef, onderhoud en BMR van vandaag.", kind: "calorieDeficit") { CalorieView(snap: $0.snap) }
    }
}

@main
struct GymCoachWidgets: WidgetBundle {
    var body: some Widget {
        ScoreWidget()
        WeekGoalWidget()
        MuscleWidget()
        TodayWidget()
        CalorieWidget()
    }
}
