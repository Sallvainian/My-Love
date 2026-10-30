import XCTest

// Notification probes against the host app and SpringBoard. NSTEP picks one.
final class Notify: XCTestCase {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    func dump(_ e: XCUIElement, _ tag: String) {
        let q = e.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] 'probe' OR label CONTAINS[c] 'runner' OR identifier CONTAINS[c] 'runner'"))
        for i in 0..<min(q.count, 12) { let x = q.element(boundBy: i); print("NOTE \(tag): type=\(x.elementType.rawValue) id=\(x.identifier) label=\(x.label.replacingOccurrences(of: "\n", with: " | ")) value=\(String(describing: x.value))") }
    }
    func testStep() throws {
        let step = ProcessInfo.processInfo.environment["NSTEP"] ?? ""
        let app = XCUIApplication()
        switch step {
        case "request", "schedule":
            app.launchEnvironment["PROBE"] = step
            app.launch()
            let allow = springboard.buttons["Allow"]
            if allow.waitForExistence(timeout: 5) { allow.tap(); print("NOTE tapped Allow") } else { print("NOTE no Allow alert") }
            sleep(3)
        case "home":
            XCUIDevice.shared.press(.home); sleep(1)
        case "banner":
            // Start before the push; poll SpringBoard for any element mentioning the probe.
            if ProcessInfo.processInfo.environment["BG"] == "1" {
                XCUIApplication(bundleIdentifier: "com.apple.Preferences").activate(); sleep(2)
                print("NOTE runner state while Settings in front=\(app.state.rawValue)")
            }
            print("NOTE watching")
            let q = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] 'probe'"))
            var seen = false
            for _ in 0..<40 { if q.count > 0 { seen = true; break }; usleep(500_000) }
            print("NOTE banner seen=\(seen)")
            if seen {
                dump(springboard, "banner")
                if ProcessInfo.processInfo.environment["TAPBANNER"] == "1" {
                    let b = springboard.descendants(matching: .any).matching(identifier: "NotificationShortLookView").firstMatch
                    print("NOTE before tap runner state=\(app.state.rawValue)")
                    b.tap(); sleep(3)
                    print("NOTE after banner tap runner state=\(app.state.rawValue)")
                }
            }
        case "badge":
            let icon = springboard.icons["Runner"]
            print("NOTE icon exists=\(icon.waitForExistence(timeout: 5)) label=\(icon.label) value=\(String(describing: icon.value))")
        case "center":
            let start = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.01))
            start.press(forDuration: 0.1, thenDragTo: springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7)))
            sleep(2)
            dump(springboard, "center")
            let cell = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] 'probe'")).firstMatch
            if cell.exists {
                cell.tap(); sleep(2); print("NOTE after first tap runner state=\(app.state.rawValue)")
                if app.state != .runningForeground {
                    let n = springboard.descendants(matching: .any).matching(identifier: "NotificationShortLookView").firstMatch
                    if n.waitForExistence(timeout: 3) { print("NOTE expanded: \(n.label)"); n.tap(); sleep(3) }
                    print("NOTE after second tap runner state=\(app.state.rawValue)")
                }
            }
        default: break
        }
    }
}
