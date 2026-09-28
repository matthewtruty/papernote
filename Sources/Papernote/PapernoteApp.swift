import SwiftUI

@main
struct PapernoteApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var noteStore = NoteStore()
    @AppStorage("appearance") private var appearanceRaw = AppAppearance.system.rawValue

    private var resolvedAppearance: NSAppearance? {
        (AppAppearance(rawValue: appearanceRaw) ?? .system).nsAppearance
    }

    var body: some Scene {
        WindowGroup {
            ContentView(store: noteStore)
                .background(WindowConfigurator(appearance: resolvedAppearance))
        }
        .defaultSize(width: 960, height: 760)
        .commands {
            TextEditingCommands()
            TextFormattingCommands()
        }

        Settings {
            SettingsView()
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
}
