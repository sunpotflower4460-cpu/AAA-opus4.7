import Capacitor
import Foundation

@objc(ZanshinAppLanguagePlugin)
public class ZanshinAppLanguagePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ZanshinAppLanguagePlugin"
    public let jsName = "ZanshinAppLanguage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPreferredLocalizations", returnType: CAPPluginReturnPromise)
    ]

    @objc func getPreferredLocalizations(_ call: CAPPluginCall) {
        call.resolve(["languages": Bundle.main.preferredLocalizations])
    }
}

class ZanshinViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ZanshinAppLanguagePlugin())
    }
}
