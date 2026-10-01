import SwiftUI

enum VTheme {
    static let cream = Color(red: 0.973, green: 0.965, blue: 0.941)
    static let ink = Color(red: 0.13, green: 0.18, blue: 0.16)
    static let forest = Color(red: 0.094, green: 0.247, blue: 0.208)
    static let gold = Color(red: 0.59, green: 0.46, blue: 0.26)
    static let muted = Color(red: 0.40, green: 0.44, blue: 0.41)
    static let line = Color(red: 0.87, green: 0.88, blue: 0.84)
    static func serif(_ size: CGFloat) -> Font { .system(size: size, weight: .regular, design: .serif) }
}

struct VeyraMark: View {
    var size: CGFloat = 40
    var light = false
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28).fill(light ? .white.opacity(0.12) : VTheme.forest)
            Path { p in
                p.move(to: CGPoint(x: size * 0.23, y: size * 0.28))
                p.addQuadCurve(to: CGPoint(x: size * 0.5, y: size * 0.76), control: CGPoint(x: size * 0.33, y: size * 0.60))
                p.addQuadCurve(to: CGPoint(x: size * 0.77, y: size * 0.28), control: CGPoint(x: size * 0.65, y: size * 0.61))
                p.move(to: CGPoint(x: size * 0.36, y: size * 0.25))
                p.addQuadCurve(to: CGPoint(x: size * 0.64, y: size * 0.25), control: CGPoint(x: size * 0.50, y: size * 0.55))
            }.stroke(Color(red: 0.89, green: 0.79, blue: 0.59), style: StrokeStyle(lineWidth: size * 0.045, lineCap: .round))
        }.frame(width: size, height: size).accessibilityHidden(true)
    }
}

struct PrimaryButton: View {
    let title: String
    var icon: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(title)
                if let icon { Image(systemName: icon) }
            }.font(.system(size: 14, weight: .semibold))
                .frame(maxWidth: .infinity).padding(.vertical, 17)
                .foregroundStyle(.white).background(VTheme.forest, in: RoundedRectangle(cornerRadius: 16))
        }.buttonStyle(SoftPressStyle())
    }
}

struct SoftPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.82 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.975 : 1)
            .animation(reduceMotion ? nil : .spring(response: 0.28, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

struct StatusPill: View {
    let text: String
    var color: Color = VTheme.forest
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 5, height: 5)
            Text(text).font(.system(size: 9, weight: .semibold)).tracking(0.6)
        }.foregroundStyle(color).padding(.horizontal, 10).padding(.vertical, 7)
            .background(color.opacity(0.09), in: Capsule())
    }
}

struct SectionLabel: View {
    let title: String
    var body: some View { Text(title.uppercased()).font(.system(size: 10, weight: .semibold)).tracking(2).foregroundStyle(VTheme.muted) }
}
