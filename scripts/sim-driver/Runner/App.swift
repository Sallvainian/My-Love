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
//   launched with REMOVE         (a JSON array of identifiers) removes those
//   and/or SCHEDULE              pending requests, then adds SCHEDULE's (a
//                                JSON array, the shape of
//                                fixtures/host-requests.json), and writes
//                                "ok" or why not to Documents/schedule-result.txt,
//                                which `sim schedule` / `sim unschedule` read.
//                                The host's own requests are the only ones
//                                whose contents are known, so they are what
//                                `sim pending` is proven against.
// No remote registration: `xcrun simctl push` delivers without it.
final class Delegate: NSObject, UIApplicationDelegate {
    func application(_ app: UIApplication, didFinishLaunchingWithOptions o: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        if ProcessInfo.processInfo.environment["PROBE"] == "request" {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in
                DispatchQueue.main.async { NotificationCenter.default.post(name: .asked, object: nil) }
            }
        }
        applyRequests(environment: ProcessInfo.processInfo.environment)
        return true
    }
}

// Where `sim` looks for the outcome of a REMOVE / SCHEDULE launch; it deletes
// the file before launching, so a line found is always this launch's.
func report(_ line: String) {
    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    try? line.write(to: dir.appendingPathComponent("schedule-result.txt"), atomically: true, encoding: .utf8)
}

struct BadRequest: Error { let why: String }

func jsonArray(_ text: String, _ name: String) throws -> [Any] {
    guard let data = text.data(using: .utf8),
          let array = try? JSONSerialization.jsonObject(with: data) as? [Any]
    else { throw BadRequest(why: "\(name) is not a JSON array") }
    return array
}

// One SCHEDULE entry: {identifier, title, body, threadId, trigger}, where
// trigger is {type: "interval", seconds, repeats} or {type: "calendar",
// dateComponents: {year, month, day, hour, minute, second, weekday}, repeats}.
// `sim` validates the same shape before launching; this refuses what it cannot
// read rather than scheduling something other than what was asked.
func makeRequest(_ any: Any) throws -> UNNotificationRequest {
    guard let item = any as? [String: Any],
          let id = item["identifier"] as? String,
          let title = item["title"] as? String,
          let body = item["body"] as? String,
          let thread = item["threadId"] as? String,
          let trigger = item["trigger"] as? [String: Any],
          let repeats = trigger["repeats"] as? Bool
    else { throw BadRequest(why: "a request lacks identifier, title, body, threadId or trigger.repeats") }
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.threadIdentifier = thread
    switch trigger["type"] as? String {
    case "interval":
        guard let seconds = trigger["seconds"] as? Double
        else { throw BadRequest(why: "\(id): interval trigger lacks seconds") }
        return UNNotificationRequest(identifier: id, content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: repeats))
    case "calendar":
        guard let parts = trigger["dateComponents"] as? [String: Int]
        else { throw BadRequest(why: "\(id): calendar trigger lacks integer dateComponents") }
        var components = DateComponents()
        for (key, value) in parts {
            switch key {
            case "year": components.year = value
            case "month": components.month = value
            case "day": components.day = value
            case "hour": components.hour = value
            case "minute": components.minute = value
            case "second": components.second = value
            case "weekday": components.weekday = value
            default: throw BadRequest(why: "\(id): unknown date component \(key)")
            }
        }
        return UNNotificationRequest(identifier: id, content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: repeats))
    default:
        throw BadRequest(why: "\(id): unknown trigger type")
    }
}

func applyRequests(environment env: [String: String]) {
    guard env["SCHEDULE"] != nil || env["REMOVE"] != nil else { return }
    let center = UNUserNotificationCenter.current()
    // Everything is parsed before anything changes, so a bad SCHEDULE leaves
    // the pending list as it was.
    let remove: [String]
    let requests: [UNNotificationRequest]
    do {
        remove = try env["REMOVE"].map { try jsonArray($0, "REMOVE").compactMap { $0 as? String } } ?? []
        requests = try env["SCHEDULE"].map { try jsonArray($0, "SCHEDULE").map(makeRequest) } ?? []
    } catch let bad as BadRequest {
        return report("error: \(bad.why)")
    } catch {
        return report("error: \(error)")
    }
    if !remove.isEmpty { center.removePendingNotificationRequests(withIdentifiers: remove) }
    if env["SCHEDULE"] == nil { return report("ok") }
    // add() reports a refusal only through its completion, and a host
    // that is not authorized would otherwise look like a bad request.
    center.getNotificationSettings { settings in
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: break
        default: return report("not authorized")
        }
        // The completions run on background queues; the lock serialises the
        // write to the first failure.
        let lock = NSLock()
        let group = DispatchGroup()
        var failure: String?
        for request in requests {
            group.enter()
            center.add(request) { error in
                if let error {
                    lock.lock()
                    if failure == nil { failure = "\(request.identifier): \(error)" }
                    lock.unlock()
                }
                group.leave()
            }
        }
        group.notify(queue: .main) {
            lock.lock()
            let outcome = failure.map { "error: \($0)" } ?? "ok"
            lock.unlock()
            report(outcome)
        }
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
