import XCTest

// Drives an installed app: optional orientation, then an optional tap at a point
// given in the app's own (orientation-relative) points. Inputs come from the
// environment (TEST_RUNNER_ prefix stripped by xcodebuild).
final class Drive: XCTestCase {
    func testDrive() throws {
        let env = ProcessInfo.processInfo.environment
        let app = XCUIApplication(bundleIdentifier: env["BUNDLE"] ?? "dev.sallvain.mylove")
        app.activate()
        switch env["ORIENT"] ?? "" {
        case "portrait": XCUIDevice.shared.orientation = .portrait
        case "landscapeLeft": XCUIDevice.shared.orientation = .landscapeLeft
        case "landscapeRight": XCUIDevice.shared.orientation = .landscapeRight
        default: break
        }
        sleep(2)
        if let xs = env["TAP_X"], let ys = env["TAP_Y"], let x = Double(xs), let y = Double(ys) {
            let web = app.webViews.firstMatch; _ = web.waitForExistence(timeout: 5); print("DRIVE webview frame=\(web.frame)"); let origin = web.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            origin.withOffset(CGVector(dx: x, dy: y)).tap()
            sleep(1)
        }
        if env["TAP_FIELD"] == "1" {
            let field = app.webViews.textFields.firstMatch
            print("DRIVE field exists=\(field.waitForExistence(timeout: 5)) frame=\(field.frame)")
            field.tap()
            sleep(1)
        }
        if env["DUMP"] == "1" {
            let q = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS 'inset' OR label CONTAINS 'last tap'"))
            for i in 0..<q.count { print("DRIVE text: " + q.element(boundBy: i).label.replacingOccurrences(of: "\n", with: " | ")) }
        }
        let f = app.frame
        print("DRIVE frame=\(f.width)x\(f.height) orient=\(XCUIDevice.shared.orientation.rawValue)")
    }
}
