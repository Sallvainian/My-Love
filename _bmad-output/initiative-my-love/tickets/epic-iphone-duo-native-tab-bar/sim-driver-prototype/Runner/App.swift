import SwiftUI
import UserNotifications
import UIKit

// Probe host app. Launch environment PROBE picks the action:
//   request  - ask notification permission, register for remote pushes
//   schedule - schedule a local notification an hour out ("PendingProbe")
// Results go to Documents/probe.txt.
final class Delegate: NSObject, UIApplicationDelegate {
    func write(_ s: String) {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("probe.txt")
        let old = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
        try? (old + s + "\n").write(to: url, atomically: true, encoding: .utf8)
    }
    func application(_ app: UIApplication, didFinishLaunchingWithOptions o: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let probe = ProcessInfo.processInfo.environment["PROBE"] ?? ""
        let c = UNUserNotificationCenter.current()
        if probe == "request" {
            c.requestAuthorization(options: [.alert, .badge, .sound]) { ok, err in
                self.write("auth granted=\(ok) err=\(String(describing: err))")
                DispatchQueue.main.async { app.registerForRemoteNotifications() }
            }
        }
        if probe == "schedule" {
            let content = UNMutableNotificationContent()
            content.title = "PendingProbe"
            content.body = "probe body"
            content.threadIdentifier = "probe-thread"
            let req = UNNotificationRequest(identifier: "pending-probe", content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: 3600, repeats: false))
            c.add(req) { err in self.write("scheduled err=\(String(describing: err))") }
        }
        return true
    }
    func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken t: Data) {
        write("token=" + t.map { String(format: "%02x", $0) }.joined())
    }
    func application(_ app: UIApplication, didFailToRegisterForRemoteNotificationsWithError e: Error) {
        write("register failed: \(e)")
    }
}
@main struct RunnerApp: App {
    @UIApplicationDelegateAdaptor(Delegate.self) var delegate
    var body: some Scene { WindowGroup { Text("runner") } }
}
