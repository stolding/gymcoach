import SwiftUI

/// De app: start de achtergrondsync en toont het instellingenscherm.
@main
struct GymCoachSyncApp: App {
    @StateObject private var model = SyncModel.shared
    @Environment(\.scenePhase) private var phase

    init() {
        // na een herstart van de iPhone opnieuw luisteren naar nieuwe workouts
        _ = NetWatch.shared
        SyncModel.shared.startBackgroundDelivery()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .preferredColorScheme(.dark)
                .tint(Color(red: 1.0, green: 0.48, blue: 0.18))
        }
        .onChange(of: phase) { _, newPhase in
            if newPhase == .active, model.isConfigured {
                Task { await model.autoSync() }
            }
        }
    }
}

/// Het enige scherm: serveradres, koppelsleutel, testen en synchroniseren.
struct ContentView: View {
    @EnvironmentObject var model: SyncModel
    @State private var showToken = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("http://192.168.1.50:8765", text: $model.serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    HStack {
                        if showToken {
                            TextField("gch_…", text: $model.token)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Koppelsleutel (gch_…)", text: $model.token)
                        }
                        Button(showToken ? "Verberg" : "Toon") { showToken.toggle() }
                            .font(.footnote)
                    }
                    Button("Test verbinding") { Task { await model.testConnection() } }
                        .disabled(model.busy || !model.isConfigured)
                } header: {
                    Text("GymCoach-server")
                } footer: {
                    Text("Het adres waarop je GymCoach opent. De koppelsleutel maak je in GymCoach bij Instellingen → Apple Health.")
                }

                Section {
                    Button {
                        Task { await model.sync(full: false) }
                    } label: {
                        Label("Nu synchroniseren", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(model.busy || !model.isConfigured)
                    Button {
                        Task { await model.sync(full: true) }
                    } label: {
                        Label("Volledige historie versturen", systemImage: "clock.arrow.circlepath")
                    }
                    .disabled(model.busy || !model.isConfigured)
                    if model.busy { ProgressView() }
                    if !model.message.isEmpty {
                        Text(model.message).font(.callout)
                    }
                    Toggle("Automatisch alleen thuis", isOn: $model.homeOnly)
                    if !model.autoNote.isEmpty {
                        Text(model.autoNote).font(.footnote).foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Synchroniseren")
                } footer: {
                    Text("Automatisch hooguit één keer per uur, ook op de achtergrond. \"Alleen thuis\": alleen op wifi en als je GymCoach-server bereikbaar is. Zet dit uit als GymCoach later via internet bereikbaar is. De knoppen hierboven werken altijd.")
                }

                Section("Laatste sync") {
                    LabeledContent("Tijd", value: model.lastSync.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "—")
                    LabeledContent("Resultaat", value: model.lastResult.isEmpty ? "—" : model.lastResult)
                }

                Section {
                    Text("Workouts (soort, duur, afstand, actieve energie, hartslag en hartslagverloop) en per dag: stappen, actieve energie, wandel-/loopafstand en hartslag in rust. Niets anders.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("Wat wordt gedeeld")
                }
            }
            .navigationTitle("GymCoach Sync")
        }
    }
}
