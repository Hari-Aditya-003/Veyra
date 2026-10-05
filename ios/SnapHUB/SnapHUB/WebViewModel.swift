import Foundation
import Observation
import UIKit
@preconcurrency import WebKit

@MainActor
@Observable
final class WebViewModel: NSObject {
    let webView: WKWebView
    private(set) var isLoading = false
    private(set) var progress = 0.0
    private(set) var currentURL: URL?
    private(set) var canGoBack = false
    private(set) var connectionMessage: String?
    var selectedSection: HostSection = .home

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = "SnapHUB-iOS/1.0"

        navigate(to: .home)
    }

    func navigate(to section: HostSection) {
        selectedSection = section
        guard let url = URL(string: section.path, relativeTo: AppConfig.siteURL)?.absoluteURL else { return }
        connectionMessage = nil
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
    }

    func reload() {
        connectionMessage = nil
        webView.reload()
    }

    func goBack() {
        if webView.canGoBack { webView.goBack() }
    }

}

extension WebViewModel: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
        isLoading = true
        progress = 0.3
        connectionMessage = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
        isLoading = false
        progress = 1
        currentURL = webView.url
        canGoBack = webView.canGoBack
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation?,
        withError error: Error
    ) {
        isLoading = false
        connectionMessage = "Snap HUB could not connect. Check Wi‑Fi or mobile data, then try again."
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else {
            return .cancel
        }

        if let host = url.host, host != AppConfig.siteURL.host {
            await UIApplication.shared.open(url)
            return .cancel
        }
        return .allow
    }
}
