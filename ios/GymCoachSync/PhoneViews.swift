import SwiftUI

enum PhoneChrome {
    static let bg = Color(red: 0.059, green: 0.063, blue: 0.071)
    static let card = Color(white: 0.12)
    static let ink = Color(red: 0.925, green: 0.922, blue: 0.906)
}

struct PhoneCard<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(PhoneChrome.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct StaleBanner: View {
    @EnvironmentObject var phone: PhoneModel
    var body: some View {
        if phone.stale {
            Text("Geen verbinding. Dit is de laatst bekende stand.")
                .font(.footnote)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Color.orange.opacity(0.22), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }
}

struct Sparkline: View {
    var values: [Double]
    var body: some View {
        GeometryReader { geo in
            let lo = values.min() ?? 0
            let hi = values.max() ?? 1
            let span = max(hi - lo, 0.001)
            Path { p in
                for (i, v) in values.enumerated() {
                    let x = geo.size.width * CGFloat(i) / CGFloat(max(values.count - 1, 1))
                    let y = geo.size.height * (1 - CGFloat((v - lo) / span))
                    if i == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(Color(red: 1, green: 0.48, blue: 0.18), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
        .frame(height: 44)
    }
}

struct SessionCard: View {
    var session: PhoneSession
    var expanded: Bool
    var toggle: (() -> Void)? = nil

    var body: some View {
        PhoneCard {
            if let toggle {
                Button(action: toggle) { header(chevron: true) }.buttonStyle(.plain)
            } else {
                header(chevron: false)
            }
            if expanded { bodyList }
        }
    }

    private func header(chevron: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Image(systemName: session.done ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(session.done ? Color.green : .secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(session.name).font(.headline).foregroundStyle(PhoneChrome.ink).multilineTextAlignment(.leading)
                HStack(spacing: 8) {
                    if let m = session.minutes { Text("\(m) min") }
                    if session.done, !session.doneDate.isEmpty { Text(session.doneDate) }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if chevron {
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder private var bodyList: some View {
        if session.outdoor {
            Text(session.advice.isEmpty ? "Buiten." : session.advice)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else if session.exercises.isEmpty {
            Text("Geen oefeningen in deze training.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            ForEach(session.exercises, id: \.index) { e in
                VStack(alignment: .leading, spacing: 4) {
                    Text(e.title).font(.subheadline.weight(.semibold))
                    HStack(spacing: 8) {
                        if !e.muscle.isEmpty { Text(e.muscle) }
                        if !e.summary.isEmpty { Text(e.summary) }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    if !e.note.isEmpty {
                        Text(e.note).font(.caption).foregroundStyle(.secondary)
                    }
                    ForEach(Array(e.sets.enumerated()), id: \.offset) { i, set in
                        HStack {
                            Text("\(i + 1)").foregroundStyle(.secondary).frame(width: 18, alignment: .leading)
                            Text(set.text).textSelection(.enabled)
                            Spacer(minLength: 8)
                            if let rest = set.rest { Text("\(rest) s").foregroundStyle(.secondary) }
                        }
                        .font(.subheadline.monospacedDigit())
                    }
                }
                .padding(.top, 8)
            }
        }
    }
}

struct DashboardView: View {
    @EnvironmentObject var phone: PhoneModel
    var openPlan: () -> Void

    private let orange = Color(red: 1, green: 0.48, blue: 0.18)

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(alignment: .leading, spacing: 12) {
                        StaleBanner()
                        Text(snap.name.isEmpty ? snap.today : snap.name).font(.title2.weight(.semibold))
                        Text(snap.today).font(.subheadline).foregroundStyle(.secondary)
                        recoveryCard(snap)
                        nextCard(snap)
                        statGrid(snap)
                        goalCard(snap)
                        weekPlanCard(snap)
                    }
                    .padding(16)
                }
            }
            .background(PhoneChrome.bg.ignoresSafeArea())
            .navigationTitle("Overzicht")
            .refreshable { await phone.refresh() }
        }
    }

    @ViewBuilder private func recoveryCard(_ snap: PhoneSnapshot) -> some View {
        if let rec = snap.recovery {
            PhoneCard {
                Text("Herstel").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text(rec.label).font(.title3.weight(.semibold)).foregroundStyle(recoveryColor(rec.state))
                if !rec.detail.isEmpty { Text(rec.detail).font(.subheadline) }
                if !rec.note.isEmpty { Text(rec.note).font(.footnote).foregroundStyle(.secondary) }
            }
        }
    }

    @ViewBuilder private func nextCard(_ snap: PhoneSnapshot) -> some View {
        HStack(alignment: .top, spacing: 12) {
            PhoneCard {
                Text("Volgende training").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                if let s = snap.sessions.first(where: { $0.key == snap.nextKey }) {
                    Text(s.name).font(.title3.weight(.semibold))
                    metaLine(s, snap)
                    if s.outdoor {
                        Text(s.advice.isEmpty ? "Buiten." : s.advice).font(.subheadline).foregroundStyle(.secondary)
                    } else {
                        VStack(alignment: .leading, spacing: 2) {
                            ForEach(Array(s.exercises.prefix(6).enumerated()), id: \.offset) { i, e in
                                Text("\(i + 1). \(e.title)").font(.subheadline).lineLimit(1)
                            }
                        }
                    }
                    Button("Bekijk in plan", action: openPlan).font(.subheadline)
                } else if snap.sessions.isEmpty {
                    Text("Er staat nog geen weekplan. Dat maak je op de computer.").foregroundStyle(.secondary)
                } else {
                    Text("Deze week staat alles op gedaan.").font(.headline)
                }
            }
            weekRing(snap.week)
        }
    }

    private func metaLine(_ s: PhoneSession, _ snap: PhoneSnapshot) -> some View {
        HStack(spacing: 8) {
            if let m = s.minutes { Text("~\(m) min") }
            if !s.outdoor { Text("\(s.exercises.count) oefeningen") }
            if !snap.weekPlan.goal.isEmpty { Text(snap.weekPlan.goal) }
            if s.onDevice { Text("op toestel").font(.caption.weight(.semibold)).padding(.horizontal, 6).padding(.vertical, 2).background(Color.green.opacity(0.2), in: Capsule()) }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func weekRing(_ week: PhoneWeek) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.12), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: week.target > 0 ? min(1, CGFloat(week.done) / CGFloat(week.target)) : 0)
                    .stroke(orange, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(week.done)/\(week.target)").font(.headline.monospacedDigit())
            }
            .frame(width: 84, height: 84)
            Text("Weekdoel").font(.caption2).foregroundStyle(.secondary)
            Text("deze week").font(.caption2).foregroundStyle(.secondary)
        }
        .frame(width: 96)
    }

    private func statGrid(_ snap: PhoneSnapshot) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            PhoneCard {
                Text("Streak").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text("\(snap.week.streak)").font(.title.monospacedDigit()) + Text(snap.week.streak == 1 ? " week" : " weken").font(.subheadline)
                Text("op rij je weekdoel gehaald").font(.caption2).foregroundStyle(.secondary)
            }
            PhoneCard {
                Text("Volume deze week").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text("\(phoneInt(snap.week.volume)) kg").font(.title3.monospacedDigit())
                Text(snap.week.volumeNote).font(.caption).foregroundStyle(.secondary)
            }
            PhoneCard {
                Text("Trainingstijd").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text("\(snap.week.minutes) min").font(.title3.monospacedDigit())
                Text("\(phoneInt(snap.week.kcal)) kcal deze week").font(.caption).foregroundStyle(.secondary)
            }
            PhoneCard {
                Text("Lichaamsgewicht").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                if let body = snap.body, let kg = body.kg {
                    Text(body.fat != nil ? "\(phoneKg(kg)) kg · \(phoneKg(body.fat ?? 0))% vet" : "\(phoneKg(kg)) kg")
                        .font(.title3.monospacedDigit())
                    Text(body.slopeNote).font(.caption).foregroundStyle(.secondary)
                    if body.spark.count > 1 { Sparkline(values: body.spark) }
                } else {
                    Text("Nog geen weging.").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder private func goalCard(_ snap: PhoneSnapshot) -> some View {
        if let goal = snap.goal {
            PhoneCard {
                Text("Doel").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text(goal.pace).font(.headline).foregroundStyle(paceColor(goal.paceState))
                ForEach(Array(goal.lines.enumerated()), id: \.offset) { _, line in
                    Text(line).font(.subheadline)
                }
                if let food = snap.food {
                    if let kcal = food.kcal, let target = food.target, target > 0 {
                        meter("\(phoneInt(kcal)) / \(phoneInt(target)) kcal", value: kcal, total: target)
                    }
                    if let protein = food.protein, let target = food.proteinTarget, target > 0 {
                        meter("\(phoneInt(protein)) / \(phoneInt(target)) g eiwit", value: protein, total: target)
                    }
                    if !food.line.isEmpty { Text(food.line).font(.footnote).foregroundStyle(.secondary) }
                }
            }
        }
    }

    private func meter(_ label: String, value: Int, total: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption.monospacedDigit())
            ProgressView(value: Double(value), total: Double(max(total, 1))).tint(orange)
        }
    }

    private func weekPlanCard(_ snap: PhoneSnapshot) -> some View {
        let plan = snap.weekPlan
        return PhoneCard {
            HStack {
                Text(plan.week > 0 ? "Plan deze week · week \(plan.week)" : "Plan deze week")
                    .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Button("Open plan", action: openPlan).font(.caption)
            }
            if snap.deload {
                Text("deload-week").font(.caption.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color.orange.opacity(0.25), in: Capsule())
            }
            if !plan.focus.isEmpty {
                Text(plan.focus.joined(separator: "  ·  ")).font(.caption).foregroundStyle(.secondary)
            }
            if plan.sessions > 0 {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    miniStat("Trainingen", "\(plan.sessions) × ~\(plan.avgMinutes) min")
                    miniStat("Werksets", "\(plan.sets) · \(plan.exercises) oef.")
                    miniStat("Gepland volume", "\(phoneInt(plan.volume)) kg")
                    miniStat("Zwaarder", "\(plan.heavier) oefeningen ↑")
                }
                ForEach(Array(plan.muscles.enumerated()), id: \.offset) { _, m in
                    HStack(spacing: 8) {
                        Text(m.name).font(.caption).frame(width: 110, alignment: .leading).lineLimit(1)
                        ProgressView(value: min(1.0, m.share)).tint(orange)
                        Text(phoneKg(m.value)).font(.caption.monospacedDigit()).frame(width: 36, alignment: .trailing)
                    }
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 108), spacing: 8)], alignment: .leading, spacing: 8) {
                    ForEach(snap.sessions) { s in
                        HStack(spacing: 4) {
                            if s.done { Image(systemName: "checkmark").font(.caption2) }
                            Text(s.name).lineLimit(1)
                            if s.superset { Text("superset").font(.caption2) }
                        }
                        .font(.caption)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background((s.done ? Color.green : Color.white).opacity(0.12), in: Capsule())
                    }
                }
            }
        }
    }

    private func miniStat(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.subheadline.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PlanView: View {
    @EnvironmentObject var phone: PhoneModel
    @State private var open: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(spacing: 12) {
                        StaleBanner()
                        if snap.sessions.isEmpty {
                            PhoneCard {
                                Text("Er staat nog geen weekplan. Dat maak je op de computer.")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        ForEach(snap.sessions) { s in
                            SessionCard(session: s, expanded: open == s.key) {
                                open = open == s.key ? nil : s.key
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .background(PhoneChrome.bg.ignoresSafeArea())
            .navigationTitle("Plan")
            .refreshable { await phone.refresh() }
            .onAppear { if open == nil { open = phone.snapshot?.nextKey } }
        }
    }
}

struct ProgressViewScreen: View {
    @EnvironmentObject var phone: PhoneModel

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(spacing: 12) {
                        StaleBanner()
                        if snap.progress.isEmpty && snap.records.isEmpty && snap.recent.isEmpty {
                            PhoneCard {
                                Text("Nog te weinig trainingen voor een lijn of een record.")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        ForEach(Array(snap.progress.enumerated()), id: \.offset) { _, p in
                            PhoneCard {
                                HStack {
                                    Text(p.name).font(.headline)
                                    Spacer()
                                    Text(signedPct(p.delta))
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(p.delta < 0 ? Color.orange : Color.green)
                                }
                                Text("\(phoneKg(p.e1rm)) kg 1RM").font(.subheadline).foregroundStyle(.secondary)
                                if p.spark.count > 1 { Sparkline(values: p.spark) }
                            }
                        }
                        if !snap.records.isEmpty {
                            PhoneCard {
                                Text("Records, 14 dagen").font(.subheadline.weight(.semibold))
                                ForEach(Array(snap.records.enumerated()), id: \.offset) { _, r in
                                    HStack {
                                        Text(r.name).font(.subheadline)
                                        Spacer()
                                        Text("\(phoneKg(r.e1rm)) kg").font(.subheadline.monospacedDigit())
                                    }
                                    Text(r.date).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        if !snap.recent.isEmpty {
                            PhoneCard {
                                Text("Laatste trainingen").font(.subheadline.weight(.semibold))
                                ForEach(Array(snap.recent.enumerated()), id: \.offset) { _, w in
                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text(w.title).font(.subheadline)
                                            Text(w.date).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if let m = w.minutes { Text("\(m) min").font(.subheadline).foregroundStyle(.secondary) }
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .background(PhoneChrome.bg.ignoresSafeArea())
            .navigationTitle("Voortgang")
            .refreshable { await phone.refresh() }
        }
    }
}

struct BodyView: View {
    @EnvironmentObject var phone: PhoneModel
    @State private var metric = "fat"
    @State private var range = "all"
    @State private var showMarks = true
    @State private var showTrend = true

    private let orange = Color(red: 1, green: 0.48, blue: 0.18)

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(alignment: .leading, spacing: 12) {
                        StaleBanner()
                        composition(snap.composition)
                        PhoneCard {
                            Text("Stappen vandaag").font(.subheadline.weight(.semibold))
                            Text(stepLine(snap.steps)).font(.title3.monospacedDigit())
                            ProgressView(value: Double(snap.steps.today ?? 0), total: Double(max(snap.steps.goal, 1)))
                                .tint(orange)
                        }
                    }
                    .padding(16)
                }
            }
            .background(PhoneChrome.bg.ignoresSafeArea())
            .navigationTitle("Lichaam")
            .refreshable { await phone.refresh() }
        }
    }

    @ViewBuilder private func composition(_ comp: PhoneComposition) -> some View {
        if comp.metrics.isEmpty {
            PhoneCard {
                Text("Nog geen weging. Die komt van de weegschaal of van Lichaam op de computer.")
                    .foregroundStyle(.secondary)
            }
        } else {
            HStack(alignment: .firstTextBaseline) {
                Text("Lichaamssamenstelling").font(.headline)
                Spacer()
                if !comp.measured.isEmpty {
                    Text(comp.measured).font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.trailing)
                }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(comp.metrics) { m in
                    Button { metric = m.key } label: { tile(m, on: chosen(comp).key == m.key) }
                        .buttonStyle(.plain)
                }
            }
            chartCard(comp)
        }
    }

    private func chosen(_ comp: PhoneComposition) -> PhoneMetric {
        comp.metrics.first { $0.key == metric } ?? comp.metrics[0]
    }

    private func tile(_ m: PhoneMetric, on: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(m.label).font(.caption2.weight(.semibold)).foregroundStyle(.secondary).lineLimit(1)
            Text("\(phoneKg(m.value)) \(m.unit)").font(.title3.monospacedDigit()).lineLimit(1).minimumScaleFactor(0.7)
            Text(deltaLine(m)).font(.caption2).foregroundStyle(deltaColor(m)).lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(PhoneChrome.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2).fill(zoneColor(m.zone)).frame(width: 3).padding(.vertical, 8)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(on ? orange : Color.white.opacity(0.08), lineWidth: on ? 1.5 : 1)
        }
    }

    private func deltaLine(_ m: PhoneMetric) -> String {
        guard let d = m.delta else { return " " }
        let n = (d > 0 ? "+" : "") + phoneKg(d)
        return m.since.isEmpty ? "\(n) \(m.unit)" : "\(n) \(m.unit) sinds \(m.since)"
    }

    private func deltaColor(_ m: PhoneMetric) -> Color {
        if m.better == true { return .green }
        if m.better == false { return Color(red: 1, green: 0.42, blue: 0.42) }
        return .secondary
    }

    private func zoneColor(_ zone: String) -> Color {
        switch zone {
        case "ok": return Color(red: 0.30, green: 0.76, blue: 0.42)
        case "warn": return Color(red: 0.90, green: 0.72, blue: 0.29)
        case "bad": return Color(red: 1, green: 0.42, blue: 0.42)
        default: return .clear
        }
    }

    private func chartCard(_ comp: PhoneComposition) -> some View {
        let m = chosen(comp)
        let visible = filtered(m.points, range: range)
        let trend = showTrend ? filtered(trendLine(m.points), range: range) : []
        let marks = showMarks ? comp.marks.filter { mark in visibleRange(mark.d, points: m.points, range: range) } : []
        let kinds = Set(marks.map(\.kind))
        return PhoneCard {
            Text("\(m.label) over tijd").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Picker("Periode", selection: $range) {
                Text("3 mnd").tag("3m")
                Text("Jaar").tag("1y")
                Text("Alles").tag("all")
            }
            .pickerStyle(.segmented)
            HStack(spacing: 8) {
                chartChip("Activiteiten", on: showMarks) { showMarks.toggle() }
                chartChip("Trendlijn", on: showTrend) { showTrend.toggle() }
            }
            if visible.count < 2 {
                Text("Geen metingen in deze periode.").font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 120)
            } else {
                CompChart(points: visible, trend: trend, marks: marks, legend: comp.legend, bands: m.bands)
                    .frame(height: 210)
            }
            if !m.note.isEmpty {
                Text(bandCaption(m) + m.note).font(.caption2).foregroundStyle(.secondary)
            }
            if showMarks && !kinds.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 108), spacing: 6)], alignment: .leading, spacing: 4) {
                    ForEach(comp.legend.filter { kinds.contains($0.kind) }) { item in
                        HStack(spacing: 4) {
                            Circle().fill(colorHex(item.color)).frame(width: 7, height: 7)
                            Text(item.label).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }
            }
        }
    }

    private func bandCaption(_ m: PhoneMetric) -> String {
        m.bands.isEmpty ? "" : "goed · let op · niet goed · "
    }

    private func chartChip(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Circle().fill(on ? orange : Color.white.opacity(0.25)).frame(width: 7, height: 7)
                Text(title).font(.caption)
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background((on ? orange : Color.white).opacity(on ? 0.16 : 0.06), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func stepLine(_ s: PhoneSteps) -> String {
        guard let today = s.today else { return "Nog geen stappen · doel \(phoneInt(s.goal))" }
        return "\(phoneInt(today)) / \(phoneInt(s.goal))"
    }
}

private func filtered(_ points: [PhonePoint], range: String) -> [PhonePoint] {
    guard let last = points.last?.d, let from = rangeStart(last, range) else { return points }
    return points.filter { $0.d >= from }
}

private func visibleRange(_ date: String, points: [PhonePoint], range: String) -> Bool {
    guard let last = points.last?.d, let first = filtered(points, range: range).first?.d else { return false }
    return date >= first && date <= last
}

private func rangeStart(_ last: String, _ range: String) -> String? {
    let days = range == "3m" ? 91 : range == "1y" ? 365 : 0
    guard days > 0 else { return nil }
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
    guard let date = PhoneDates.day(last), let from = cal.date(byAdding: .day, value: -days, to: date) else { return nil }
    return PhoneDates.text(from)
}

private func trendLine(_ points: [PhonePoint]) -> [PhonePoint] {
    guard points.count > 2 else { return [] }
    var start = 0
    var sum = 0.0
    return points.enumerated().map { i, p in
        sum += p.y
        let cut = PhoneDates.shift(p.d, days: -13) ?? p.d
        while points[start].d < cut {
            sum -= points[start].y
            start += 1
        }
        let y = (sum / Double(i - start + 1) * 100).rounded() / 100
        return PhonePoint(d: p.d, y: y)
    }
}

private enum PhoneDates {
    static let parser: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    static func day(_ s: String) -> Date? { parser.date(from: String(s.prefix(10))) }
    static func text(_ d: Date) -> String { parser.string(from: d) }
    static func shift(_ s: String, days: Int) -> String? {
        guard let d = day(s) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        guard let n = cal.date(byAdding: .day, value: days, to: d) else { return nil }
        return text(n)
    }
}

struct CompChart: View {
    var points: [PhonePoint]
    var trend: [PhonePoint]
    var marks: [PhoneMark]
    var legend: [PhoneLegend]
    var bands: [PhoneBand]

    var body: some View {
        Canvas { ctx, size in
            let gutter: CGFloat = marks.isEmpty ? 16 : 28
            let plot = CGRect(x: 0, y: 4, width: size.width, height: size.height - gutter)
            guard let first = PhoneDates.day(points[0].d), let last = PhoneDates.day(points[points.count - 1].d) else { return }
            let spanT = max(last.timeIntervalSince(first), 86400)
            let ys = points.map(\.y) + trend.map(\.y)
            let lo = (ys.min() ?? 0)
            let hi = (ys.max() ?? 1)
            let pad = max((hi - lo) * 0.08, 0.05)
            let y0 = lo - pad, y1 = hi + pad
            let spanY = max(y1 - y0, 0.001)
            func xOf(_ d: String) -> CGFloat? {
                guard let t = PhoneDates.day(d) else { return nil }
                return plot.minX + plot.width * CGFloat(t.timeIntervalSince(first) / spanT)
            }
            func yOf(_ v: Double) -> CGFloat { plot.minY + plot.height * CGFloat(1 - (v - y0) / spanY) }
            for band in bands where band.to > y0 && band.from < y1 {
                let top = yOf(min(band.to, y1))
                let bot = yOf(max(band.from, y0))
                let rect = CGRect(x: plot.minX, y: top, width: plot.width, height: max(bot - top, 0))
                ctx.fill(Path(rect), with: .color(zoneFill(band.cls)))
            }
            stroke(ctx, points, xOf, yOf, Color(red: 1, green: 0.48, blue: 0.18), 2)
            if trend.count > 2 { stroke(ctx, trend, xOf, yOf, Color(red: 0.62, green: 0.78, blue: 1), 1.5) }
            let byKind = Dictionary(uniqueKeysWithValues: legend.map { ($0.kind, $0.color) })
            for mark in marks {
                guard let x = xOf(mark.d), x >= plot.minX, x <= plot.maxX else { continue }
                let rect = CGRect(x: x - 1, y: size.height - 10, width: 2, height: 8)
                ctx.fill(Path(rect), with: .color(colorHex(byKind[mark.kind] ?? "#9a9ca1")))
            }
        }
    }

    private func stroke(_ ctx: GraphicsContext, _ pts: [PhonePoint], _ xOf: (String) -> CGFloat?, _ yOf: (Double) -> CGFloat, _ color: Color, _ width: CGFloat) {
        var path = Path()
        var started = false
        for p in pts {
            guard let x = xOf(p.d) else { continue }
            let y = yOf(p.y)
            if started { path.addLine(to: CGPoint(x: x, y: y)) } else { path.move(to: CGPoint(x: x, y: y)); started = true }
        }
        ctx.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
    }

    private func zoneFill(_ cls: String) -> Color {
        switch cls {
        case "ok": return Color(red: 0.30, green: 0.76, blue: 0.42).opacity(0.16)
        case "warn": return Color(red: 0.90, green: 0.72, blue: 0.29).opacity(0.14)
        default: return Color(red: 1, green: 0.42, blue: 0.42).opacity(0.12)
        }
    }
}

private func colorHex(_ s: String) -> Color {
    var n: UInt64 = 0
    Scanner(string: s.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&n)
    return Color(red: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255)
}

struct GoalView: View {
    @EnvironmentObject var phone: PhoneModel

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(spacing: 12) {
                        StaleBanner()
                        if let goal = snap.goal {
                            PhoneCard {
                                Text(goal.pace)
                                    .font(.headline)
                                    .foregroundStyle(paceColor(goal.paceState))
                                ForEach(Array(goal.lines.enumerated()), id: \.offset) { _, line in
                                    Text(line).font(.body)
                                }
                            }
                        } else {
                            PhoneCard {
                                Text("Er is nog geen doel. Dat stel je op de computer in, op Doel.")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let food = snap.food {
                            PhoneCard {
                                Text("Inname vandaag").font(.subheadline.weight(.semibold))
                                if let kcal = food.kcal, let target = food.target {
                                    Text("\(phoneInt(kcal)) / \(phoneInt(target)) kcal").font(.title3.monospacedDigit())
                                } else if let target = food.target {
                                    Text("Streef \(phoneInt(target)) kcal").font(.title3.monospacedDigit())
                                }
                                if let protein = food.protein, let target = food.proteinTarget {
                                    Text("\(phoneInt(protein)) / \(phoneInt(target)) g eiwit").foregroundStyle(.secondary)
                                }
                                Text(food.line).font(.footnote).foregroundStyle(.secondary)
                                macroLine(food)
                            }
                        }
                        if snap.week.kcal > 0 {
                            PhoneCard {
                                LabeledContent("Verbrand deze week") { Text("\(phoneInt(snap.week.kcal)) kcal") }
                                LabeledContent("Minuten") { Text("\(phoneInt(snap.week.minutes))") }
                            }
                        }
                    }
                    .padding(16)
                }
            }
            .background(PhoneChrome.bg.ignoresSafeArea())
            .navigationTitle("Doel")
            .refreshable { await phone.refresh() }
        }
    }

    @ViewBuilder private func macroLine(_ food: PhoneFood) -> some View {
        let bits = [
            food.carbs.map { "koolhydraten \(phoneInt($0)) g" },
            food.fat.map { "vet \(phoneInt($0)) g" },
        ].compactMap { $0 }
        if !bits.isEmpty {
            Text(bits.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct MoreView: View {
    @EnvironmentObject var phone: PhoneModel

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("https://gymcoach.stolding.com", text: $phone.serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Scherm")
                } footer: {
                    Text("Adres voor schema, voortgang, lichaam en doel. Los van het adres voor Apple Health.")
                }
                Section {
                    NavigationLink("Synchroniseren") { SyncSettingsView() }
                    NavigationLink("Over GymCoach") { AboutView() }
                }
                if let version = phone.snapshot?.version, !version.isEmpty {
                    Section {
                        LabeledContent("Server", value: version)
                    }
                }
                Section {
                    Button("Uitloggen", role: .destructive) { Task { await phone.logout() } }
                } footer: {
                    Text("Het schema wijzig je op de computer. Hier bekijk je het, ook als de server even niet bereikbaar is.")
                }
            }
            .navigationTitle("Meer")
            .refreshable { await phone.refresh() }
        }
    }
}

struct MainTabs: View {
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            DashboardView(openPlan: { tab = 1 }).tabItem { Label("Overzicht", systemImage: "square.grid.2x2") }.tag(0)
            PlanView().tabItem { Label("Plan", systemImage: "list.bullet.rectangle") }.tag(1)
            ProgressViewScreen().tabItem { Label("Voortgang", systemImage: "chart.line.uptrend.xyaxis") }.tag(2)
            BodyView().tabItem { Label("Lichaam", systemImage: "figure.stand") }.tag(3)
            GoalView().tabItem { Label("Doel", systemImage: "flag") }.tag(4)
            MoreView().tabItem { Label("Meer", systemImage: "ellipsis.circle") }.tag(5)
        }
    }
}

struct LoginView: View {
    @EnvironmentObject var phone: PhoneModel
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack { Spacer(); Mark(size: 72); Spacer() }
                        .listRowBackground(Color.clear)
                    TextField("https://gymcoach.stolding.com", text: $phone.serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Gebruikersnaam", text: $phone.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Wachtwoord", text: $password)
                        .onSubmit { if password.count >= 8 { Task { await phone.login(password: password) } } }
                    Button {
                        Task { await phone.login(password: password) }
                    } label: {
                        HStack {
                            Text("Inloggen")
                            if phone.busy { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(phone.busy || phone.serverURL.trimmingCharacters(in: .whitespaces).isEmpty || phone.username.isEmpty || password.count < 8)
                } footer: {
                    Text("Adres van GymCoach voor dit scherm. Standaard gymcoach.stolding.com. Apple Health heeft een eigen adres. Het wachtwoord wordt niet bewaard.")
                }
                if !phone.error.isEmpty {
                    Section { Text(phone.error).foregroundStyle(.red) }
                }
                Section {
                    NavigationLink("Apple Health") { SyncSettingsView() }
                    NavigationLink("Over GymCoach") { AboutView() }
                } footer: {
                    Text("Apple Health synchroniseert met de koppelsleutel, ook zonder dit scherm.")
                }
            }
            .navigationTitle("GymCoach")
        }
    }
}

struct AboutView: View {
    @EnvironmentObject var phone: PhoneModel

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return b.isEmpty ? v : "\(v) (\(b))"
    }

    var body: some View {
        Form {
            Section {
                HStack { Spacer(); Mark(size: 72); Spacer() }
                    .listRowBackground(Color.clear)
                LabeledContent("App", value: "GymCoach Sync")
                LabeledContent("Versie", value: appVersion)
                LabeledContent("Server", value: phone.snapshot?.version ?? "—")
            }
            Section {
                Text("Dit is het scherm onderweg: schema, voortgang, lichaam en doel, alleen om te lezen. Wijzigen doe je op de computer. Apple Health blijft synchroniseren met je eigen GymCoach-server.")
                    .font(.subheadline)
            }
            Section {
                Text("© 2026 A. Stoelwinder Holding B.V.")
                Text("MIT-licentie")
            }
        }
        .navigationTitle("Over GymCoach")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct SplashView: View {
    var body: some View {
        ZStack {
            PhoneChrome.bg.ignoresSafeArea()
            VStack(spacing: 18) {
                Mark(size: 96)
                Text("GymCoach")
                    .font(.title.weight(.semibold))
                    .foregroundStyle(PhoneChrome.ink)
                Text("Sync")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var phone: PhoneModel
    @State private var splash = true

    var body: some View {
        ZStack {
            if phone.phase == .ready, phone.snapshot != nil {
                MainTabs()
            } else {
                LoginView()
            }
            if splash {
                SplashView().transition(.opacity)
            }
        }
        .task {
            phone.loadCache()
            let cached = phone.snapshot != nil
            if cached { phone.phase = .ready }
            try? await Task.sleep(for: .milliseconds(800))
            if cached {
                withAnimation(.easeOut(duration: 0.35)) { splash = false }
                await phone.refresh()
            } else {
                await phone.refresh()
                withAnimation(.easeOut(duration: 0.35)) { splash = false }
            }
        }
    }
}

private func phoneInt(_ n: Int) -> String { n.formatted(.number.grouping(.automatic)) }
private func phoneKg(_ n: Double) -> String { n.formatted(.number.precision(.fractionLength(0...1))) }
private func signedPct(_ n: Double) -> String {
    let body = n.formatted(.number.precision(.fractionLength(0...1)))
    return (n > 0 ? "+" : "") + body + "%"
}
private func signedKg(_ n: Double) -> String {
    let body = n.formatted(.number.precision(.fractionLength(0...2)))
    return (n > 0 ? "+" : "") + body
}
private func recoveryColor(_ state: String) -> Color {
    switch state {
    case "good": return .green
    case "easy": return .orange
    default: return .yellow
    }
}
private func paceColor(_ state: String) -> Color {
    switch state {
    case "behind": return .orange
    case "ahead", "on": return .green
    default: return .secondary
    }
}
