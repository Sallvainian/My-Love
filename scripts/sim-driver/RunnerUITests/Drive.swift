import XCTest

// Drives the installed shell for scripts/sim-driver/sim, one step per run.
// ACTION comes from the environment (xcodebuild strips the TEST_RUNNER_
// prefix) and picks the step:
//   tap X Y                 tap at page point X,Y, offset from the web view's
//                           origin (never the app frame, which XCUITest
//                           reports as portrait on the unfolded display)
//   scroll up|down          swipe the web view to show what is above or below
//   dump                    print the web view's elements as one JSON line,
//                           frames in the same page points `tap` takes
//   signin EMAIL PASSWORD   fill the login form and submit it
//   signout                 tap Settings, then Sign out, and wait for the
//                           login form
// Every step brings the shell to the front first. Backgrounding is not a
// step: XCUIDevice's Home press leaves the shell in front on the Duo
// simulator, so `sim background` presses Device Hub's Home through ax.
// Lines meant for the caller start with "DRIVE ".
final class Drive: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "dev.sallvain.mylove")

    func say(_ s: String) { print("DRIVE " + s) }

    func webView() -> XCUIElement {
        let web = app.webViews.firstMatch
        if !web.waitForExistence(timeout: 15) { XCTFail("no web view on screen") }
        return web
    }

    func testDrive() throws {
        let words = (ProcessInfo.processInfo.environment["ACTION"] ?? "")
            .split(separator: " ").map(String.init)
        guard let verb = words.first else { return XCTFail("ACTION is empty") }
        app.activate()
        if !app.wait(for: .runningForeground, timeout: 15) { return XCTFail("shell not in front") }
        switch (verb, words.count) {
        case ("tap", 3):
            guard let x = Double(words[1]), let y = Double(words[2]) else { return XCTFail("tap X Y takes numbers") }
            let web = webView()
            web.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
            sleep(1)
            say("tapped \(words[1]),\(words[2]) webView=\(rect(web.frame))")
        case ("scroll", 2):
            let web = webView()
            switch words[1] {
            case "down": web.swipeUp()
            case "up": web.swipeDown()
            default: return XCTFail("scroll takes up or down")
            }
            sleep(1)
            say("scrolled \(words[1])")
        case ("dump", 1):
            say(try dump(webView()))
        case ("signin", 3):
            try signIn(email: words[1], password: words[2])
        case ("signout", 1):
            signOut()
        default:
            XCTFail("unknown ACTION: \(words.joined(separator: " "))")
        }
    }

    func signIn(email: String, password: String) throws {
        let field = app.webViews.textFields.firstMatch
        guard field.waitForExistence(timeout: 20) else {
            return XCTFail("login form not shown: already signed in, or the page did not load")
        }
        let secret = app.webViews.secureTextFields.firstMatch
        // A failed attempt leaves its text in the fields, and typing inserts
        // wherever the cursor lands (long text overflows, so no tap reaches
        // its end); a relaunch shows the form empty. It also swaps in a live
        // update the shell has queued, as backgrounding would.
        if holdsText(field) || holdsText(secret) {
            app.terminate()
            app.activate()
            guard field.waitForExistence(timeout: 20) else {
                return XCTFail("login form not shown after relaunching the shell")
            }
            say("relaunched the shell to empty the login form (a queued live update swaps in now)")
        }
        field.tap()
        field.typeText(email)
        secret.tap()
        // Return submits the form, so the keyboard cannot hide the button.
        secret.typeText(password + "\n")
        let gone = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: secret)
        if XCTWaiter.wait(for: [gone], timeout: 20) != .completed {
            let texts = app.webViews.staticTexts.allElementsBoundByIndex.prefix(40).map(\.label)
            return XCTFail("still on the login form: " + texts.joined(separator: " | "))
        }
        say("signed in as \(email)")
        // The welcome splash shows after some sign-ins; its Continue reaches Home.
        let home = app.webViews.buttons["Home"]
        let welcome = app.webViews.staticTexts["Welcome to Your App"]
        for _ in 0..<20 where !home.exists {
            if welcome.exists {
                app.webViews.buttons["Continue"].tap()
                say("dismissed the welcome splash")
            }
            sleep(1)
        }
        if !home.waitForExistence(timeout: 10) { XCTFail("signed in, but the Home button never showed") }
    }

    // Settings is the header's gear in the bottom dock and the capsule's sixth
    // button in the column form; both are labelled "Settings".
    func signOut() {
        let settings = app.webViews.buttons["Settings"].firstMatch
        guard settings.waitForExistence(timeout: 15) else {
            return XCTFail("no Settings button: signed out already, or the page did not load")
        }
        settings.tap()
        let signOut = app.webViews.buttons["Sign out"].firstMatch
        // The button sits at the end of Settings; swipe until it shows.
        for _ in 0..<8 where !signOut.isHittable {
            if !signOut.exists { _ = signOut.waitForExistence(timeout: 2) }
            if signOut.isHittable { break }
            app.webViews.firstMatch.swipeUp()
        }
        guard signOut.isHittable else { return XCTFail("no Sign out button in Settings") }
        signOut.tap()
        if !app.webViews.textFields.firstMatch.waitForExistence(timeout: 20) {
            return XCTFail("tapped Sign out, but the login form never showed")
        }
        say("signed out")
    }

    // An empty web field may report its placeholder as its value.
    func holdsText(_ field: XCUIElement) -> Bool {
        let value = field.value as? String ?? ""
        return !value.isEmpty && value != field.placeholderValue
    }

    // The web view's descendants from one snapshot; frames are relative to the
    // web view's origin, so a frame's centre can be passed back to `tap`.
    func dump(_ web: XCUIElement) throws -> String {
        let root = try web.snapshot()
        let origin = root.frame.origin
        var out: [[String: Any]] = []
        func walk(_ node: XCUIElementSnapshot) {
            for child in node.children {
                let value = child.value.map { "\($0)" } ?? ""
                if child.elementType != .other || !child.label.isEmpty || !value.isEmpty {
                    var item: [String: Any] = [
                        "type": typeName(child.elementType),
                        "label": child.label,
                        "frame": box(child.frame, minus: origin),
                    ]
                    if !value.isEmpty && value != child.label { item["value"] = value }
                    out.append(item)
                }
                walk(child)
            }
        }
        walk(root)
        let doc: [String: Any] = ["webView": box(root.frame, minus: .zero), "elements": out]
        let data = try JSONSerialization.data(withJSONObject: doc, options: [.sortedKeys])
        return String(decoding: data, as: UTF8.self)
    }

    func box(_ r: CGRect, minus o: CGPoint) -> [String: Double] {
        let n = { (v: CGFloat) in (Double(v) * 10).rounded() / 10 }
        return ["x": n(r.minX - o.x), "y": n(r.minY - o.y), "w": n(r.width), "h": n(r.height)]
    }

    func rect(_ r: CGRect) -> String {
        "\(Int(r.minX)),\(Int(r.minY)) \(Int(r.width))x\(Int(r.height))"
    }

    func typeName(_ t: XCUIElement.ElementType) -> String {
        switch t {
        case .staticText: return "text"
        case .button: return "button"
        case .link: return "link"
        case .textField: return "textField"
        case .secureTextField: return "secureTextField"
        case .textView: return "textView"
        case .image: return "image"
        case .switch: return "switch"
        case .slider: return "slider"
        case .tab: return "tab"
        case .tabBar: return "tabBar"
        case .navigationBar: return "navigationBar"
        case .cell: return "cell"
        case .table: return "table"
        case .scrollView: return "scrollView"
        case .webView: return "webView"
        case .alert: return "alert"
        case .dialog: return "dialog"
        case .menu: return "menu"
        case .menuItem: return "menuItem"
        case .radioButton: return "radioButton"
        case .checkBox: return "checkBox"
        case .other: return "other"
        default: return "type\(t.rawValue)"
        }
    }
}
