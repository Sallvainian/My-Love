import SwiftUI

// Host app for the UI-test target. It does nothing: Drive.swift acts on the
// shell (dev.sallvain.mylove), but a UI-test bundle needs a target app.
@main struct RunnerApp: App {
    var body: some Scene { WindowGroup { Text("runner") } }
}
