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
//   banner [cold|background|front]
//                           put Settings in front, say "watching" once no
//                           earlier banner remains (sim then pushes), print
//                           the banner's label; cold terminates the app
//                           first, background launches it first, and both
//                           tap the banner, printing the app's state before
//                           and after; front puts the app itself in front
//                           instead of Settings, which is how a push to the
//                           app in front is checked (it ends in "no banner"
//                           when the shell shows none)
//   watch SECONDS [front]   banner with nothing pushed: wait SECONDS for a
//                           banner (a local notification falling due), the
//                           watch and the banner lines stamped with the time
//   center                  open Notification Center (sim presses Home
//                           first), print the app's groups as one JSON line;
//                           one screen only, failing when more is there
//   badge                   print the app icon's value, or none
//   front                   print the bundle of the known app in front, or
//                           none
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
        case ("banner", 1) where args[0] == "front":
            try banner(app, icon, tap: nil, front: true)
        case ("banner", 1) where ["cold", "background"].contains(args[0]):
            try banner(app, icon, tap: args[0])
        case ("watch", 1), ("watch", 2) where args[1] == "front":
            guard let seconds = TimeInterval(args[0]), seconds > 0 else {
                return XCTFail("watch needs a positive number of seconds: \(args[0])")
            }
            try banner(app, icon, tap: nil, front: args.count == 2, timeout: seconds, stamped: true)
        case ("center", 0):
            try center(icon)
        case ("badge", 0):
            badge(icon)
        case ("front", 0):
            front(bundle)
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

    // watch is banner with nothing pushed: it waits TIMEOUT seconds instead
    // of 20 and stamps its lines with the time, so a check shows
    // the watch spanned the time a local notification was due.
    func banner(_ app: XCUIApplication, _ icon: String, tap: String?, front: Bool = false,
                timeout: TimeInterval = 20, stamped: Bool = false) throws {
        if tap == "cold" { app.terminate() }
        // activate, not launch: launch would end a running instance, and
        // "background" means the app the caller left running.
        if tap == "background" {
            app.activate()
            _ = app.wait(for: .runningForeground, timeout: 10)
        }
        if front {
            // The app in front is the case under test: bring it there and keep
            // it, so a push shows whatever the shell does for a foreground push.
            app.activate()
            if !app.wait(for: .runningForeground, timeout: 10) {
                return XCTFail("the app did not come to the front")
            }
        } else {
            // A banner never shows for the app in front, and a test run leaves its
            // target there; a push sent before the app has left shows none later.
            settings.activate()
            _ = settings.wait(for: .runningForeground, timeout: 10)
            if !until(15, { app.state != .runningForeground }) {
                return XCTFail("the app stayed in front of Settings")
            }
        }
        let banners = any(springboard, "identifier == 'NotificationShortLookView'")
        if !until(20, { banners.count == 0 }) { return XCTFail("an earlier banner never went away") }
        say(stamped ? "watching from \(clock())" : "watching")
        // SpringBoard's label starts with the app's name in capitals.
        let banner = any(springboard, "identifier == 'NotificationShortLookView' AND label BEGINSWITH[c] %@", icon + ",").firstMatch
        guard banner.waitForExistence(timeout: timeout) else { return XCTFail("no banner") }
        say((stamped ? "banner at \(clock()): " : "banner: ") + banner.label.replacingOccurrences(of: "\n", with: " | "))
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
    // between openings, and a pull past the top of the list folds it into an
    // "N Notifications" pill or opens Spotlight. So the list is dragged back
    // to its top by exactly the distance left (its first cell, an empty one,
    // sits at y 0 there) with slow drags that end held (no coasting), each
    // stacked cell is expanded, and that one screen is read. center reads one
    // screen only (8 groups fit the unfolded inner display in portrait): a
    // stacked cell it cannot expand, or a list that a drag down it (or the
    // fast swipe that opens the pile of shrunk cells a long list ends in)
    // moves, fails the step rather than print a partial count. That swipe
    // at the list's end can close Notification Center, and the read then
    // fails too (the list it snapshots is gone).
    func center(_ icon: String) throws {
        skipIdleWaits()
        let stacked = any(springboard, "identifier == 'NotificationShortLookView' AND label BEGINSWITH[c] %@", icon + ", Grouped,")
        let list = any(springboard, "identifier == 'combined-list-view'").firstMatch
        let screen = displayInUse()
        screen.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.005))
            .press(forDuration: 0.1, thenDragTo: screen.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7)))
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
        var taps = 0
        while let cell = try stacked.allElementsBoundByIndex.first(where: { try reachable($0, in: list.frame) }) {
            taps += 1
            if taps > 30 { return XCTFail("stacked notifications never expanded") }
            tap(cell)
        }
        let tooMany = "Notification Center holds more \(icon) notifications than fit on one screen,"
            + " and center reads one screen only (8 groups fit unfolded in portrait)"
        if stacked.count > 0 { return XCTFail(tooMany + ": a stacked group could not be expanded") }
        let read = try screenGroups(icon)
        // A summary cell stands for notifications that may have no cell of
        // their own, so it is reported, never dropped quietly.
        for summary in read.summaries {
            say("warning: a summary cell (\(summary)) is not counted; notifications it stands for that have no cell of their own are missing from the counts")
        }
        let before = try cellFrames()
        drag(list, by: -step)
        if try cellFrames() != before { return XCTFail(tooMany + ": a drag down the list moved it") }
        list.swipeUp()
        sleep(1)
        // The list always keeps its empty first cell, so no cells (or no list,
        // which makes the snapshot throw) means the swipe closed it.
        let after = list.exists ? ((try? cellFrames()) ?? []) : []
        if after.isEmpty {
            return XCTFail("Notification Center closed on the end-of-list swipe, so center could not confirm the list fits one screen; run it again")
        }
        if after != before { return XCTFail(tooMany + ": a swipe down the list moved it") }
        let doc: [String: Any] = ["groups": read.groups.map { ["text": $0[0], "count": $0.count] }]
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
    // found nothing more to show.
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

    // SpringBoard's own frame is the outer display's even when the inner
    // one is on, and a coordinate off it misses; the largest window is the
    // display in use, so screen coordinates are made relative to it.
    func displayInUse() -> XCUIElement {
        springboard.windows.allElementsBoundByIndex
            .max { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height } ?? springboard
    }

    // Cells near the list's bottom edge are drawn shrunk, and XCUITest calls
    // them not hittable; those are tapped at their centre through the
    // display's coordinates (a coordinate on the cell itself makes XCUITest
    // wait out the "banner" as an interruption). A "note:" line says each
    // time that happened, so a run shows whether the fallback was used.
    func tap(_ cell: XCUIElement) {
        if cell.isHittable {
            cell.tap()
        } else {
            let display = displayInUse()
            let at = cell.frame, screen = display.frame.origin
            say("note: tapping \"\(cell.label.replacingOccurrences(of: "\n", with: " | "))\" at its centre (\(Int(at.midX)), \(Int(at.midY))) through the display's coordinates; XCUITest calls it not hittable")
            display.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: at.midX - screen.x, dy: at.midY - screen.y)).tap()
        }
        sleep(1)
    }

    // With Notification Center open, SpringBoard at times never reports its
    // animations done, and XCUITest then waits 60 s before and after every
    // tap and drag (a run took 376 s, the next never finished). Its private
    // XCUIApplicationProcess asks shouldSkipPre/PostEventQuiescence first;
    // answering yes skips those waits, and center pauses after each action
    // itself. A release without those methods brings the waits back, and
    // this warns that it did.
    func skipIdleWaits() {
        // IDLE_NAMES ("Class,method,method") replaces the names, so a check
        // can make them missing.
        var names = ["XCUIApplicationProcess", "shouldSkipPreEventQuiescence", "shouldSkipPostEventQuiescence"]
        if let o = ProcessInfo.processInfo.environment["IDLE_NAMES"], !o.isEmpty {
            names = o.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
        }
        let yes: @convention(block) (AnyObject) -> Bool = { _ in true }
        // Each method found is patched; a missing class, a missing method or
        // fewer than three names warns.
        var missing = names.count < 3 || NSClassFromString(names[0]) == nil
        if let process = names.first.flatMap({ NSClassFromString($0) }) {
            for name in names.dropFirst() {
                if let method = class_getInstanceMethod(process, NSSelectorFromString(name)) {
                    method_setImplementation(method, imp_implementationWithBlock(yes))
                } else {
                    missing = true
                }
            }
        }
        if missing { say("warning: idle waits cannot be skipped on this Xcode; runs will be slow") }
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

    // The app's groups on screen, top to bottom, each as its members' texts,
    // and the text of each summary cell on screen. An expanded group's cells
    // (and its header) share one parent; a group still stacked is a single
    // "Grouped" cell, its own group.
    func screenGroups(_ icon: String) throws -> (groups: [[String]], summaries: [String]) {
        let root = try springboard.snapshot()
        func find(_ n: XCUIElementSnapshot, _ match: (XCUIElementSnapshot) -> Bool) -> XCUIElementSnapshot? {
            if match(n) { return n }
            for c in n.children { if let hit = find(c, match) { return hit } }
            return nil
        }
        // On the first opening after a delivery the list can keep a summary
        // cell ("+6 from Runner", labelled like the newest notification it
        // sits on) beside the expanded groups; it stands for notifications
        // that, on one screen, were read as their own cells, so it is not a
        // group, but its text is returned for the caller to report.
        func summaryPhrase(_ n: XCUIElementSnapshot) -> XCUIElementSnapshot? {
            find(n) { $0.identifier.contains("phraseThatEnumeratesAllRemainingNotificationsInSection") }
        }
        func isSummary(_ n: XCUIElementSnapshot) -> Bool { summaryPhrase(n) != nil }
        func isStacked(_ n: XCUIElementSnapshot) -> Bool {
            n.label.uppercased().hasPrefix(icon.uppercased() + ", GROUPED,")
        }
        func isCell(_ n: XCUIElementSnapshot) -> Bool {
            n.identifier == "ListCell" && n.label.uppercased().hasPrefix(icon.uppercased() + ",")
                && (isStacked(n) || !isSummary(n))
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
        var summaries: [String] = []
        func walk(_ n: XCUIElementSnapshot) {
            if isCell(n) { out.append((n.frame.minY, [text(n)])); return }
            if n.identifier == "ListCell", n.label.uppercased().hasPrefix(icon.uppercased() + ","),
               let phrase = summaryPhrase(n) {
                summaries.append((phrase.label.isEmpty ? n.label : phrase.label)
                    .replacingOccurrences(of: "\n", with: " | "))
                return
            }
            let cells = n.children.filter { isCell($0) && !isStacked($0) }
            if let top = cells.map(\.frame.minY).min() { out.append((top, cells.map(text))) }
            n.children.filter { !isCell($0) || isStacked($0) }.forEach(walk)
        }
        walk(root)
        return (out.sorted { $0.y < $1.y }.map(\.texts), summaries)
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

    // Which known app is in front: center's target, the shell, the host,
    // Settings or Safari, else none (the Home Screen or an app not listed).
    // A folded Duo reports the front app's orientation, and the folded Home
    // Screen is portrait only, so center brings this app back to restore a
    // folded landscape.
    func front(_ target: String) {
        let known = [target, "dev.sallvain.mylove", host, "com.apple.Preferences", "com.apple.mobilesafari"]
        let hit = known.first { XCUIApplication(bundleIdentifier: $0).state == .runningForeground }
        say("front: " + (hit ?? "none"))
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

    // The Mac's time, which a simulator process reads too: after a clock
    // jump it is the notification scheduler that lags until sim reboot, not
    // this clock. POSIX, so a 12-hour setting cannot rewrite HH.
    func clock() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return f.string(from: Date())
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
