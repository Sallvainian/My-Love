import XCTest

// Notification steps for scripts/sim-driver/sim, one per run, against an app
// and SpringBoard. ACTION comes from the environment (xcodebuild strips the
// TEST_RUNNER_ prefix) as tab-separated fields, since an icon name can hold
// spaces: STEP BUNDLE ICON [ARGS]. BUNDLE is the shell or the runner's host
// app (`sim ... --host`), ICON its Home Screen name ("My Love" or "Runner").
//   permission allow|deny   bring the app to the front (the host launched
//                           with PROBE=request, so it asks), then tap Allow or
//                           Don't Allow on SpringBoard's alert; for the host,
//                           print its status line
//   banner [cold|background] put Settings in front, say "watching" once no
//                           earlier banner remains (sim then pushes), print
//                           the banner's label; cold terminates the app
//                           first, background launches it first, and both
//                           tap the banner, printing the app's state before
//                           and after
//   center                  open Notification Center (sim presses Home
//                           first), print the app's groups as one JSON line
//   badge                   print the app icon's value, or none
// Elements are matched by identifier or label across every type, since
// SpringBoard's types change between releases. Lines meant for the caller
// start with "NOTIFY " and are flushed at once: a banner lasts seconds.
struct NotifyError: Error, CustomStringConvertible {
    let description: String
    init(_ s: String) { description = s }
}

final class Notify: XCTestCase {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    let host = "dev.sallvain.simdriver.runner"

    func say(_ s: String) {
        print("NOTIFY " + s)
        fflush(stdout)
    }

    func any(_ root: XCUIElement, _ format: String, _ args: Any...) -> XCUIElementQuery {
        root.descendants(matching: .any).matching(NSPredicate(format: format, argumentArray: args))
    }

    func testStep() throws {
        let fields = (ProcessInfo.processInfo.environment["ACTION"] ?? "")
            .split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
        guard fields.count >= 3 else { return XCTFail("ACTION needs STEP, BUNDLE and ICON: \(fields)") }
        let (step, bundle, icon) = (fields[0], fields[1], fields[2])
        let args = Array(fields.dropFirst(3))
        let app = XCUIApplication(bundleIdentifier: bundle)
        switch (step, args.count) {
        case ("permission", 1) where ["allow", "deny"].contains(args[0]):
            try permission(app, isHost: bundle == host, allow: args[0] == "allow")
        case ("banner", 0):
            try banner(app, icon, tap: nil)
        case ("banner", 1) where ["cold", "background"].contains(args[0]):
            try banner(app, icon, tap: args[0])
        case ("center", 0):
            try center(icon)
        case ("badge", 0):
            badge(icon)
        default:
            XCTFail("unknown ACTION: \(fields.joined(separator: " "))")
        }
    }

    // SpringBoard's alert writes Don't with either apostrophe.
    func permission(_ app: XCUIApplication, isHost: Bool, allow: Bool) throws {
        if isHost {
            app.launchEnvironment["PROBE"] = "request"
            app.launch()
        } else {
            app.activate()
        }
        let names = allow ? ["Allow"] : ["Don't Allow", "Don\u{2019}t Allow"]
        let button = any(springboard, "identifier IN %@ OR label IN %@", names, names).firstMatch
        guard button.waitForExistence(timeout: 20) else {
            return XCTFail("no permission alert (an app that has already answered is not asked again: sim permission reset)")
        }
        button.tap()
        say("tapped \(allow ? "Allow" : "Don't Allow")")
        guard isHost else { return }
        let status = any(app, "identifier == 'status'").firstMatch
        let decided = NSPredicate(format: "label IN %@", ["authorized", "denied", "provisional", "ephemeral"])
        let wait = expectation(for: decided, evaluatedWith: status)
        if XCTWaiter.wait(for: [wait], timeout: 10) != .completed {
            return XCTFail("host status never settled: \(status.exists ? status.label : "no status line")")
        }
        say("status: \(status.label)")
    }

    func banner(_ app: XCUIApplication, _ icon: String, tap: String?) throws {
        if tap == "cold" { app.terminate() }
        // activate, not launch: launch would end a running instance, and
        // "background" means the app the caller left running.
        if tap == "background" {
            app.activate()
            _ = app.wait(for: .runningForeground, timeout: 10)
        }
        // A banner never shows for the app in front, and a test run leaves its
        // target there; a push sent before the app has left shows none later.
        settings.activate()
        _ = settings.wait(for: .runningForeground, timeout: 10)
        if !until(15, { app.state != .runningForeground }) {
            return XCTFail("the app stayed in front of Settings")
        }
        let banners = any(springboard, "identifier == 'NotificationShortLookView'")
        if !until(20, { banners.count == 0 }) { return XCTFail("an earlier banner never went away") }
        say("watching")
        // SpringBoard's label starts with the app's name in capitals.
        let banner = any(springboard, "identifier == 'NotificationShortLookView' AND label BEGINSWITH[c] %@", icon + ",").firstMatch
        guard banner.waitForExistence(timeout: 20) else { return XCTFail("no banner") }
        say("banner: " + banner.label.replacingOccurrences(of: "\n", with: " | "))
        guard tap != nil else { return }
        let before = app.state
        say("before tap: \(name(before))")
        let expected: [XCUIApplication.State] = tap == "cold"
            ? [.notRunning] : [.runningBackground, .runningBackgroundSuspended]
        if !expected.contains(before) {
            return XCTFail("before the tap the app is \(name(before)), not \(tap ?? "") as asked")
        }
        banner.tap()
        _ = app.wait(for: .runningForeground, timeout: 10)
        say("after tap: \(name(app.state))")
        if app.state != .runningForeground { XCTFail("tap missed: the app is \(name(app.state))") }
    }

    // Notification Center stacks every notification; a tap on a stacked
    // ("Grouped") cell expands it, the whole stack first, then each thread's
    // group, which then shows a header ("Show less", Clear) above its cells,
    // one per notification. It keeps its scroll position and expansions
    // between openings, a pull past the top of the list folds it into an
    // "N Notifications" pill or opens Spotlight, and a fast swipe at its end
    // can close Notification Center. So the list is dragged back to its top
    // by exactly the distance left (its first cell, an empty one, sits at
    // y 0 there), then down a screen at a time with slow drags that end held
    // (no coasting), until a drag moves nothing, each visible stacked cell
    // expanded and each screen read on the way. Notifications are told apart
    // by title and body, so one group's cells seen on two screens count once,
    // and two identical notifications in one group count as one.
    func center(_ icon: String) throws {
        skipIdleWaits()
        let stacked = any(springboard, "identifier == 'NotificationShortLookView' AND label BEGINSWITH[c] %@", icon + ", Grouped,")
        let list = any(springboard, "identifier == 'combined-list-view'").firstMatch
        springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.005))
            .press(forDuration: 0.1, thenDragTo: springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7)))
        guard list.waitForExistence(timeout: 5) else { return XCTFail("Notification Center did not open") }
        sleep(1)
        let step = list.frame.height * 0.4
        var top = false
        for _ in 0..<30 {
            let left = try distanceToTop(list.frame)
            // A drag shorter than the touch slop does not scroll.
            if left < 15 { top = true; break }
            drag(list, by: min(left, step))
        }
        if !top { return XCTFail("Notification Center's list never reached its top") }
        var groups: [[String]] = []
        for _ in 0..<30 {
            var taps = 0
            while let cell = try stacked.allElementsBoundByIndex.first(where: { try reachable($0, in: list.frame) }) {
                taps += 1
                if taps > 30 { return XCTFail("stacked notifications never expanded") }
                tap(cell)
            }
            merge(&groups, try screenGroups(icon),
                  same: { !Set($0).isDisjoint(with: $1) },
                  combine: { merge(&$0, $1, same: ==, combine: { _, _ in }) })
            // The list ends in a pile of shrunk cells (the oldest groups) that
            // slow drags leave folded and a fast swipe opens.
            let before = try cellFrames()
            drag(list, by: -step)
            if try cellFrames() == before {
                list.swipeUp()
                sleep(1)
                if try cellFrames() == before { break }
            }
        }
        let doc: [String: Any] = ["groups": groups.map { ["text": $0[0], "count": $0.count] }]
        let data = try JSONSerialization.data(withJSONObject: doc, options: [.sortedKeys])
        say(String(decoding: data, as: UTF8.self))
    }

    // How far the list's first cell (unlabelled) sits above its place at the
    // list's top: 0 at the top, a full drag's worth when it is not in the
    // tree at all (scrolled far down). A drag can leave it a few points off.
    func distanceToTop(_ frame: CGRect) throws -> CGFloat {
        func first(_ n: XCUIElementSnapshot) -> XCUIElementSnapshot? {
            if n.identifier == "ListCell" { return n }
            for c in n.children { if let hit = first(c) { return hit } }
            return nil
        }
        let list = try springboard.descendants(matching: .any).matching(identifier: "combined-list-view").firstMatch.snapshot()
        guard let cell = first(list) else { return 0 }
        if !cell.label.isEmpty { return frame.height * 0.4 }
        return max(0, frame.minY - cell.frame.minY)
    }

    // The frames of the list's cells: a drag that leaves them all in place
    // met the list's end.
    func cellFrames() throws -> [CGRect] {
        var cells: [CGRect] = []
        func walk(_ n: XCUIElementSnapshot) {
            if n.identifier == "ListCell" { cells.append(n.frame) }
            n.children.forEach(walk)
        }
        walk(try springboard.descendants(matching: .any).matching(identifier: "combined-list-view").firstMatch.snapshot())
        return cells
    }

    // A stacked cell can be tapped when XCUITest calls it hittable, or when it
    // is drawn shrunk near the list's bottom edge (XCUITest then says it is
    // not) with no other cell over its centre; a card behind another in a
    // stack has the front card over it, and a tap there opens that one.
    func reachable(_ cell: XCUIElement, in list: CGRect) throws -> Bool {
        if cell.isHittable { return true }
        let at = cell.frame
        guard list.contains(at) else { return false }
        let centre = CGPoint(x: at.midX, y: at.midY)
        return try cellFrames().filter { $0.contains(centre) }.count == 1
    }

    // Cells near the list's bottom edge are drawn shrunk, and XCUITest calls
    // them not hittable; those are tapped at their centre through
    // SpringBoard's coordinates (a coordinate on the cell itself makes
    // XCUITest wait out the "banner" as an interruption).
    func tap(_ cell: XCUIElement) {
        if cell.isHittable {
            cell.tap()
        } else {
            let at = cell.frame, screen = springboard.frame.origin
            springboard.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: at.midX - screen.x, dy: at.midY - screen.y)).tap()
        }
        sleep(1)
    }

    // With Notification Center open, SpringBoard at times never reports its
    // animations done, and XCUITest then waits 60 s before and after every
    // tap and drag (a run took 376 s, the next never finished). Its private
    // XCUIApplicationProcess asks shouldSkipPre/PostEventQuiescence first;
    // answering yes skips those waits, and center pauses after each action
    // itself. A release without those methods only brings the waits back.
    func skipIdleWaits() {
        guard let process = NSClassFromString("XCUIApplicationProcess") else { return }
        let yes: @convention(block) (AnyObject) -> Bool = { _ in true }
        for name in ["shouldSkipPreEventQuiescence", "shouldSkipPostEventQuiescence"] {
            if let method = class_getInstanceMethod(process, NSSelectorFromString(name)) {
                method_setImplementation(method, imp_implementationWithBlock(yes))
            }
        }
    }

    // Merges one screen's items, top to bottom, into those seen so far in
    // screen order: a new item goes after the seen item above it on the same
    // screen, or before the first seen item below it, or (a screen sharing
    // nothing) after everything. Returns whether any item was new.
    @discardableResult
    func merge<T>(_ all: inout [T], _ screen: [T],
                  same: (T, T) -> Bool, combine: (inout T, T) -> Void) -> Bool {
        var fresh = false
        var last: Int?
        var above: [T] = []
        for item in screen {
            if var i = all.firstIndex(where: { same($0, item) }) {
                if last == nil && !above.isEmpty {
                    all.insert(contentsOf: above, at: i)
                    i += above.count
                    above = []
                }
                combine(&all[i], item)
                last = i
            } else {
                fresh = true
                if let l = last { all.insert(item, at: l + 1); last = l + 1 } else { above.append(item) }
            }
        }
        all.append(contentsOf: above)
        return fresh
    }

    // Drags the list's content BY points (down when positive) through its
    // middle, holding at the end so it does not coast on.
    func drag(_ list: XCUIElement, by points: CGFloat) {
        let mid = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let half = points / 2
        mid.withOffset(CGVector(dx: 0, dy: -half))
            .press(forDuration: 0.1, thenDragTo: mid.withOffset(CGVector(dx: 0, dy: half)),
                   withVelocity: .slow, thenHoldForDuration: 0.3)
        sleep(1)
    }

    // The app's groups on screen, top to bottom, each as its members' texts.
    // An expanded group's cells (and its header) share one parent; a group
    // still stacked is a single "Grouped" cell, its own group.
    func screenGroups(_ icon: String) throws -> [[String]] {
        let root = try springboard.snapshot()
        func find(_ n: XCUIElementSnapshot, _ match: (XCUIElementSnapshot) -> Bool) -> XCUIElementSnapshot? {
            if match(n) { return n }
            for c in n.children { if let hit = find(c, match) { return hit } }
            return nil
        }
        func isCell(_ n: XCUIElementSnapshot) -> Bool {
            n.identifier == "ListCell" && n.label.uppercased().hasPrefix(icon.uppercased() + ",")
        }
        func isStacked(_ n: XCUIElementSnapshot) -> Bool {
            n.label.uppercased().hasPrefix(icon.uppercased() + ", GROUPED,")
        }
        func text(_ cell: XCUIElementSnapshot) -> String {
            let title = find(cell) { $0.identifier == "NotificationTitle" }?.label ?? ""
            let message = find(cell) { $0.identifier.contains("originalMessage") }
            let body = message.flatMap { find($0) { $0.identifier == "TextContent.Primary" } }?.label ?? ""
            let joined = [title, body].filter { !$0.isEmpty }.joined(separator: ", ")
            // A cell with neither part falls back to its whole label, so two
            // such cells are not read as one empty text.
            return joined.isEmpty ? cell.label : joined
        }
        var out: [(y: CGFloat, texts: [String])] = []
        func walk(_ n: XCUIElementSnapshot) {
            if isCell(n) { out.append((n.frame.minY, [text(n)])); return }
            let cells = n.children.filter { isCell($0) && !isStacked($0) }
            if let top = cells.map(\.frame.minY).min() { out.append((top, cells.map(text))) }
            n.children.filter { !isCell($0) || isStacked($0) }.forEach(walk)
        }
        walk(root)
        return out.sorted { $0.y < $1.y }.map(\.texts)
    }

    // Two icons can share the name (the Duo simulator's Home Screen has two
    // called "My Love"), so the badge is the value of any icon of that name
    // that has one.
    func badge(_ icon: String) {
        let icons = any(springboard, "identifier == %@ OR label == %@", icon, icon)
        guard icons.firstMatch.waitForExistence(timeout: 10) else { return XCTFail("no \(icon) icon on SpringBoard") }
        let values = icons.allElementsBoundByIndex.map { $0.value.map { "\($0)" } ?? "" }
        say("badge: " + (values.first { !$0.isEmpty } ?? "none"))
    }

    // Polls while turning the run loop: XCUIApplication.state is updated from
    // it, so a usleep loop reads the state it started with forever.
    func until(_ timeout: TimeInterval, _ done: () -> Bool) -> Bool {
        let end = Date().addingTimeInterval(timeout)
        while !done() {
            if Date() > end { return false }
            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }
        return true
    }

    func name(_ s: XCUIApplication.State) -> String {
        switch s {
        case .notRunning: return "notRunning"
        case .runningBackgroundSuspended: return "runningBackgroundSuspended"
        case .runningBackground: return "runningBackground"
        case .runningForeground: return "runningForeground"
        default: return "unknown"
        }
    }
}
