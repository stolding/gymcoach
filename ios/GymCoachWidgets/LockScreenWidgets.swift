import WidgetKit
import SwiftUI
import UIKit

private let appGroup = "group.com.stolding.gymcoachsync"
private let snapshotName = "phone-snapshot.json"

private let ink = Color(red: 0.925, green: 0.922, blue: 0.906)
private let muted = Color(red: 0.604, green: 0.612, blue: 0.631)
private let card = Color(red: 0.102, green: 0.106, blue: 0.118)
private let accent = Color(red: 1, green: 0.478, blue: 0.180)
private let ok = Color(red: 0.298, green: 0.761, blue: 0.416)
private let warn = Color(red: 1, green: 0.420, blue: 0.420)
private let targetBlue = Color(red: 0.424, green: 0.612, blue: 1)
private let need = Color(red: 0.906, green: 0.922, blue: 0.949)
private let bmrGold = Color(red: 0.878, green: 0.765, blue: 0.416)
private let track = Color.white.opacity(0.12)

private let families: [WidgetFamily] = [
    .systemSmall, .systemMedium, .systemLarge,
    .accessoryCircular, .accessoryRectangular, .accessoryInline,
]

/// Zelfde type als het hoofdscherm, zodat BodyFigure.swift in deze extensie compileert.
struct PhoneScore: Codable, Identifiable {
    var key: String
    var value: Double
    var id: String { key }
}

private struct DayKcal: Decodable {
    var intake: Int?
    var target: Int?
    var maintenance: Int?
    var rmr: Int?
}

private struct ExTitle: Decodable { var title: String? }

private struct Sess: Decodable {
    var key: String?
    var name: String?
    var minutes: Int?
    var done: Bool?
    var exercises: [ExTitle]?
}

private struct Muscle: Decodable {
    var key: String?
    var name: String?
    var pct: Double?
}

private struct Snap: Decodable {
    struct Week: Decodable { var done: Int?; var target: Int?; var planned: Int? }
    struct Score: Decodable { var total: Double?; var delta: Double? }
    struct Rec: Decodable { var muscles: [Muscle]?; var figure: String? }
    struct Food: Decodable {
        var kcal: Int?
        var target: Int?
        var maintenance: Int?
        var rmr: Int?
        var tone: String?
        var spark: [DayKcal]?
    }

    var week: Week?
    var score: Score?
    var sessions: [Sess]?
    var nextKey: String?
    var muscleRecovery: Rec?
    var food: Food?

    static let sample = Snap(
        week: Week(done: 2, target: 4, planned: 4),
        score: Score(total: 7.4, delta: 0.3),
        sessions: [Sess(key: "a", name: "Full Body A", minutes: 45, done: false, exercises: [ExTitle(title: "Squat"), ExTitle(title: "Bankdrukken")])],
        nextKey: "a",
        muscleRecovery: Rec(muscles: [Muscle(key: "pecs", name: "Borst", pct: 42), Muscle(key: "quads", name: "Quads", pct: 78)], figure: "man"),
        food: Food(kcal: 1460, target: 1900, maintenance: 2400, rmr: 1680, tone: "ok", spark: nil)
    )
}

private enum Store {
    static func load() -> Snap? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        guard let data = try? Data(contentsOf: base.appendingPathComponent(snapshotName)) else { return nil }
        return try? JSONDecoder().decode(Snap.self, from: data)
    }
}

private struct Entry: TimelineEntry {
    let date: Date
    let snap: Snap?
}

private struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), snap: .sample) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        let snap = Store.load() ?? (context.isPreview ? .sample : nil)
        completion(Entry(date: Date(), snap: snap))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [Entry(date: Date(), snap: Store.load())], policy: .after(next)))
    }
}

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
    case "ok": return ok
    default: return accent
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

private struct RecoveryFigure: View {
    var muscles: [Muscle]
    var figure: String

    var body: some View {
        Canvas { ctx, size in
            let shapes = BodyShapes.make(figure.isEmpty ? "man" : figure)
            let vb = CGSize(width: 400, height: 424)
            let s = min(size.width / vb.width, size.height / vb.height)
            let ox = (size.width - vb.width * s) / 2
            let oy = (size.height - vb.height * s) / 2
            let byKey = Dictionary(muscles.compactMap { m -> (String, Double)? in
                guard let k = m.key, let p = m.pct else { return nil }
                return (k, p)
            }, uniquingKeysWith: { a, _ in a })
            func paint(_ parts: [(String, String)], _ base: [String], _ dx: CGFloat) {
                for d in base {
                    ctx.fill(BodyShapes.path(d, scale: s, ox: ox + dx * s, oy: oy), with: .color(Color.white.opacity(0.08)))
                }
                for (key, d) in parts {
                    let path = BodyShapes.path(d, scale: s, ox: ox + dx * s, oy: oy)
                    let color = byKey[key].map(recoveryColor) ?? Color.white.opacity(0.16)
                    ctx.fill(path, with: .color(color))
                    ctx.stroke(path, with: .color(Color(red: 0.07, green: 0.07, blue: 0.08)), lineWidth: max(0.6, 1.1 * s))
                }
            }
            paint(shapes.front, shapes.base, 0)
            paint(shapes.back, shapes.base, 200)
        }
        .aspectRatio(400 / 424, contentMode: .fit)
    }
}

private struct WeekRing: View {
    var done: Int
    var target: Int
    var planned: Int
    var diameter: CGFloat = 76

    var body: some View {
        let goal = target > 0 ? min(1, CGFloat(done) / CGFloat(target)) : 0
        let extraN = max(0, done - target)
        let room = max(0, (planned > 0 ? planned : target) - target)
        let extraF: CGFloat = extraN == 0 ? 0 : room > 0 ? min(1, CGFloat(extraN) / CGFloat(room)) : (target > 0 ? min(1, CGFloat(extraN) / CGFloat(target)) : 0)
        let over = extraF > 0
        let inner = diameter * (over ? 0.86 : 1)
        ZStack {
            Circle().stroke(track, lineWidth: over ? 4 : 8).frame(width: inner, height: inner)
            Circle()
                .trim(from: 0, to: goal)
                .stroke(accent, style: StrokeStyle(lineWidth: over ? 4 : 8, lineCap: .round))
                .frame(width: inner, height: inner)
                .rotationEffect(.degrees(-90))
            if over {
                Circle().stroke(track, lineWidth: 4).frame(width: diameter, height: diameter)
                Circle()
                    .trim(from: 0, to: extraF)
                    .stroke(Color(red: 1, green: 0.70, blue: 0.35), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .frame(width: diameter, height: diameter)
                    .rotationEffect(.degrees(-90))
            }
            Text("\(done)/\(target)")
                .font(.headline.monospacedDigit())
                .foregroundStyle(ink)
                .minimumScaleFactor(0.5)
        }
        .frame(width: diameter + 8, height: diameter + 8)
    }
}

private struct SessionDots: View {
    var sessions: [Sess]
    var body: some View {
        HStack(spacing: 5) {
            ForEach(Array(sessions.prefix(8).enumerated()), id: \.offset) { _, s in
                Circle()
                    .fill(s.done == true ? accent : Color.clear)
                    .overlay(Circle().stroke(s.done == true ? accent : muted, lineWidth: 1.5))
                    .frame(width: 8, height: 8)
            }
        }
    }
}

private func nextSession(_ snap: Snap?) -> Sess? {
    guard let snap, let list = snap.sessions, !list.isEmpty else { return nil }
    if let key = snap.nextKey, let hit = list.first(where: { $0.key == key }) { return hit }
    return list.first { $0.done != true } ?? list.last
}

private struct ScoreView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let total = snap?.score?.total
        let text = total.map { String(format: "%.1f", $0) } ?? "—"
        Group {
            switch family {
            case .accessoryInline:
                Text("Score \(text)")
            case .accessoryCircular:
                Gauge(value: min(10, max(0, total ?? 0)), in: 0...10) { Text("Score") } currentValueLabel: { Text(text).minimumScaleFactor(0.5) }
                    .gaugeStyle(.accessoryCircular)
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text("Gezondheid").font(.caption2)
                    Text(text).font(.headline)
                    Text("van 10").font(.caption2)
                }
            case .systemLarge:
                VStack(alignment: .leading, spacing: 8) {
                    Text("Gezondheidsscore").font(.caption).foregroundStyle(muted)
                    Text(text).font(.system(size: 56, weight: .bold, design: .rounded)).foregroundStyle(ink).minimumScaleFactor(0.5)
                    Text(deltaLine).font(.title3).foregroundStyle(accent)
                    Text("van 10, hoger is beter").font(.body).foregroundStyle(muted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            default:
                VStack(alignment: .leading, spacing: 4) {
                    Text("Gezondheidsscore").font(.caption).foregroundStyle(muted).lineLimit(1)
                    Text(text).font(.system(size: family == .systemMedium ? 44 : 36, weight: .bold, design: .rounded)).foregroundStyle(ink)
                    Text(deltaLine).font(.subheadline).foregroundStyle(accent).lineLimit(1)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .gymBackground(family)
    }

    private var deltaLine: String {
        guard let d = snap?.score?.delta else { return snap == nil ? "Open GymCoach" : "van 10" }
        let sign = d > 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", d)) in 4 weken"
    }
}

private struct WeekView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let done = snap?.week?.done ?? 0
        let target = snap?.week?.target ?? 0
        let planned = snap?.week?.planned ?? target
        Group {
            switch family {
            case .accessoryInline:
                Text("Week \(done)/\(target)")
            case .accessoryCircular:
                WeekRing(done: done, target: target, planned: planned, diameter: 36)
            case .accessoryRectangular:
                HStack {
                    WeekRing(done: done, target: target, planned: planned, diameter: 36)
                    VStack(alignment: .leading) {
                        Text("Weekdoel").font(.caption2)
                        Text("\(done) van \(target)").font(.headline).minimumScaleFactor(0.6)
                    }
                }
            case .systemSmall:
                VStack(spacing: 4) {
                    WeekRing(done: done, target: target, planned: planned, diameter: 78)
                    Text("Weekdoel").font(.caption.weight(.semibold)).foregroundStyle(muted)
                    SessionDots(sessions: snap?.sessions ?? [])
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            default:
                HStack(spacing: 16) {
                    WeekRing(done: done, target: target, planned: planned, diameter: family == .systemLarge ? 120 : 88)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Weekdoel").font(.caption.weight(.semibold)).foregroundStyle(muted)
                        Text("\(done) van \(target)").font(.title2.weight(.semibold)).foregroundStyle(ink)
                        Text(planned > 0 ? "\(planned) gepland" : "deze week").font(.subheadline).foregroundStyle(muted)
                        SessionDots(sessions: snap?.sessions ?? [])
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .gymBackground(family)
    }
}

private struct MuscleView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let muscles = snap?.muscleRecovery?.muscles ?? []
        let tired = muscles.min { ($0.pct ?? 100) < ($1.pct ?? 100) }
        let name = tired?.name ?? (snap == nil ? "Open GymCoach" : "Nog geen sets")
        let pct = tired?.pct
        Group {
            switch family {
            case .accessoryInline:
                Text("Herstel \(name)")
            case .accessoryCircular:
                Gauge(value: min(100, max(0, 100 - (pct ?? 100))) / 100) { Text("Spier") } currentValueLabel: {
                    Text(pct.map { "\(Int((100 - $0).rounded()))" } ?? "—").minimumScaleFactor(0.5)
                }
                .gaugeStyle(.accessoryCircular)
                .tint(pct.map(recoveryColor) ?? muted)
            case .accessoryRectangular:
                HStack(spacing: 6) {
                    RecoveryFigure(muscles: muscles, figure: snap?.muscleRecovery?.figure ?? "man").frame(width: 52)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Spierherstel").font(.caption2)
                        Text(name).font(.headline).lineLimit(1).minimumScaleFactor(0.6)
                    }
                }
            case .systemSmall:
                VStack(spacing: 2) {
                    Text("Spierherstel").font(.caption2).foregroundStyle(muted)
                    RecoveryFigure(muscles: muscles, figure: snap?.muscleRecovery?.figure ?? "man")
                }
            default:
                HStack(spacing: 8) {
                    RecoveryFigure(muscles: muscles, figure: snap?.muscleRecovery?.figure ?? "man")
                        .frame(maxWidth: family == .systemLarge ? 220 : 150)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Spierherstel").font(.caption).foregroundStyle(muted)
                        Text(name).font(.title3.weight(.semibold)).foregroundStyle(ink).lineLimit(2)
                        if let pct {
                            Text("\(Int((100 - pct).rounded())) punten vermoeid").font(.subheadline).foregroundStyle(recoveryColor(pct))
                        }
                    }
                    Spacer(minLength: 0)
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
        let session = nextSession(snap)
        let name = session?.name ?? (snap == nil ? "Open GymCoach" : "Geen plan")
        let detail = session?.minutes.map { "\($0) min" } ?? (session?.done == true ? "gedaan" : "volgende")
        let titles = (session?.exercises ?? []).compactMap(\.title).filter { !$0.isEmpty }
        Group {
            switch family {
            case .accessoryInline:
                Text("Vandaag: \(name)")
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Text(detail).font(.caption2).minimumScaleFactor(0.5)
                    Text(initials(name)).font(.headline).minimumScaleFactor(0.5)
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text("Vandaag").font(.caption2)
                    Text(name).font(.headline).lineLimit(1).minimumScaleFactor(0.6)
                    Text(detail).font(.caption2)
                }
            case .systemLarge:
                VStack(alignment: .leading, spacing: 8) {
                    Text("Training vandaag").font(.caption).foregroundStyle(muted)
                    Text(name).font(.largeTitle.weight(.semibold)).foregroundStyle(ink).minimumScaleFactor(0.5).lineLimit(2)
                    Text(detail).font(.title3).foregroundStyle(accent)
                    if !titles.isEmpty {
                        Text(titles.prefix(4).joined(separator: " · ")).font(.body).foregroundStyle(muted).lineLimit(3)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            default:
                VStack(alignment: .leading, spacing: 4) {
                    Text("Training vandaag").font(.caption).foregroundStyle(muted).lineLimit(1)
                    Text(name).font(.title2.weight(.semibold)).foregroundStyle(ink).minimumScaleFactor(0.55).lineLimit(2)
                    Text(detail).font(.body).foregroundStyle(accent)
                    if family == .systemMedium, !titles.isEmpty {
                        Text(titles.prefix(3).joined(separator: " · ")).font(.caption).foregroundStyle(muted).lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .gymBackground(family)
    }
}

private struct KcalBars: View {
    var food: Snap.Food?
    var tall: Bool

    var body: some View {
        let rows: [(String, Int?, Color)] = [
            ("Inname", food?.kcal, toneColor(food?.tone)),
            ("Streef", food?.target, targetBlue),
            ("Onderhoud", food?.maintenance, need),
            ("BMR", food?.rmr, bmrGold),
        ]
        let shown = rows.filter { $0.1 != nil }
        let maxV = max(1, shown.compactMap(\.1).max() ?? 1)
        VStack(alignment: .leading, spacing: tall ? 6 : 3) {
            ForEach(Array(shown.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 6) {
                    Text(row.0).font(.caption2).foregroundStyle(muted).frame(width: tall ? 72 : 58, alignment: .leading).lineLimit(1)
                    GeometryReader { geo in
                        Capsule().fill(row.2).frame(width: geo.size.width * CGFloat(row.1 ?? 0) / CGFloat(maxV))
                    }
                    .frame(height: tall ? 8 : 6)
                    Text("\(row.1 ?? 0)").font(.caption2.monospacedDigit()).foregroundStyle(ink)
                }
            }
        }
    }
}

private struct CalorieView: View {
    @Environment(\.widgetFamily) private var family
    let snap: Snap?

    var body: some View {
        let food = snap?.food
        let intake = food?.kcal.map(String.init) ?? "—"
        Group {
            switch family {
            case .accessoryInline:
                Text("Inname \(intake) · streef \(food?.target.map(String.init) ?? "—")")
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Text("kcal").font(.caption2)
                    Text(intake).font(.headline).minimumScaleFactor(0.4)
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 0) {
                    Text("Streef \(food?.target.map(String.init) ?? "—")").font(.caption2)
                    Text("Onderhoud \(food?.maintenance.map(String.init) ?? "—")").font(.caption2)
                    Text("Inname \(intake)").font(.headline)
                }
            case .systemSmall:
                VStack(alignment: .leading, spacing: 4) {
                    Text("Calorieën").font(.caption).foregroundStyle(muted)
                    Text(intake).font(.title.weight(.bold)).foregroundStyle(ink).minimumScaleFactor(0.6)
                    Text("streef \(food?.target.map(String.init) ?? "—")").font(.caption).foregroundStyle(targetBlue)
                    Text("onderhoud \(food?.maintenance.map(String.init) ?? "—")").font(.caption2).foregroundStyle(need).lineLimit(1)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            default:
                VStack(alignment: .leading, spacing: 8) {
                    Text("Calorieën vandaag").font(.caption).foregroundStyle(muted)
                    KcalBars(food: food, tall: family == .systemLarge)
                    if family == .systemLarge, let rmr = food?.rmr {
                        Text("BMR \(rmr) kcal").font(.caption).foregroundStyle(bmrGold)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .gymBackground(family)
    }
}

private func initials(_ name: String) -> String {
    let letters = name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined()
    return letters.isEmpty ? "·" : letters
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
