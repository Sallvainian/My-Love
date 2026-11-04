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
/// target rather than in a package, adds the left-edge back swipe, and
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

    /// The left-edge back swipe. It is the app's own rather than WebKit's
    /// (`allowsBackForwardNavigationGestures`): WebKit slides in a picture it
    /// took of the page when it was left, keeps those pictures in one 50 MB
    /// store on iOS and drops the oldest first (ViewSnapshotStore.cpp,
    /// maximumSnapshotCacheSize and pruneSnapshots). A Duo screen fills that
    /// with two or three pages, so three levels deep Home's picture was gone
    /// and the swipe back to it slid in a blank page.
    private let backPan = UIScreenEdgePanGestureRecognizer()
    /// One picture per back-forward entry, taken as the page is left, for the
    /// page that slides in under the swipe. Entries no longer in the list are
    /// dropped on every page change.
    private var pagePictures: [ObjectIdentifier: UIView] = [:]
    /// The entry on screen and when it arrived. A page left within
    /// `settleTime` of arriving never drew, so its picture is kept rather than
    /// replaced with whatever was mid-change on screen (a dock pick walks back
    /// to Home and pushes the next view straight away).
    private weak var shownEntry: WKBackForwardListItem?
    private var shownSince = Date.distantPast
    private static let settleTime: TimeInterval = 0.3
    /// The views of a swipe in progress, laid over the web view.
    private var swipe: (container: UIView, below: UIView, shade: UIView, above: UIView)?

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

    /// Every Settings page and every view change is a pushState entry
    /// (epic-settings-rework, spike 2), so a swipe from the left edge goes back
    /// exactly one of them.
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
        webView.allowsBackForwardNavigationGestures = false
        backPan.edges = .left
        backPan.addTarget(self, action: #selector(handleBackPan(_:)))
        webView.addGestureRecognizer(backPan)
        webView.scrollView.panGestureRecognizer.require(toFail: backPan)

        documentLoadObserver = NotificationCenter.default.addObserver(
            forName: .capacitorDecidePolicyForNavigationAction, object: nil, queue: .main
        ) { [weak self] notification in
            guard let self, let action = notification.object as? WKNavigationAction else { return }
            self.noteDocumentLoad(action)
        }
        // url changes on pushState and popstate too, before the new page
        // draws, so the page being left is still on screen to be pictured.
        // The picture brings the screen up to date first: the last frame
        // shown can lag the page by a frame or more, and it held the Add a
        // date chooser after the page had already closed it.
        // canGoBack covers the first entry gaining a back item. A new
        // document's url changes when its load starts, before its entry joins
        // the back list, so the swipe stays off while a load runs, and
        // isLoading re-reads the list once it is done: without that the
        // launch page (Home) was never taken as the page on screen, so it had
        // no picture and a swipe back to it slid in a blank page.
        backSwipeObservations = [
            webView.observe(\.url) { [weak self] _, _ in self?.pageChanged() },
            webView.observe(\.canGoBack) { [weak self] _, _ in self?.pageChanged() },
            webView.observe(\.isLoading) { [weak self] _, _ in self?.pageChanged() },
        ]
        pageChanged()
    }

    /// A main-frame load of an app URL that is neither a reload nor a back or
    /// forward step starts a new bundle's document: the launch load, or the
    /// updater's. The policy is asked before the load commits, so the current
    /// entry is still the one the new document's first entry will follow --
    /// unless it shows the very URL being loaded: WebKit then loads the new
    /// document into that same entry, so the entry before it is the boundary.
    /// The updater's swap loads `capacitor://localhost/`, which is Home's URL,
    /// so after a swap from Home the boundary was Home itself and the swipe
    /// stayed off on every page above it.
    private func noteDocumentLoad(_ action: WKNavigationAction) {
        guard action.navigationType == .other,
              action.targetFrame?.isMainFrame ?? true,
              let url = action.request.url?.absoluteString,
              let serverURL = bridge?.config.serverURL.absoluteString,
              url.hasPrefix(serverURL),
              let webView else { return }
        let list = webView.backForwardList
        previousDocumentEntry = list.currentItem?.url == action.request.url
            ? list.backItem : list.currentItem
        updateBackSwipe()
    }

    /// Pictures the page being left, then forgets entries the list dropped.
    private func pageChanged() {
        guard let webView else { return }
        let list = webView.backForwardList
        let current = list.currentItem
        if current !== shownEntry {
            if let left = shownEntry,
               Date().timeIntervalSince(shownSince) >= Self.settleTime,
               let picture = webView.snapshotView(afterScreenUpdates: true) {
                pagePictures[ObjectIdentifier(left)] = picture
            }
            shownEntry = current
            shownSince = Date()
        }
        let kept = Set((list.backList + list.forwardList + [current].compactMap { $0 }).map(ObjectIdentifier.init))
        pagePictures = pagePictures.filter { kept.contains($0.key) }
        updateBackSwipe()
    }

    private func updateBackSwipe() {
        guard let webView, swipe == nil else { return }
        let backItem = webView.backForwardList.backItem
        let allowed = !webView.isLoading && backItem != nil && backItem !== previousDocumentEntry
        if backPan.isEnabled != allowed {
            backPan.isEnabled = allowed
        }
    }

    @objc private func handleBackPan(_ pan: UIScreenEdgePanGestureRecognizer) {
        guard let webView, let host = webView.superview else { return }
        let width = webView.bounds.width
        switch pan.state {
        case .began:
            guard swipe == nil,
                  let back = webView.backForwardList.backItem,
                  let above = webView.snapshotView(afterScreenUpdates: false) else { return }
            let container = UIView(frame: webView.frame)
            container.clipsToBounds = true
            container.backgroundColor = webView.underPageBackgroundColor
            let below = pagePictures[ObjectIdentifier(back)] ?? UIView()
            below.frame = container.bounds
            below.transform = .identity
            let shade = UIView(frame: container.bounds)
            shade.backgroundColor = UIColor.black.withAlphaComponent(0.12)
            above.frame = container.bounds
            above.layer.shadowColor = UIColor.black.cgColor
            above.layer.shadowOpacity = 0.25
            above.layer.shadowRadius = 8
            above.layer.shadowOffset = CGSize(width: -2, height: 0)
            container.addSubview(below)
            container.addSubview(shade)
            container.addSubview(above)
            host.insertSubview(container, aboveSubview: webView)
            swipe = (container, below, shade, above)
            followSwipe(0, width: width)
        case .changed:
            followSwipe(pan.translation(in: host).x, width: width)
        case .ended, .cancelled, .failed:
            guard let swipe else { return }
            let x = pan.translation(in: host).x
            let speed = pan.velocity(in: host).x
            let goesBack = pan.state == .ended && (speed > 300 || (x > width / 2 && speed > -300))
            UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseOut]) {
                self.followSwipe(goesBack ? width : 0, width: width)
            } completion: { _ in
                guard goesBack else {
                    self.endSwipe(swipe)
                    return
                }
                swipe.above.removeFromSuperview()
                swipe.shade.removeFromSuperview()
                webView.goBack()
                // The picture stays over the page until the page has drawn.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    UIView.animate(withDuration: 0.12) {
                        swipe.container.alpha = 0
                    } completion: { _ in
                        self.endSwipe(swipe)
                    }
                }
            }
        default:
            break
        }
    }

    /// The page above follows the finger; the page below drifts in from a
    /// third of the way left under a fading shade, as iOS's own swipe does.
    private func followSwipe(_ translation: CGFloat, width: CGFloat) {
        guard let swipe, width > 0 else { return }
        let x = min(max(translation, 0), width)
        swipe.above.transform = CGAffineTransform(translationX: x, y: 0)
        swipe.below.transform = CGAffineTransform(translationX: (x - width) * 0.3, y: 0)
        swipe.shade.alpha = 1 - x / width
    }

    private func endSwipe(_ ended: (container: UIView, below: UIView, shade: UIView, above: UIView)) {
        ended.below.transform = .identity
        ended.below.removeFromSuperview()
        ended.container.removeFromSuperview()
        swipe = nil
        updateBackSwipe()
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
