import AuthenticationServices
import Capacitor
import UIKit
import WebKit

/// Runs an OAuth sign-in in Apple's sign-in sheet and returns the callback URL.
///
/// Google refuses sign-in inside the app's own web view, so the web code
/// (src/api/auth/nativeGoogleSignIn.ts) hands the provider URL here. The sheet
/// shares Safari's cookies, and it catches the redirect to `callbackScheme`
/// itself, so the app registers no URL scheme.
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    // Held until the sheet finishes; a session nothing retains is torn down.
    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString),
              let callbackScheme = call.getString("callbackScheme") else {
            call.reject("start needs a url and a callbackScheme", "FAILED")
            return
        }

        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { [weak self] callbackURL, error in
                self?.session = nil
                if let callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("Sign-in was cancelled", "CANCELLED")
                } else {
                    call.reject(error?.localizedDescription ?? "Sign-in failed", "FAILED", error)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("The sign-in sheet could not open", "FAILED")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

/// The app's bridge view controller: registers the plugins that live in this
/// target rather than in a package, turns on the left-edge back swipe, and
/// gives the left pane of two apps side by side a column like the right pane's.
class MainViewController: CAPBridgeViewController {
    /// The iPhone Duo's status column, 84 pt in every pose that has one
    /// (story 7's readings, the shell on the Duo and its simulator alike).
    private static let leftPaneColumnWidth: CGFloat = 84

    /// The entry that was current when the running bundle's document started
    /// loading: the last entry of the document it replaced, or nil at launch.
    private weak var previousDocumentEntry: WKBackForwardListItem?
    private var backSwipeObservations: [NSKeyValueObservation] = []
    private var documentLoadObserver: NSObjectProtocol?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(PushEnvironmentPlugin())
        bridge?.registerPluginInstance(AppBadgePlugin())
        startBackSwipe()
    }

    deinit {
        if let documentLoadObserver {
            NotificationCenter.default.removeObserver(documentLoadObserver)
        }
    }

    /// WKWebView's own back-forward swipe (epic-settings-rework, spike 2):
    /// every Settings page and every view change is a pushState entry, so a
    /// swipe from the left edge goes back exactly one of them.
    ///
    /// The live updater swaps in a new bundle with webView.load, a new
    /// document whose back list still holds the old bundle's entries, so a
    /// swipe on the new bundle's first page would open the old bundle's last
    /// page (DW-424). The swipe is therefore off whenever the one step back
    /// would leave the running bundle's document. A reload (an error-boundary
    /// reload, or the web process restarting) is not a new bundle, so it
    /// records nothing and back across it keeps working.
    private func startBackSwipe() {
        guard let webView else { return }
        documentLoadObserver = NotificationCenter.default.addObserver(
            forName: .capacitorDecidePolicyForNavigationAction, object: nil, queue: .main
        ) { [weak self] notification in
            guard let self, let action = notification.object as? WKNavigationAction else { return }
            self.noteDocumentLoad(action)
        }
        // url changes on pushState and popstate too, so every page change
        // re-decides; canGoBack covers the first entry gaining a back item. A
        // new document's url changes when its load starts, before its entry
        // joins the back list, so the swipe stays off while a load runs and
        // isLoading re-decides once it is done.
        backSwipeObservations = [
            webView.observe(\.url) { [weak self] _, _ in self?.updateBackSwipe() },
            webView.observe(\.canGoBack) { [weak self] _, _ in self?.updateBackSwipe() },
            webView.observe(\.isLoading) { [weak self] _, _ in self?.updateBackSwipe() },
        ]
        updateBackSwipe()
    }

    /// A main-frame load of an app URL that is neither a reload nor a back or
    /// forward step starts a new bundle's document: the launch load, or the
    /// updater's. The policy is asked before the load commits, so the current
    /// entry is still the one the new document's first entry will follow.
    private func noteDocumentLoad(_ action: WKNavigationAction) {
        guard action.navigationType == .other,
              action.targetFrame?.isMainFrame ?? true,
              let url = action.request.url?.absoluteString,
              let serverURL = bridge?.config.serverURL.absoluteString,
              url.hasPrefix(serverURL),
              let webView else { return }
        previousDocumentEntry = webView.backForwardList.currentItem
        updateBackSwipe()
    }

    private func updateBackSwipe() {
        guard let webView else { return }
        let backItem = webView.backForwardList.backItem
        let allowed = !webView.isLoading && backItem != nil && backItem !== previousDocumentEntry
        if webView.allowsBackForwardNavigationGestures != allowed {
            webView.allowsBackForwardNavigationGestures = allowed
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateLeftPaneColumn()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateLeftPaneColumn()
    }

    /// In the right pane iOS insets the page by its 84 pt status column, and
    /// the web dock (src/hooks/useSideColumn.ts) turns that inset into the
    /// capsule. The left pane gets no column, so the page would keep the
    /// bottom dock while the app beside it shows tabs at the screen's edge.
    /// Adding the same width on the left gives the web code a column there,
    /// and env(safe-area-inset-left) carries it to the capsule and to every
    /// side clearance in src/index.css with no web change.
    ///
    /// Only the left pane has these system insets on an iPhone: no top, left
    /// or right inset and a home-indicator band at the bottom (story 7:
    /// 0/0/34/0). Every other shell pose on the Duo has a top strip or a side
    /// column, other iPhones have a top inset in portrait and either both
    /// sides or no bottom inset in landscape, and an iPad is left alone.
    private func updateLeftPaneColumn() {
        let added = additionalSafeAreaInsets
        let system = view.safeAreaInsets
        let top = system.top - added.top
        let left = system.left - added.left
        let right = system.right - added.right
        let bottom = system.bottom - added.bottom

        let isLeftPane = traitCollection.userInterfaceIdiom == .phone
            && top == 0 && left == 0 && right == 0 && bottom > 0
        let wanted: CGFloat = isLeftPane ? Self.leftPaneColumnWidth : 0
        // Only on a change: assigning re-runs layout, which calls back here.
        if added.left != wanted {
            additionalSafeAreaInsets.left = wanted
        }
    }
}
