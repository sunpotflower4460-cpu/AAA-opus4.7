import Capacitor
import UIKit
import StoreKit

@objc(ZanshinTsuzuriPlugin)
public final class ZanshinTsuzuriPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ZanshinTsuzuriPlugin"
    public let jsName = "ZanshinTsuzuri"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    private static let productID = "zanshin.tsuzuri"
    private var updates: Task<Void, Never>?
    @MainActor private var busy = false
    @MainActor private var awaitingApproval = false
    private var configured: Bool {
        Bundle.main.object(forInfoDictionaryKey: "ZanshinTsuzuriSalesEnabled") as? Bool == true
    }

    public override func load() {
        guard configured, #available(iOS 15.0, *) else { return }
        updates = Task { @MainActor [weak self] in
            for await update in StoreKit.Transaction.updates {
                guard let self = self else { return }
                guard case .verified(let transaction) = update, Self.matches(transaction) else { continue }
                self.awaitingApproval = false
                self.notifyListeners("entitlementChanged", data: [
                    "state": transaction.revocationDate == nil ? "verified" : "revoked"
                ])
                await transaction.finish()
            }
        }
    }

    deinit { updates?.cancel() }

    @available(iOS 15.0, *)
    private static func matches(_ transaction: StoreKit.Transaction) -> Bool {
        transaction.productID == productID && transaction.productType == .nonConsumable
    }

    @available(iOS 15.0, *)
    private func verifiedState() async -> String {
        for await value in StoreKit.Transaction.currentEntitlements {
            switch value {
            case .verified(let transaction) where Self.matches(transaction):
                return transaction.revocationDate == nil ? "verified" : "revoked"
            case .unverified(let transaction, _) where Self.matches(transaction):
                return "unknown"
            default:
                continue
            }
        }
        if let value = await StoreKit.Transaction.latest(for: Self.productID) {
            switch value {
            case .verified(let transaction) where Self.matches(transaction):
                return transaction.revocationDate == nil ? "verified" : "revoked"
            default:
                return "unknown"
            }
        }
        return "unowned"
    }

    @available(iOS 15.0, *)
    private func listedProduct() async throws -> Product? {
        let list = try await Product.products(for: [Self.productID])
        return list.first { $0.id == Self.productID && $0.type == .nonConsumable }
    }

    @objc func entitlement(_ call: CAPPluginCall) {
        guard configured, #available(iOS 15.0, *) else {
            call.resolve(["state": "unavailable"])
            return
        }
        Task { call.resolve(["state": await verifiedState()]) }
    }

    @objc func product(_ call: CAPPluginCall) {
        guard configured, #available(iOS 15.0, *) else {
            call.resolve(["state": "unavailable"])
            return
        }
        Task {
            do {
                guard let product = try await listedProduct() else {
                    call.resolve(["state": "failed"])
                    return
                }
                call.resolve(["state": "ready", "price": product.displayPrice])
            } catch {
                call.resolve(["state": "failed"])
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard configured, #available(iOS 15.0, *), SKPaymentQueue.canMakePayments() else {
            call.resolve(["state": "unavailable"])
            return
        }
        Task { @MainActor in
            guard !busy, !awaitingApproval else {
                call.resolve(["state": awaitingApproval ? "pending" : "failed"])
                return
            }
            busy = true
            defer { busy = false }
            do {
                if await verifiedState() == "verified" {
                    call.resolve(["state": "verified"])
                    return
                }
                guard let product = try await listedProduct() else {
                    call.resolve(["state": "failed"])
                    return
                }
                switch try await product.purchase() {
                case .success(.verified(let transaction)) where Self.matches(transaction):
                    let result = transaction.revocationDate == nil ? "verified" : "revoked"
                    await transaction.finish()
                    call.resolve(["state": result])
                case .success:
                    call.resolve(["state": "unknown"])
                case .pending:
                    awaitingApproval = true
                    call.resolve(["state": "pending"])
                case .userCancelled:
                    call.resolve(["state": "cancelled"])
                @unknown default:
                    call.resolve(["state": "failed"])
                }
            } catch {
                call.resolve(["state": "failed"])
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        guard configured, #available(iOS 15.0, *) else {
            call.resolve(["state": "unavailable"])
            return
        }
        Task { @MainActor in
            guard !busy, !awaitingApproval else {
                call.resolve(["state": awaitingApproval ? "pending" : "failed"])
                return
            }
            busy = true
            defer { busy = false }
            do {
                try await AppStore.sync()
                call.resolve(["state": await verifiedState()])
            } catch {
                call.resolve(["state": "failed"])
            }
        }
    }

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let path = call.getString("path"),
              path.range(of: #"^zanshin-exports/[a-f0-9]{32}/[a-zA-Z0-9_-]+\.(pdf|png|txt|json|zip)$"#,
                         options: .regularExpression) != nil,
              let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            call.reject("Invalid file", "exportFailed")
            return
        }
        let file = cache.appendingPathComponent(path, isDirectory: false)
        DispatchQueue.main.async { [weak self] in
            guard FileManager.default.fileExists(atPath: file.path),
                  let host = self?.bridge?.viewController,
                  host.presentedViewController == nil else {
                call.reject("Cannot share the file", "exportFailed")
                return
            }
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = host.view
            sheet.popoverPresentationController?.sourceRect = CGRect(
                x: host.view.bounds.midX, y: host.view.bounds.midY, width: 1, height: 1
            )
            sheet.completionWithItemsHandler = { _, completed, _, error in
                if error != nil {
                    call.reject("Sharing failed", "exportFailed")
                } else {
                    call.resolve(["completed": completed])
                }
            }
            host.present(sheet, animated: true)
        }
    }
}
