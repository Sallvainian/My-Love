import Capacitor
import Foundation

/// Says which APNs environment this build's device token belongs to.
///
/// A token issued to an Xcode development install only works against
/// api.sandbox.push.apple.com, and a TestFlight or App Store one only against
/// api.push.apple.com. The sender (supabase/functions/send-push) picks its host
/// from the environment each registration records, so the web code asks here
/// when it registers (src/services/pushNotifications.ts).
///
/// The build's own `aps-environment` entitlement decides it, read from the
/// provisioning profile embedded in the app:
///   - `development` -> sandbox
///   - `production` -> production
///   - no profile on a device (App Store and TestFlight builds are stripped of
///     it) -> production
///   - no profile on the simulator -> sandbox. The simulator issues no APNs
///     token that Apple would accept in either environment; sandbox is the
///     nearer of the two, and `simctl push` ignores it.
@objc(PushEnvironmentPlugin)
public class PushEnvironmentPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PushEnvironmentPlugin"
    public let jsName = "PushEnvironment"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)
    ]

    @objc func get(_ call: CAPPluginCall) {
        call.resolve(["environment": Self.currentEnvironment()])
    }

    static func currentEnvironment() -> String {
        if let entitlement = embeddedApsEnvironment() {
            return entitlement == "development" ? "sandbox" : "production"
        }
        #if targetEnvironment(simulator)
        return "sandbox"
        #else
        return "production"
        #endif
    }

    /// The `aps-environment` value in the embedded provisioning profile, if any.
    /// The profile is a CMS envelope around an XML plist, so the plist is cut
    /// out of the raw bytes rather than the signature being verified.
    private static func embeddedApsEnvironment() -> String? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex) else {
            return nil
        }
        let plistData = data.subdata(in: start.lowerBound..<end.upperBound)
        guard let plist = try? PropertyListSerialization.propertyList(from: plistData, options: [], format: nil) as? [String: Any],
              let entitlements = plist["Entitlements"] as? [String: Any] else {
            return nil
        }
        return entitlements["aps-environment"] as? String
    }
}
