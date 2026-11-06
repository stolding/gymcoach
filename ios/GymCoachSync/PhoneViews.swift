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

struct TodayView: View {
    @EnvironmentObject var phone: PhoneModel

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(alignment: .leading, spacing: 12) {
                        StaleBanner()
                        header(snap)
                        weekStrip(snap)
                        if let s = snap.sessions.first(where: { $0.key == snap.nextKey }) {
                            SessionCard(session: s, expanded: true)
                        } else if !snap.sessions.isEmpty {
                            PhoneCard {
                                Text("Deze week staat alles op gedaan.")
                                    .font(.headline)
                                if !snap.tip.isEmpty { Text(snap.tip).font(.subheadline).foregroundStyle(.secondary) }
                            }
                        } else {
                            PhoneCard {
                                Text("Er staat nog geen weekplan. Dat maak je op de computer.")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        metrics(snap)
                        if snap.nextKey != nil, !snap.tip.isEmpty {
                            Text(snap.tip).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(16)
                }
            }
            .background(PhoneChrome.bg.ignoresSafeArea())
            .navigationTitle("Vandaag")
            .refreshable { await phone.refresh() }
        }
    }

    private func header(_ snap: PhoneSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(snap.name.isEmpty ? "Vandaag" : snap.name).font(.title2.weight(.semibold))
            HStack(spacing: 8) {
                Text(snap.today).foregroundStyle(.secondary)
                if snap.deload {
                    Text("Deload-week")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.orange.opacity(0.25), in: Capsule())
                }
            }
            .font(.subheadline)
        }
    }

    private func weekStrip(_ snap: PhoneSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(snap.week.done) van \(snap.week.target)")
                    .font(.subheadline.weight(.semibold))
                if snap.week.minutes > 0 {
                    Text("\(snap.week.minutes) min").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if snap.week.streak > 0 {
                    Text("\(snap.week.streak) weken op rij").font(.caption).foregroundStyle(.secondary)
                }
            }
            if !snap.sessions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(snap.sessions) { s in
                            VStack(spacing: 4) {
                                Image(systemName: s.done ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(s.done ? Color.green : (s.key == snap.nextKey ? Color(red: 1, green: 0.48, blue: 0.18) : .secondary))
                                Text(s.name).font(.caption2).lineLimit(2).multilineTextAlignment(.center)
                            }
                            .frame(width: 76)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func metrics(_ snap: PhoneSnapshot) -> some View {
        PhoneCard {
            HStack {
                Text("Stappen").font(.subheadline.weight(.semibold))
                Spacer()
                Text(stepText(snap.steps)).font(.subheadline.monospacedDigit())
            }
            ProgressView(value: Double(snap.steps.today ?? 0), total: Double(max(snap.steps.goal, 1)))
                .tint(Color(red: 1, green: 0.48, blue: 0.18))
        }
        if let food = snap.food {
            PhoneCard {
                Text("Inname").font(.subheadline.weight(.semibold))
                if let kcal = food.kcal, let target = food.target {
                    Text("\(phoneInt(kcal)) / \(phoneInt(target)) kcal").font(.title3.monospacedDigit())
                }
                if let protein = food.protein, let target = food.proteinTarget {
                    Text("\(phoneInt(protein)) / \(phoneInt(target)) g eiwit").font(.subheadline).foregroundStyle(.secondary)
                }
                if !food.line.isEmpty { Text(food.line).font(.footnote).foregroundStyle(.secondary) }
            }
        }
        if let rec = snap.recovery {
            PhoneCard {
                Text("Herstel").font(.subheadline.weight(.semibold))
                Text(rec.label).font(.title3).foregroundStyle(recoveryColor(rec.state))
                if !rec.detail.isEmpty { Text(rec.detail).font(.footnote).foregroundStyle(.secondary) }
            }
        }
    }

    private func stepText(_ s: PhoneSteps) -> String {
        let goal = phoneInt(s.goal)
        guard let today = s.today else { return "— / \(goal)" }
        return "\(phoneInt(today)) / \(goal)"
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

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snap = phone.snapshot {
                    VStack(spacing: 12) {
                        StaleBanner()
                        if let measure = snap.body {
                            PhoneCard {
                                Text("Gewicht").font(.subheadline.weight(.semibold))
                                if let kg = measure.kg {
                                    Text("\(phoneKg(kg)) kg").font(.title.monospacedDigit())
                                }
                                if !measure.date.isEmpty { Text(measure.date).font(.caption).foregroundStyle(.secondary) }
                                if let slope = measure.slope {
                                    Text("\(signedKg(slope)) kg per week").font(.subheadline).foregroundStyle(.secondary)
                                }
                                if measure.spark.count > 1 { Sparkline(values: measure.spark) }
                            }
                            if measure.muscle != nil || measure.fat != nil {
                                PhoneCard {
                                    if let muscle = measure.muscle {
                                        LabeledContent("Spiermassa") { Text("\(phoneKg(muscle)) kg") }
                                        if !measure.muscleDate.isEmpty {
                                            Text(measure.muscleDate).font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                    if let fat = measure.fat {
                                        LabeledContent("Vet") { Text("\(phoneKg(fat))%") }
                                    }
                                }
                            }
                        } else {
                            PhoneCard {
                                Text("Nog geen weging. Die komt van de weegschaal of van Lichaam op de computer.")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        PhoneCard {
                            Text("Stappen vandaag").font(.subheadline.weight(.semibold))
                            Text(stepLine(snap.steps)).font(.title3.monospacedDigit())
                            ProgressView(value: Double(snap.steps.today ?? 0), total: Double(max(snap.steps.goal, 1)))
                                .tint(Color(red: 1, green: 0.48, blue: 0.18))
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

    private func stepLine(_ s: PhoneSteps) -> String {
        guard let today = s.today else { return "Nog geen stappen · doel \(phoneInt(s.goal))" }
        return "\(phoneInt(today)) / \(phoneInt(s.goal))"
    }
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
    var body: some View {
        TabView {
            TodayView().tabItem { Label("Vandaag", systemImage: "sun.max") }
            PlanView().tabItem { Label("Plan", systemImage: "list.bullet.rectangle") }
            ProgressViewScreen().tabItem { Label("Voortgang", systemImage: "chart.line.uptrend.xyaxis") }
            BodyView().tabItem { Label("Lichaam", systemImage: "figure.stand") }
            GoalView().tabItem { Label("Doel", systemImage: "flag") }
            MoreView().tabItem { Label("Meer", systemImage: "ellipsis.circle") }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject var phone: PhoneModel
    @EnvironmentObject var sync: SyncModel
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack { Spacer(); Mark(size: 72); Spacer() }
                        .listRowBackground(Color.clear)
                    TextField("http://192.168.1.50:8765", text: $sync.serverURL)
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
                    .disabled(phone.busy || sync.serverURL.trimmingCharacters(in: .whitespaces).isEmpty || phone.username.isEmpty || password.count < 8)
                } footer: {
                    Text("Zelfde account als op de computer. Het wachtwoord wordt niet bewaard.")
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
