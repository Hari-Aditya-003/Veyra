import SwiftUI

struct ContentView: View {
    @Bindable var model: WebViewModel

    var body: some View {
        ZStack {
            SnapTheme.blush.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                webContent
                navigationBar
            }
        }
        .preferredColorScheme(.light)
    }

    private var header: some View {
        HStack(spacing: 12) {
            if model.canGoBack {
                Button(action: model.goBack) {
                    Image(systemName: "chevron.left")
                        .font(.headline)
                        .frame(width: 38, height: 38)
                        .background(.white.opacity(0.8), in: Circle())
                }
                .accessibilityLabel("Go back")
            }

            Image("SnapHubLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 54, height: 54)
                .accessibilityLabel("Snap HUB")

            VStack(alignment: .leading, spacing: 2) {
                Text("HOST CONTROL")
                    .font(.caption2.weight(.black))
                    .tracking(1.4)
                    .foregroundStyle(SnapTheme.pink)
                Text(model.selectedSection == .live ? "Live event control" : "Every event, one easy share")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(SnapTheme.ink)
                    .lineLimit(1)
            }

            Spacer()

            ShareLink(item: model.currentURL ?? AppConfig.siteURL) {
                Image(systemName: "square.and.arrow.up")
                    .font(.headline)
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.8), in: Circle())
            }
            .accessibilityLabel("Share current Snap HUB page")

            Button(action: model.reload) {
                Image(systemName: "arrow.clockwise")
                    .font(.headline)
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.8), in: Circle())
            }
            .accessibilityLabel("Reload")
        }
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background(
            LinearGradient(
                colors: [Color(red: 1, green: 0.88, blue: 0.95), Color(red: 0.91, green: 0.91, blue: 1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private var webContent: some View {
        ZStack(alignment: .top) {
            SnapWebView(webView: model.webView)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .padding(.horizontal, 8)
                .background(SnapTheme.blush)

            if model.isLoading {
                ProgressView(value: model.progress)
                    .tint(SnapTheme.pink)
                    .padding(.horizontal, 18)
            }

            if let message = model.connectionMessage {
                ContentUnavailableView {
                    Label("Connection paused", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(message)
                } actions: {
                    Button("Resume connection", action: model.reload)
                        .buttonStyle(.borderedProminent)
                }
                .padding()
                .background(.ultraThinMaterial)
            }
        }
    }

    private var navigationBar: some View {
        HStack(spacing: 2) {
            ForEach(HostSection.allCases) { section in
                Button {
                    withAnimation(.snappy(duration: 0.22)) {
                        model.navigate(to: section)
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: section.systemImage)
                            .font(.system(size: 17, weight: .semibold))
                        Text(section.title)
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(model.selectedSection == section ? .white : SnapTheme.ink.opacity(0.66))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background {
                        if model.selectedSection == section {
                            LinearGradient(colors: [SnapTheme.pink, SnapTheme.violet], startPoint: .topLeading, endPoint: .bottomTrailing)
                                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(section.title)
            }
        }
        .padding(6)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Divider().opacity(0.3) }
    }
}

#Preview {
    ContentView(model: WebViewModel())
}
