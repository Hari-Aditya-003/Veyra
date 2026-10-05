import SwiftUI

@main
struct SnapHUBApp: App {
    @State private var webModel = WebViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: webModel)
                .tint(SnapTheme.pink)
        }
    }
}
