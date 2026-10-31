import SwiftUI
import UserNotifications

// Host app for the UI-test target. Drive.swift acts on the shell
// (dev.sallvain.mylove), but a UI-test bundle needs a target app; Notify.swift
// also proves its notification steps on this app (`sim ... --host`), so it
// has the one notification behaviour those steps need and no more:
//   launched with PROBE=request  it asks for permission (alert, badge, sound)
//   the "status" text            the permission as getNotificationSettings
//                                reports it, refreshed whenever it is active
//                                and once the request is answered
// No remote registration: `xcrun simctl push` delivers without it.
final class Delegate: NSObject, UIApplicationDelegate {
    func application(_ app: UIApplication, didFinishLaunchingWithOptions o: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        if ProcessInfo.processInfo.environment["PROBE"] == "request" {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in
                DispatchQueue.main.async { NotificationCenter.default.post(name: .asked, object: nil) }
            }
        }
        return true
    }
}

extension Notification.Name {
    static let asked = Notification.Name("asked")
}

@main struct RunnerApp: App {
    @UIApplicationDelegateAdaptor(Delegate.self) var delegate
    @Environment(\.scenePhase) var phase
    // "pending" until the first getNotificationSettings reply, so a status
    // iOS adds later ("unknown") is told apart from a refresh never run.
    @State var status = "pending"

    var body: some Scene {
        WindowGroup {
            VStack {
                Text("runner")
                Text(status).accessibilityIdentifier("status")
            }
            .onChange(of: phase, initial: true) { _, now in
                if now == .active { refresh() }
            }
            .onReceive(NotificationCenter.default.publisher(for: .asked)) { _ in refresh() }
        }
    }

    func refresh() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let name: String
            switch settings.authorizationStatus {
            case .notDetermined: name = "notDetermined"
            case .denied: name = "denied"
            case .authorized: name = "authorized"
            case .provisional: name = "provisional"
            case .ephemeral: name = "ephemeral"
            @unknown default: name = "unknown"
            }
            DispatchQueue.main.async { status = name }
        }
    }
}
