import ExpoModulesCore

#if canImport(FamilyControls)
import FamilyControls
#endif

#if canImport(ManagedSettings)
import ManagedSettings
#endif

#if canImport(SwiftUI)
import SwiftUI
#endif

public class FocusBlockingModule: Module {

    public func definition() -> ModuleDefinition {
        Name("FocusBlocking")

        Function("isAvailable") { () -> Bool in
            #if canImport(FamilyControls)
            if #available(iOS 16.0, *) { return true }
            #endif
            return false
        }

        Function("isBlocking") { () -> Bool in
            return false
        }

        AsyncFunction("requestAuthorization") { (promise: Promise) in
            #if canImport(FamilyControls)
            if #available(iOS 16.0, *) {
                Task {
                    do {
                        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                        promise.resolve(true)
                    } catch {
                        promise.resolve(false)
                    }
                }
                return
            }
            #endif
            promise.resolve(false)
        }

        AsyncFunction("openAppPicker") { (promise: Promise) in
            #if canImport(FamilyControls) && canImport(SwiftUI)
            if #available(iOS 16.0, *) {
                DispatchQueue.main.async {
                    let store = FBSelectionStore.shared
                    let sheet = FBPickerSheet(store: store) {
                        self.topViewController()?.dismiss(animated: true) {
                            promise.resolve(true)
                        }
                    }
                    let host = UIHostingController(rootView: sheet)
                    host.modalPresentationStyle = .pageSheet
                    if let top = self.topViewController() {
                        top.present(host, animated: true)
                    } else {
                        promise.resolve(false)
                    }
                }
                return
            }
            #endif
            promise.resolve(false)
        }

        AsyncFunction("startBlocking") { (promise: Promise) in
            #if canImport(FamilyControls) && canImport(ManagedSettings)
            if #available(iOS 16.0, *) {
                let managed = ManagedSettingsStore()
                let sel = FBSelectionStore.shared.selection
                if !sel.applicationTokens.isEmpty {
                    managed.shield.applications = sel.applicationTokens
                }
                if !sel.categoryTokens.isEmpty {
                    managed.shield.applicationCategories = .specific(sel.categoryTokens)
                }
                promise.resolve(true)
                return
            }
            #endif
            promise.resolve(false)
        }

        AsyncFunction("stopBlocking") { (promise: Promise) in
            #if canImport(ManagedSettings)
            if #available(iOS 16.0, *) {
                let managed = ManagedSettingsStore()
                managed.clearAllSettings()
                promise.resolve(true)
                return
            }
            #endif
            promise.resolve(false)
        }

        // Android-only stubs so JS calls don't crash
        Function("hasPermissions") { () -> Bool in return true }
        Function("hasUsageAccess") { () -> Bool in return true }
        Function("hasOverlayPermission") { () -> Bool in return true }
        AsyncFunction("requestUsageAccess") { (promise: Promise) in promise.resolve(nil) }
        AsyncFunction("requestOverlayPermission") { (promise: Promise) in promise.resolve(nil) }
        AsyncFunction("getInstalledApps") { (promise: Promise) in promise.resolve([Any]()) }
    }

    private func topViewController() -> UIViewController? {
        var vc = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first?.rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }
}

// ── Shared selection store ──────────────────────────────────────

#if canImport(FamilyControls)
@available(iOS 16.0, *)
class FBSelectionStore: ObservableObject {
    static let shared = FBSelectionStore()
    @Published var selection = FamilyActivitySelection()
}
#endif

// ── SwiftUI picker wrapper ──────────────────────────────────────

#if canImport(FamilyControls) && canImport(SwiftUI)
@available(iOS 16.0, *)
struct FBPickerSheet: View {
    @ObservedObject var store: FBSelectionStore
    var onDone: () -> Void

    var body: some View {
        NavigationView {
            FamilyActivityPicker(selection: $store.selection)
                .navigationTitle("Dooro apps")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Kaydi") { onDone() }
                    }
                }
        }
    }
}
#endif
