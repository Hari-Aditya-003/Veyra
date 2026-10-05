import SwiftUI

enum AppConfig {
    static let siteURL = URL(string: "https://snap-hub-events.mr-adityahari.chatgpt.site")!
}

enum SnapTheme {
    static let pink = Color(red: 0.96, green: 0.18, blue: 0.55)
    static let violet = Color(red: 0.48, green: 0.25, blue: 0.88)
    static let ink = Color(red: 0.22, green: 0.08, blue: 0.20)
    static let blush = Color(red: 1.00, green: 0.96, blue: 0.98)
}

enum HostSection: String, CaseIterable, Identifiable {
    case home
    case events
    case uploads
    case live
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .events: "Events"
        case .uploads: "Uploads"
        case .live: "Live"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house.fill"
        case .events: "calendar.badge.clock"
        case .uploads: "photo.badge.plus"
        case .live: "play.rectangle.on.rectangle.fill"
        case .settings: "slider.horizontal.3"
        }
    }

    var path: String {
        switch self {
        case .home: "/admin"
        case .events: "/admin#events"
        case .uploads: "/admin#uploads"
        case .live: "/admin#live-controls"
        case .settings: "/admin#settings"
        }
    }
}
