import AuthenticationServices
import Capacitor
import UIKit

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
/// target rather than in a package, and gives the left pane of two apps side
/// by side a column like the right pane's.
class MainViewController: CAPBridgeViewController {
    /// The iPhone Duo's status column, 84 pt in every pose that has one
    /// (story 7's readings, the shell on the Duo and its simulator alike).
    private static let leftPaneColumnWidth: CGFloat = 84

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(PushEnvironmentPlugin())
        bridge?.registerPluginInstance(AppBadgePlugin())
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
