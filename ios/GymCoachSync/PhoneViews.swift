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
    var unit: String = ""
    /// Overzichtstegel: alleen min en max, binnen de bestaande hoogte.
    var minimal: Bool = false

    var body: some View {
        Canvas { ctx, size in
            let ys = values.filter(\.isFinite)
            guard ys.count > 1, size.width > 12, size.height > 8 else { return }
            let lo = ys.min() ?? 0
            let hi = ys.max() ?? lo
            let shownUnit = minimal ? "" : unit
            var dec = AxisFormat.decimals(span: hi - lo, unit: unit)
            var hiText = AxisFormat.tick(hi, decimals: dec, unit: shownUnit)
            var loText = AxisFormat.tick(lo, decimals: dec, unit: shownUnit)
            if hiText == loText, hi - lo > 0.000_001, dec < 2 {
                dec = 2
                hiText = AxisFormat.tick(hi, decimals: dec, unit: shownUnit)
                loText = AxisFormat.tick(lo, decimals: dec, unit: shownUnit)
            }
            let font = Font.system(size: CGFloat(minimal ? 9.0 : 10.5)).monospacedDigit()
            let hiRes = ctx.resolve(Text(hiText).font(font).foregroundColor(.secondary))
            let loRes = ctx.resolve(Text(loText).font(font).foregroundColor(.secondary))
            let box = CGSize(width: 220, height: 32)
            let gutter = min(max(hiRes.measure(in: box).width, loRes.measure(in: box).width) + 4, size.width * 0.46)
            let plot = CGRect(x: gutter, y: 2, width: max(size.width - gutter, 1), height: max(size.height - 4, 1))
            let flat = hi - lo < 0.000_001
            let span = max(hi - lo, 0.001)
            var path = Path()
            for (i, v) in ys.enumerated() {
                let x = plot.minX + plot.width * CGFloat(i) / CGFloat(ys.count - 1)
                let y = flat ? plot.midY : plot.minY + plot.height * CGFloat(1 - (v - lo) / span)
                if i == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
            }
            ctx.stroke(path, with: .color(Color(red: 1, green: 0.48, blue: 0.18)), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            if hiText == loText {
                ctx.draw(hiRes, at: CGPoint(x: gutter - 3, y: plot.midY), anchor: .trailing)
            } else {
                ctx.draw(hiRes, at: CGPoint(x: gutter - 3, y: plot.minY), anchor: .topTrailing)
                ctx.draw(loRes, at: CGPoint(x: gutter - 3, y: plot.maxY), anchor: .bottomTrailing)
            }
        }
        .frame(height: minimal ? 28 : 44)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(scaleLabel)
    }

    private var scaleLabel: String {
        let ys = values.filter(\.isFinite)
        guard let lo = ys.min(), let hi = ys.max() else { return "Geen verloop" }
        let dec = AxisFormat.decimals(span: hi - lo, unit: unit)
        if hi - lo < 0.000_001 { return AxisFormat.tick(lo, decimals: dec, unit: unit) }
        return "\(AxisFormat.tick(lo, decimals: dec, unit: unit)) tot \(AxisFormat.tick(hi, decimals: dec, unit: unit))"
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
    @State private var recKey = ""
    @State private var recTip: String? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(alignment: .leading, spacing: 12) {
                        StaleBanner()
                        HStack(alignment: .firstTextBaseline) {
                            Text(snap.name.isEmpty ? "Overzicht" : snap.name).font(.title2.weight(.semibold))
                            Spacer()
                            Text(snap.today).font(.subheadline).foregroundStyle(.secondary)
                        }
                        recoveryCard(snap)
                        muscleRecoveryCard(snap)
                        weekPlanCard(snap)
                        nextRow(snap)
                        goalCard(snap)
                        statGrid(snap)
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

    private func recoveryPct(_ n: Double) -> Int {
        guard n.isFinite else { return 0 }
        return Int(min(100.0, max(0.0, n)).rounded())
    }

    private func chosenRecKey(_ rec: PhoneMuscleRecovery) -> String {
        if rec.muscles.contains(where: { $0.key == recKey }) { return recKey }
        return rec.muscles.first?.key ?? ""
    }

    @ViewBuilder private func muscleRecoveryCard(_ snap: PhoneSnapshot) -> some View {
        if let rec = snap.muscleRecovery {
            PhoneCard {
                Text("Spierherstel").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                if !rec.note.isEmpty { Text(rec.note).font(.footnote).foregroundStyle(.secondary) }
                if rec.muscles.isEmpty {
                    Text(rec.empty ?? "Nog geen afgeronde training met sets.").font(.subheadline).foregroundStyle(.secondary)
                } else {
                    muscleBody(rec)
                }
            }
        }
    }

    private func muscleBody(_ rec: PhoneMuscleRecovery) -> some View {
        let key = chosenRecKey(rec)
        let series = rec.series.first { $0.key == key }
        let tip = rec.muscles.first { $0.key == recTip }
        return VStack(alignment: .leading, spacing: 8) {
            if !rec.legend.isEmpty {
                Text(rec.legend).font(.caption2).foregroundStyle(.secondary)
                    .onTapGesture { recTip = nil }
            }
            BodyFigure(scores: rec.scores, figure: rec.figure, fatigue: true, accessLabel: "Spierherstel", onSelect: { hit in
                guard let hit, rec.muscles.contains(where: { $0.key == hit }) else {
                    recTip = nil
                    return
                }
                recTip = recTip == hit ? nil : hit
            })
            .frame(maxWidth: 280)
            .overlay(alignment: .topLeading) {
                if let tip { recoveryCallout(tip).padding(6) }
            }
            Picker("Spiergroep", selection: Binding(get: { key }, set: { recKey = $0 })) {
                ForEach(rec.muscles) { m in
                    Text(m.name).tag(m.key)
                }
            }
            .pickerStyle(.menu)
            Text("percentage hersteld").font(.caption2).foregroundStyle(.secondary)
                .onTapGesture { recTip = nil }
            if let line = series, !line.points.isEmpty {
                CompChart(points: line.points, trend: [], marks: [], legend: [], bands: [], unit: "%", range: "28d")
                    .frame(height: 180)
                    .contentShape(Rectangle())
                    .onTapGesture { recTip = nil }
            } else {
                Text(rec.empty ?? "Geen verloop om te tekenen.").font(.footnote).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 80)
            }
        }
    }

    private func recoveryCallout(_ m: PhoneMuscleNow) -> some View {
        let pct = min(100.0, max(0.0, m.pct.isFinite ? m.pct : 0))
        return VStack(alignment: .leading, spacing: 3) {
            Text(m.name).font(.subheadline.weight(.semibold))
            Text("percentage hersteld").font(.caption2).foregroundStyle(.secondary)
            ProgressView(value: pct, total: 100.0)
                .tint(BodyShapes.recoveryFill(pct))
            Text("\(recoveryPct(pct))%")
                .font(.caption.monospacedDigit())
        }
        .padding(8)
        .frame(maxWidth: 180, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .allowsHitTesting(false)
    }

    private func nextRow(_ snap: PhoneSnapshot) -> some View {
        Grid(horizontalSpacing: 12, verticalSpacing: 12) {
            GridRow {
                PhoneCard {
                    Text("Volgende training").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    if let s = snap.sessions.first(where: { $0.key == snap.nextKey }) {
                        Text(s.name).font(.title3.weight(.semibold)).lineLimit(2)
                        metaLine(s, snap)
                        if s.outdoor {
                            Text(s.advice.isEmpty ? "Buiten." : s.advice).font(.subheadline).foregroundStyle(.secondary)
                        } else {
                            VStack(alignment: .leading, spacing: 2) {
                                ForEach(Array(s.exercises.prefix(4).enumerated()), id: \.offset) { i, e in
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
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                PhoneCard { weekRing(snap.week) }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            }
        }
    }

    private func metaLine(_ s: PhoneSession, _ snap: PhoneSnapshot) -> some View {
        var bits: [String] = []
        if let m = s.minutes { bits.append("~\(m) min") }
        if !s.outdoor { bits.append("\(s.exercises.count) oefeningen") }
        if !snap.weekPlan.goal.isEmpty { bits.append(snap.weekPlan.goal) }
        return VStack(alignment: .leading, spacing: 4) {
            Text(bits.joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if s.onDevice {
                Text("op toestel").font(.caption.weight(.semibold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.green.opacity(0.2), in: Capsule())
            }
        }
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
            Text("Weekdoel").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Text("deze week").font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func statGrid(_ snap: PhoneSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Voortgang deze week").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Grid(horizontalSpacing: 12, verticalSpacing: 12) {
                GridRow {
                    statTile("Streak", "\(snap.week.streak) \(snap.week.streak == 1 ? "week" : "weken")", "op rij je weekdoel gehaald")
                    statTile("Volume deze week", "\(phoneInt(snap.week.volume)) kg", snap.week.volumeNote)
                }
                GridRow {
                    statTile("Trainingstijd", "\(snap.week.minutes) min", "\(phoneInt(snap.week.kcal)) kcal deze week")
                    PhoneCard {
                        Text("Lichaamsgewicht").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        if let body = snap.body, let kg = body.kg {
                            Text(body.fat != nil ? "\(phoneKg(kg)) kg · \(phoneKg(body.fat ?? 0))% vet" : "\(phoneKg(kg)) kg")
                                .font(.title3.monospacedDigit()).lineLimit(1).minimumScaleFactor(0.7)
                            Text(body.slopeNote).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            if body.spark.count > 1 { Sparkline(values: body.spark, unit: "kg", minimal: true) }
                        } else {
                            Text("Nog geen weging.").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
        }
    }

    private func statTile(_ title: String, _ value: String, _ note: String) -> some View {
        PhoneCard {
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Text(value).font(.title3.monospacedDigit()).lineLimit(1).minimumScaleFactor(0.7)
            Text(note).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
                HStack(alignment: .center, spacing: 12) {
                    BodyFigure(scores: plan.scores, figure: plan.figure)
                        .frame(width: 136)
                    Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                        GridRow {
                            planStat("Trainingen", "\(plan.sessions) × ~\(plan.avgMinutes) min")
                            planStat("Werksets", "\(plan.sets) · \(plan.exercises) oef.")
                        }
                        GridRow {
                            planStat("Gepland volume", plannedAmount(plan.volume))
                            planStat("Zwaarder", "\(plan.heavier) oefeningen ↑")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .top)
                }
                ForEach(Array(plan.muscles.enumerated()), id: \.offset) { _, m in
                    HStack(spacing: 8) {
                        Text(m.name).font(.caption).lineLimit(1).minimumScaleFactor(0.75).frame(width: 118, alignment: .leading)
                        ProgressView(value: min(1.0, m.share)).tint(orange)
                        Text(phoneKg(m.value)).font(.caption.monospacedDigit()).frame(width: 36, alignment: .trailing)
                    }
                }
                ChipFlow(spacing: 8) {
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
            } else {
                Text("Er staat nog geen weekplan. Dat maak je op de computer.").foregroundStyle(.secondary)
            }
        }
    }

    private func planStat(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            Text(value).font(.subheadline.weight(.semibold)).lineLimit(2).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func plannedAmount(_ n: Int) -> String {
        guard n >= 10000 else { return "\(phoneInt(n)) kg" }
        let tonnes = (Double(n) / 1000).formatted(.number.precision(.fractionLength(0...1)))
        return "\(tonnes) t"
    }
}

struct ChipFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = rows(in: proposal.width ?? 0, subviews: subviews)
        let height = rows.reduce(CGFloat(0)) { $0 + ($1.map(\.height).max() ?? 0) } + spacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = rows(in: bounds.width, subviews: subviews)
        var y = bounds.minY
        var index = 0
        for row in rows {
            let rowH = row.map(\.height).max() ?? 0
            let used = row.reduce(CGFloat(0)) { $0 + $1.width } + spacing * CGFloat(max(row.count - 1, 0))
            var x = bounds.minX + max(0, (bounds.width - used) / 2)
            for size in row {
                subviews[index].place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
                x += size.width + spacing
                index += 1
            }
            y += rowH + spacing
        }
    }

    private func rows(in width: CGFloat, subviews: Subviews) -> [[CGSize]] {
        var lines: [[CGSize]] = [[]]
        var x: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width, width > 0 {
                lines.append([])
                x = 0
            }
            lines[lines.count - 1].append(size)
            x += size.width + spacing
        }
        return lines.filter { !$0.isEmpty }
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

struct GoalChart: View {
    var line: [PhonePoint]
    var points: [PhonePoint]
    var unit: String

    private let orange = Color(red: 1, green: 0.48, blue: 0.18)

    var body: some View {
        Canvas { ctx, size in
            paint(&ctx, size)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessLabel)
    }

    private var accessLabel: String {
        guard line.count >= 2, let from = PhoneDates.day(line[0].d), let to = PhoneDates.day(line[line.count - 1].d) else { return "Grafiek" }
        let dec = AxisFormat.decimals(span: abs(line[line.count - 1].y - line[0].y), unit: unit)
        let a = AxisFormat.tick(line[0].y, decimals: dec, unit: unit)
        let b = AxisFormat.tick(line[line.count - 1].y, decimals: dec, unit: unit)
        return "Streeflijn van \(a) naar \(b), \(AxisFormat.dayMonth(from)) tot \(AxisFormat.dayMonth(to))"
    }

    private func paint(_ ctx: inout GraphicsContext, _ size: CGSize) {
        guard line.count >= 2, size.width > 48, size.height > 48 else { return }
        guard let from = PhoneDates.day(line[0].d), let to = PhoneDates.day(line[line.count - 1].d), to >= from else { return }
        let ys = line.map(\.y) + points.map(\.y)
        var lo = ys.min() ?? line[0].y
        var hi = ys.max() ?? lo
        if unit.isEmpty {
            let goalLo = min(line[0].y, line[line.count - 1].y)
            let goalHi = max(line[0].y, line[line.count - 1].y)
            lo = min(lo, goalLo)
            hi = max(hi, goalHi)
            let mid = (goalLo + goalHi) / 2
            let minSpan = max(goalHi - goalLo, abs(mid) * 0.12, 8)
            if hi - lo < minSpan {
                let extra = (minSpan - (hi - lo)) / 2
                lo -= extra
                hi += extra
            }
        }
        let pad = max((hi - lo) * 0.1, max(abs(hi) * 0.02, 0.4))
        let y0 = lo - pad
        let y1 = hi + pad
        let spanY = max(y1 - y0, 0.001)
        let nice = AxisFormat.niceTicks(lo: y0, hi: y1)
        let yValues = nice.count >= 2 ? nice : [lo, hi]
        let step = yValues.count >= 2 ? abs(yValues[1] - yValues[0]) : 0.1
        let dec = AxisFormat.decimals(step: step, unit: unit)
        let yTexts = yValues.map { AxisFormat.tick($0, decimals: dec, unit: unit) }
        let font = Font.system(size: 11).monospacedDigit()
        let box = CGSize(width: 240, height: 32)
        var widest: CGFloat = 28
        for text in yTexts {
            let w = ctx.resolve(Text(text).font(font).foregroundColor(.secondary)).measure(in: box).width
            if w > widest { widest = w }
        }
        let gutter = min(max(widest + 8, 8), size.width * 0.48)
        let top: CGFloat = 8
        let xBand: CGFloat = 16
        let plotH = size.height - top - xBand
        guard plotH > 24 else { return }
        let plot = CGRect(x: gutter, y: top, width: max(size.width - gutter - 2, 1), height: plotH)
        let spanT = max(to.timeIntervalSince(from), 1)
        func xOf(_ d: String) -> CGFloat? {
            guard let t = PhoneDates.day(d) else { return nil }
            return plot.minX + plot.width * CGFloat(t.timeIntervalSince(from) / spanT)
        }
        func yOf(_ v: Double) -> CGFloat { plot.minY + plot.height * CGFloat(1 - (v - y0) / spanY) }
        stroke(&ctx, line, xOf, yOf, Color.secondary.opacity(0.85), 1.6, dashed: true)
        let drawn = points.filter { PhoneDates.day($0.d) != nil }
        if unit.isEmpty {
            let best = runningMax(drawn)
            if best.count >= 2 { stroke(&ctx, best, xOf, yOf, orange, 2.2, dashed: false) }
        } else if drawn.count >= 2 {
            stroke(&ctx, drawn, xOf, yOf, orange, 2.2, dashed: false)
        }
        for p in drawn {
            guard let x = xOf(p.d) else { continue }
            let y = yOf(p.y)
            let r: CGFloat = 3.2
            ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(orange))
        }
        var yKept: [(y: CGFloat, text: String)] = []
        let yRows: [(y: CGFloat, text: String)] = zip(yValues, yTexts).map { (y: yOf($0.0), text: $0.1) }.sorted { $0.y < $1.y }
        if let topRow = yRows.first {
            yKept.append(topRow)
            if yRows.count > 1, let bottomRow = yRows.last {
                for row in yRows.dropFirst().dropLast() {
                    let prev = yKept[yKept.count - 1]
                    if abs(row.y - prev.y) < 13 || abs(row.y - bottomRow.y) < 13 || prev.text == row.text { continue }
                    yKept.append(row)
                }
                let prev = yKept[yKept.count - 1]
                if abs(bottomRow.y - prev.y) >= 13, prev.text != bottomRow.text { yKept.append(bottomRow) }
            }
        }
        for row in yKept {
            let text = ctx.resolve(Text(row.text).font(font).foregroundColor(.secondary))
            ctx.draw(text, at: CGPoint(x: plot.minX - 4, y: row.y), anchor: .trailing)
        }
        let days = to.timeIntervalSince(from) / 86400
        var ticks = AxisFormat.xLabels(first: from, last: to, count: 3, range: days <= 100 ? "3m" : "all")
        var shrinks = 0
        while ticks.count >= 3 && shrinks < 2 {
            var slot: CGFloat = 36
            for tick in ticks {
                let w = ctx.resolve(Text(tick.text).font(font).foregroundColor(.secondary)).measure(in: box).width
                if w + 10 > slot { slot = w + 10 }
            }
            if plot.width >= slot * 3.05 { break }
            ticks = AxisFormat.xLabels(first: from, last: to, count: 2, range: days <= 100 ? "3m" : "all")
            shrinks += 1
        }
        for (i, tick) in ticks.enumerated() {
            let anchor: UnitPoint
            let x: CGFloat
            if i == 0 {
                anchor = .bottomLeading
                x = plot.minX
            } else if i == ticks.count - 1 {
                anchor = .bottomTrailing
                x = plot.maxX
            } else {
                anchor = .bottom
                x = plot.minX + plot.width * CGFloat(tick.date.timeIntervalSince(from) / spanT)
            }
            let text = ctx.resolve(Text(tick.text).font(font).foregroundColor(.secondary))
            ctx.draw(text, at: CGPoint(x: x, y: size.height - 1), anchor: anchor)
        }
    }

    private func runningMax(_ points: [PhonePoint]) -> [PhonePoint] {
        var best = -Double.greatestFiniteMagnitude
        return points.map { p in
            best = max(best, p.y)
            return PhonePoint(d: p.d, y: (best * 10).rounded() / 10)
        }
    }

    private func stroke(_ ctx: inout GraphicsContext, _ pts: [PhonePoint], _ xOf: (String) -> CGFloat?, _ yOf: (Double) -> CGFloat, _ color: Color, _ width: CGFloat, dashed: Bool) {
        var path = Path()
        var started = false
        for p in pts {
            guard let x = xOf(p.d) else { continue }
            let y = yOf(p.y)
            if started { path.addLine(to: CGPoint(x: x, y: y)) } else { path.move(to: CGPoint(x: x, y: y)); started = true }
        }
        let style = dashed
            ? StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round, dash: [5, 4])
            : StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)
        ctx.stroke(path, with: .color(color), style: style)
    }
}

struct ProgressViewScreen: View {
    @EnvironmentObject var phone: PhoneModel
    @State private var seriesOpen = false

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(spacing: 12) {
                        StaleBanner()
                        if let tracks = snap.tracks, !tracks.isEmpty {
                            ForEach(Array(tracks.enumerated()), id: \.offset) { _, row in
                                goalTrack(row)
                            }
                        }
                        seriesBlock(snap)
                    }
                    .padding(16)
                }
            }
            .background(PhoneChrome.bg.ignoresSafeArea())
            .navigationTitle("Voortgang")
            .refreshable { await phone.refresh() }
        }
    }

    private func goalTrack(_ row: PhoneTrack) -> some View {
        PhoneCard {
            HStack(alignment: .firstTextBaseline) {
                Text(row.name).font(.headline)
                Spacer()
                Text(row.pace)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(paceColor(row.state))
                    .multilineTextAlignment(.trailing)
            }
            if !row.place.isEmpty {
                Text(row.place).font(.caption).foregroundStyle(.secondary)
            }
            HStack(alignment: .top, spacing: 8) {
                trackStat("Start", row.start, row.unit)
                trackStat(row.unit.isEmpty ? "Beste tot nu" : "Nu", row.now, row.unit)
                trackStat("Doel", row.target, row.unit)
            }
            if !row.note.isEmpty {
                Text(row.note).font(.caption2).foregroundStyle(.secondary)
            }
            if let line = row.line, line.count >= 2 {
                GoalChart(line: line, points: row.points ?? [], unit: row.unit)
                    .frame(height: 168)
                HStack(spacing: 14) {
                    if row.unit.isEmpty {
                        HStack(spacing: 4) {
                            Circle().fill(Color(red: 1, green: 0.48, blue: 0.18)).frame(width: 7, height: 7)
                            Text("Krachtindex").font(.caption2).foregroundStyle(.secondary)
                        }
                        HStack(spacing: 4) {
                            Capsule().fill(Color(red: 1, green: 0.48, blue: 0.18)).frame(width: 16, height: 2)
                            Text("Beste tot nu").font(.caption2).foregroundStyle(.secondary)
                        }
                    } else {
                        HStack(spacing: 4) {
                            Circle().fill(Color(red: 1, green: 0.48, blue: 0.18)).frame(width: 7, height: 7)
                            Text(row.name).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing: 4) {
                        Capsule().stroke(Color.secondary, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
                            .frame(width: 16, height: 2)
                        Text("Streeflijn").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func trackStat(_ label: String, _ value: Double?, _ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            Text(trackValue(value, unit)).font(.title3.monospacedDigit()).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func trackValue(_ n: Double?, _ unit: String) -> String {
        guard let n, n > 0 else { return "—" }
        return unit == "kg" ? "\(phoneKg(n)) kg" : phoneKg(n)
    }

    @ViewBuilder private func seriesBlock(_ snap: PhoneSnapshot) -> some View {
        if !snap.progress.isEmpty || !snap.records.isEmpty || !snap.recent.isEmpty {
            DisclosureGroup(isExpanded: $seriesOpen) {
                VStack(spacing: 12) {
                    seriesCards(snap)
                }
                .padding(.top, 8)
            } label: {
                Text("Metingen").font(.headline)
            }
            .tint(PhoneChrome.ink)
            .padding(14)
            .background(PhoneChrome.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        } else if (snap.tracks ?? []).isEmpty {
            PhoneCard {
                Text("Nog te weinig trainingen voor een lijn of een record.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder private func seriesCards(_ snap: PhoneSnapshot) -> some View {
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
                if p.spark.count > 1 { Sparkline(values: p.spark, unit: "kg") }
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
        let trend = showTrend ? trendLine(visible) : []
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
            if visible.isEmpty {
                Text("Geen metingen in deze periode.").font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 120)
            } else {
                CompChart(points: visible, trend: trend, marks: marks, legend: comp.legend, bands: m.bands, unit: m.unit, range: range)
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
    guard points.count > 2, let t0 = PhoneDates.day(points[0].d) else { return [] }
    let xs = points.map { (PhoneDates.day($0.d) ?? t0).timeIntervalSince(t0) / 86400 }
    let ys = points.map(\.y)
    let n = Double(xs.count)
    let mx = xs.reduce(0, +) / n
    let my = ys.reduce(0, +) / n
    let den = xs.reduce(0) { $0 + ($1 - mx) * ($1 - mx) }
    var num = 0.0
    for i in xs.indices { num += (xs[i] - mx) * (ys[i] - my) }
    let slope = den > 0 ? num / den : 0
    func at(_ x: Double) -> Double { ((my + slope * (x - mx)) * 100).rounded() / 100 }
    return [PhonePoint(d: points[0].d, y: at(xs[0])), PhonePoint(d: points[points.count - 1].d, y: at(xs[xs.count - 1]))]
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
    var unit: String
    var range: String

    var body: some View {
        Canvas { ctx, size in
            paint(&ctx, size)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessLabel)
    }

    private var accessLabel: String {
        let series = points.sorted { $0.d < $1.d }
        guard let first = series.first, let last = series.last else { return "Grafiek" }
        let lo = series.map(\.y).min() ?? first.y
        let hi = series.map(\.y).max() ?? last.y
        let dec = AxisFormat.decimals(span: hi - lo, unit: unit)
        let value = hi - lo < 0.000_001
            ? AxisFormat.tick(lo, decimals: dec, unit: unit)
            : "\(AxisFormat.tick(lo, decimals: dec, unit: unit)) tot \(AxisFormat.tick(hi, decimals: dec, unit: unit))"
        guard let from = PhoneDates.day(first.d) else { return value }
        let start = AxisFormat.dayMonth(from)
        guard series.count > 1, let to = PhoneDates.day(last.d), to != from else { return "\(value), \(start)" }
        return "\(value), \(start) tot \(AxisFormat.dayMonth(to))"
    }

    private func paint(_ ctx: inout GraphicsContext, _ size: CGSize) {
        let series = points.sorted { $0.d < $1.d }
        guard !series.isEmpty, size.width > 48, size.height > 48 else { return }
        guard let first = PhoneDates.day(series[0].d), let last = PhoneDates.day(series[series.count - 1].d) else { return }
        let ys = series.map(\.y) + trend.map(\.y)
        let lo = ys.min() ?? 0
        let hi = ys.max() ?? lo
        let flat = hi - lo < 0.000_001
        let single = series.count < 2
        let pad = max((hi - lo) * 0.08, 0.05)
        let y0 = lo - pad
        let y1 = hi + pad
        let spanY = max(y1 - y0, 0.001)
        let yValues: [Double]
        if single || flat {
            yValues = [lo]
        } else {
            let nice = AxisFormat.niceTicks(lo: y0, hi: y1)
            yValues = nice.count >= 2 ? nice : [lo, hi]
        }
        let step = yValues.count >= 2 ? abs(yValues[1] - yValues[0]) : 0.1
        let dec = AxisFormat.decimals(step: step, unit: unit)
        let yTexts = yValues.map { AxisFormat.tick($0, decimals: dec, unit: unit) }
        let font = Font.system(size: 11).monospacedDigit()
        let box = CGSize(width: 240, height: 32)
        var widest: CGFloat = 28
        for text in yTexts {
            let w = ctx.resolve(Text(text).font(font).foregroundColor(.secondary)).measure(in: box).width
            if w > widest { widest = w }
        }
        let gutter = min(max(widest + 8, 8), size.width * 0.48)
        let xBand: CGFloat = 18
        let markBand: CGFloat = marks.isEmpty ? 0 : 14
        let top: CGFloat = 11
        let plotH = size.height - top - xBand - markBand
        guard plotH > 24 else { return }
        let plot = CGRect(x: gutter, y: top, width: max(size.width - gutter - 2, 1), height: plotH)
        let spanT = last.timeIntervalSince(first)
        func xOf(_ d: String) -> CGFloat? {
            guard let t = PhoneDates.day(d) else { return nil }
            if spanT < 1 { return plot.midX }
            return plot.minX + plot.width * CGFloat(t.timeIntervalSince(first) / spanT)
        }
        func yOf(_ v: Double) -> CGFloat { plot.minY + plot.height * CGFloat(1 - (v - y0) / spanY) }
        for band in bands where band.to > y0 && band.from < y1 {
            let bandTop = yOf(min(band.to, y1))
            let bandBot = yOf(max(band.from, y0))
            let rect = CGRect(x: plot.minX, y: bandTop, width: plot.width, height: max(bandBot - bandTop, 0))
            ctx.fill(Path(rect), with: .color(zoneFill(band.cls)))
        }
        let orange = Color(red: 1, green: 0.48, blue: 0.18)
        let drawable = series.filter { PhoneDates.day($0.d) != nil }
        if drawable.count == 1, let p = drawable.first, let x = xOf(p.d) {
            let y = yOf(p.y)
            let r: CGFloat = 3.5
            ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(orange))
        } else {
            stroke(&ctx, series, xOf, yOf, orange, 2)
        }
        if trend.count >= 2 { stroke(&ctx, trend, xOf, yOf, Color(red: 0.62, green: 0.78, blue: 1), 1.5) }
        let byKind = Dictionary(uniqueKeysWithValues: legend.map { ($0.kind, $0.color) })
        if !marks.isEmpty {
            for mark in marks {
                guard let x = xOf(mark.d), x >= plot.minX, x <= plot.maxX else { continue }
                let rect = CGRect(x: x - 1, y: plot.maxY + 3, width: 2, height: 8)
                ctx.fill(Path(rect), with: .color(colorHex(byKind[mark.kind] ?? "#9a9ca1")))
            }
        }
        var yKept: [(y: CGFloat, text: String)] = []
        let yRows: [(y: CGFloat, text: String)] = zip(yValues, yTexts).map { (y: yOf($0.0), text: $0.1) }.sorted { $0.y < $1.y }
        if let topRow = yRows.first {
            yKept.append(topRow)
            if yRows.count > 1, let bottomRow = yRows.last {
                for row in yRows.dropFirst().dropLast() {
                    let prev = yKept[yKept.count - 1]
                    if abs(row.y - prev.y) < 13 || abs(row.y - bottomRow.y) < 13 || prev.text == row.text { continue }
                    yKept.append(row)
                }
                let prev = yKept[yKept.count - 1]
                if abs(bottomRow.y - prev.y) >= 13, prev.text != bottomRow.text {
                    yKept.append(bottomRow)
                }
            }
        }
        for row in yKept {
            let text = ctx.resolve(Text(row.text).font(font).foregroundColor(.secondary))
            ctx.draw(text, at: CGPoint(x: plot.minX - 4, y: row.y), anchor: .trailing)
        }
        var ticks = AxisFormat.xLabels(first: first, last: last, count: 4, range: range)
        var shrinks = 0
        while ticks.count >= 3 && shrinks < 3 {
            var slot: CGFloat = 36
            for tick in ticks {
                let w = ctx.resolve(Text(tick.text).font(font).foregroundColor(.secondary)).measure(in: box).width
                if w + 10 > slot { slot = w + 10 }
            }
            let need = ticks.count >= 4 ? slot * 4.5 : slot * 3.05
            if plot.width >= need { break }
            ticks = AxisFormat.xLabels(first: first, last: last, count: ticks.count - 1, range: range)
            shrinks += 1
        }
        for (i, tick) in ticks.enumerated() {
            let anchor: UnitPoint
            let x: CGFloat
            if ticks.count == 1 || spanT < 1 {
                anchor = .bottom
                x = plot.midX
            } else if i == 0 {
                anchor = .bottomLeading
                x = plot.minX
            } else if i == ticks.count - 1 {
                anchor = .bottomTrailing
                x = plot.maxX
            } else {
                anchor = .bottom
                x = plot.minX + plot.width * CGFloat(tick.date.timeIntervalSince(first) / spanT)
            }
            let text = ctx.resolve(Text(tick.text).font(font).foregroundColor(.secondary))
            ctx.draw(text, at: CGPoint(x: x, y: size.height - 1), anchor: anchor)
        }
    }

    private func stroke(_ ctx: inout GraphicsContext, _ pts: [PhonePoint], _ xOf: (String) -> CGFloat?, _ yOf: (Double) -> CGFloat, _ color: Color, _ width: CGFloat) {
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

private enum AxisFormat {
    static let months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]

    static func tick(_ v: Double, decimals: Int, unit: String) -> String {
        let n = number(v, decimals: decimals)
        if unit.isEmpty { return n }
        if unit == "%" { return n + unit }
        return n + " " + unit
    }

    static func number(_ v: Double, decimals: Int) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "nl_NL")
        f.numberStyle = .decimal
        f.usesGroupingSeparator = true
        f.roundingMode = .halfUp
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = decimals > 0 ? decimals : 0
        return f.string(from: NSNumber(value: v)) ?? "0"
    }

    static func decimals(span: Double, unit: String) -> Int {
        decimals(step: span > 0 ? span / 3 : 1, unit: unit)
    }

    static func decimals(step: Double, unit: String) -> Int {
        if unit == "bpm" || unit == "kcal" || unit == "g" { return step < 0.999 ? 1 : 0 }
        if step >= 0.999 { return 0 }
        if step >= 0.099 { return 1 }
        return 2
    }

    static func niceTicks(lo: Double, hi: Double) -> [Double] {
        guard lo.isFinite, hi.isFinite, hi - lo > 0.000_001 else { return [lo] }
        let rough = (hi - lo) / 3
        guard rough > 0, rough.isFinite else { return [lo, hi] }
        var mag = 1.0
        var hops = 0
        if rough >= 1 {
            while mag * 10 <= rough && hops < 12 {
                mag *= 10
                hops += 1
            }
        } else {
            while mag > rough && hops < 12 {
                mag /= 10
                hops += 1
            }
        }
        guard mag.isFinite, mag > 0 else { return [lo, hi] }
        let norm = rough / mag
        let nice: Double
        if norm <= 1.6 { nice = 1 }
        else if norm <= 3 { nice = 2 }
        else if norm <= 7.5 { nice = 5 }
        else { nice = 10 }
        let step = nice * mag
        guard step.isFinite, step > 0 else { return [lo, hi] }
        var out: [Double] = []
        let start = (lo / step).rounded(.up) * step
        var i = 0
        while i < 8 {
            let raw = start + Double(i) * step
            if raw > hi + step * 0.01 { break }
            if raw >= lo - step * 0.001 {
                out.append((raw / step).rounded() * step)
            }
            i += 1
        }
        return out.isEmpty ? [lo, hi] : out
    }

    enum DateStyle { case dayMonth, monthYear, year }

    static func xLabels(first: Date, last: Date, count: Int, range: String) -> [(date: Date, text: String)] {
        let span = last.timeIntervalSince(first)
        let days = span / 86400
        let n = count < 1 ? 1 : count
        if n == 1 || span < 1 {
            return [(first, format(first, dateStyle(range: range, days: days)))]
        }
        var dates: [Date] = []
        for i in 0..<n {
            if i == 0 { dates.append(first) }
            else if i == n - 1 { dates.append(last) }
            else { dates.append(first.addingTimeInterval(span * Double(i) / Double(n - 1))) }
        }
        var style = dateStyle(range: range, days: days)
        var texts = dates.map { format($0, style) }
        var hops = 0
        while Set(texts).count < 2, hops < 3 {
            guard let next = finer(style) else { break }
            style = next
            texts = dates.map { format($0, style) }
            hops += 1
        }
        var kept: [(date: Date, text: String)] = []
        for pair in zip(dates, texts) {
            if kept.last?.text == pair.1 { continue }
            kept.append((date: pair.0, text: pair.1))
        }
        if kept.isEmpty { return [(first, format(first, style))] }
        return kept
    }

    static func dateStyle(range: String, days: Double) -> DateStyle {
        if range == "3m" { return .dayMonth }
        if days >= 1825 { return .year }
        if range == "1y" { return .monthYear }
        if days <= 100 { return .dayMonth }
        return .monthYear
    }

    static func finer(_ style: DateStyle) -> DateStyle? {
        switch style {
        case .year: return .monthYear
        case .monthYear: return .dayMonth
        case .dayMonth: return nil
        }
    }

    static func format(_ date: Date, _ style: DateStyle) -> String {
        switch style {
        case .dayMonth: return dayMonth(date)
        case .monthYear: return monthYear(date)
        case .year: return yearText(date)
        }
    }

    static func dayMonth(_ date: Date) -> String {
        let p = parts(date)
        return "\(p.day ?? 1) \(monthName(p.month))"
    }

    static func monthYear(_ date: Date) -> String {
        let p = parts(date)
        return "\(monthName(p.month)) \(p.year ?? 0)"
    }

    static func yearText(_ date: Date) -> String {
        "\(parts(date).year ?? 0)"
    }

    static func monthName(_ month: Int?) -> String {
        guard let month, month >= 1, month <= 12 else { return months[0] }
        return months[month - 1]
    }

    static func parts(_ date: Date) -> DateComponents {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        cal.locale = Locale(identifier: "nl_NL")
        return cal.dateComponents([.year, .month, .day], from: date)
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
