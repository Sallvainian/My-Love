import Capacitor
import UIKit
import UserNotifications

/// The app icon's badge.
///
/// Sign-out clears it (src/services/pushNotifications.ts, stopDevicePushes), so
/// the outgoing account's count does not stay on the icon. Sign-out also
/// empties the app's Notification Center group there, through the
/// local-notifications plugin's removeAllDeliveredNotifications: the push
/// plugin's rejects unless register() ran this launch.
/// Love Notes clears it too when it marks notes read
/// (src/hooks/useLoveNotesReadMarker.ts); the count itself arrives in each
/// push's `aps.badge`.
@objc(AppBadgePlugin)
public class AppBadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppBadgePlugin"
    public let jsName = "AppBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    @objc func clear(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(0) { error in
                    if let error = error {
                        call.reject("Could not clear the badge: \(error.localizedDescription)")
                    } else {
                        call.resolve()
                    }
                }
            } else {
                UIApplication.shared.applicationIconBadgeNumber = 0
                call.resolve()
            }
        }
    }
}
