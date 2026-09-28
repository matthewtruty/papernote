import AppKit
import SwiftUI

enum AppAppearance: String, CaseIterable {
    case system = "System"
    case light  = "Light"
    case dark   = "Dark"

    var nsAppearance: NSAppearance? {
        switch self {
        case .system: return nil
        case .light:  return NSAppearance(named: .aqua)
        case .dark:   return NSAppearance(named: .darkAqua)
        }
    }
}

struct SettingsView: View {
    @AppStorage("appearance") private var appearanceRaw = AppAppearance.system.rawValue

    private var appearance: AppAppearance {
        AppAppearance(rawValue: appearanceRaw) ?? .system
    }

    var body: some View {
        Form {
            Picker("Appearance", selection: $appearanceRaw) {
                ForEach(AppAppearance.allCases, id: \.rawValue) { option in
                    Text(option.rawValue).tag(option.rawValue)
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        }
        .formStyle(.grouped)
        .frame(width: 300, height: 140)
    }
}
