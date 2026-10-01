import SwiftUI

struct PlansView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selected = "Signature"
    @State private var showPreview = false
    @State private var eventCount = 20.0
    private let plans = ["Starter", "Signature", "Studio"]
    private var price: String { selected == "Starter" ? "Free" : selected == "Signature" ? "₹1,499" : "₹4,999" }
    private var interval: String { selected == "Starter" ? "local preview" : selected == "Signature" ? "per event" : "per month" }
    private var benefits: [(String, String)] {
        switch selected {
        case "Signature": return [("photo.stack", "Up to 5,000 photos per event"), ("person.crop.rectangle", "AI guest photo discovery"), ("qrcode", "Private QR galleries"), ("person.2", "2 team members"), ("calendar", "30-day cloud gallery")]
        case "Studio": return [("square.stack.3d.up", "5 active events"), ("photo.stack", "25,000 new photos per month"), ("person.3", "5 team members"), ("paintpalette", "Your studio branding"), ("calendar", "90-day cloud galleries")]
        default: return [("iphone", "On-device collections"), ("photo.badge.plus", "Import your photographs"), ("heart", "Favorites and photo sharing"), ("qrcode", "Local QR invitation preview")]
        }
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 25) {
                HStack { SectionLabel(title: "Veyra for professionals"); Spacer(); Image(systemName: "sparkles").foregroundStyle(VTheme.gold) }
                Text("Beautiful delivery.\nBetter business.").font(VTheme.serif(37)).tracking(-1).foregroundStyle(VTheme.ink)
                Text("Keep the guest experience free. Give your studio room to grow.").font(.system(size: 14)).foregroundStyle(VTheme.muted).lineSpacing(5)
                HStack(spacing: 4) {
                    ForEach(plans, id: \.self) { plan in
                        Button { withAnimation(reduceMotion ? nil : .spring(response: 0.35)) { selected = plan } } label: {
                            Text(plan).font(.system(size: 12, weight: .semibold)).frame(maxWidth: .infinity).padding(.vertical, 12).foregroundStyle(selected == plan ? VTheme.forest : VTheme.muted).background(selected == plan ? Color.white : .clear, in: Capsule())
                        }.buttonStyle(.plain).accessibilityAddTraits(selected == plan ? .isSelected : [])
                    }
                }.padding(5).background(VTheme.line.opacity(0.6), in: Capsule())
                VStack(alignment: .leading, spacing: 23) {
                    HStack {
                        Text(selected.uppercased()).font(.system(size: 10, weight: .semibold)).tracking(2)
                        Spacer()
                        Text(selected == "Signature" ? "FOR YOUR NEXT EVENT" : "MADE FOR YOUR STUDIO").font(.system(size: 7, weight: .medium)).tracking(1.1)
                    }.foregroundStyle(Color(red: 0.86, green: 0.76, blue: 0.56))
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(price).font(VTheme.serif(46)).tracking(-2)
                        Text(interval).font(.system(size: 12)).foregroundStyle(.white.opacity(0.65))
                    }.foregroundStyle(.white)
                    Rectangle().fill(.white.opacity(0.15)).frame(height: 1)
                    ForEach(benefits, id: \.0) { benefit in
                        HStack(spacing: 12) { Image(systemName: benefit.0).frame(width: 20).foregroundStyle(Color(red: 0.86, green: 0.76, blue: 0.56)); Text(benefit.1).font(.system(size: 13)).foregroundStyle(.white.opacity(0.9)) }
                    }
                    Button {
                        store.selectedPlan = selected
                        store.save()
                        showPreview = true
                    } label: {
                        HStack { Text("Preview \(selected)"); Spacer(); Image(systemName: "arrow.right") }
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(VTheme.forest).padding(17).background(VTheme.cream, in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(SoftPressStyle()).accessibilityIdentifier("previewPlan")
                    Text("PROPOSED PLAN · NO PURCHASE OR CHARGE").font(.system(size: 8, weight: .medium)).tracking(0.7).foregroundStyle(.white.opacity(0.65)).frame(maxWidth: .infinity)
                }.padding(25).background(VTheme.forest, in: RoundedRectangle(cornerRadius: 25))
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "info.circle").foregroundStyle(VTheme.gold)
                    Text("Cloud storage, AI discovery, teams and branded delivery are planned services. Previewing a plan saves your choice only; it does not unlock a subscription.").font(.system(size: 12)).foregroundStyle(VTheme.muted).lineSpacing(4)
                }
                VStack(alignment: .leading, spacing: 16) {
                    SectionLabel(title: "Revenue explorer")
                    Text("What could you earn?").font(VTheme.serif(27)).foregroundStyle(VTheme.ink)
                    HStack { Text("Signature events / month"); Spacer(); Text("\(Int(eventCount))").fontWeight(.semibold) }.font(.system(size: 12)).foregroundStyle(VTheme.muted)
                    Slider(value: $eventCount, in: 1...100, step: 1).tint(VTheme.forest).accessibilityLabel("Signature events per month")
                    HStack(alignment: .firstTextBaseline) {
                        Text((Int(eventCount) * 1499).formatted(.currency(code: "INR").precision(.fractionLength(0)))).font(VTheme.serif(34)).foregroundStyle(VTheme.forest)
                        Spacer()
                        Text("gross / month").font(.system(size: 11)).foregroundStyle(VTheme.muted)
                    }
                    Text("Illustration: events × ₹1,499. This is revenue, not profit. Subtract cloud, AI, delivery, support, platform fees and applicable taxes. Pricing needs customer validation.").font(.system(size: 11)).foregroundStyle(VTheme.muted).lineSpacing(4)
                }.padding(22).background(.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 20))
            }.padding(24)
        }.background(VTheme.cream).navigationTitle("The studio").navigationBarTitleDisplayMode(.inline)
            .alert("\(selected) preview selected", isPresented: $showPreview) { Button("Continue", role: .cancel) { } } message: { Text("Your preference has been saved locally. No payment was taken. Production billing will use StoreKit where required.") }
    }
}

struct ProfileView: View {
    @Environment(AppStore.self) private var store
    @State private var confirmDelete = false
    var body: some View {
        @Bindable var store = store
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack(spacing: 17) {
                    VeyraMark(size: 66)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Your creative space").font(VTheme.serif(27)).foregroundStyle(VTheme.ink)
                        Text("Local workspace · \(store.selectedPlan) preview").font(.system(size: 12)).foregroundStyle(VTheme.muted)
                    }
                }.padding(.vertical, 12)
                HStack {
                    metric(String(store.events.count), "COLLECTIONS")
                    Spacer()
                    metric(String(store.events.flatMap(\.photos).count), "PHOTOS")
                    Spacer()
                    metric(String(store.favorites.count), "FAVORITES")
                }.padding(22).background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 20))
                SectionLabel(title: "Privacy is personal")
                VStack(alignment: .leading, spacing: 20) {
                    Toggle(isOn: $store.faceConsent) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Face search preference").font(.system(size: 14, weight: .medium))
                            Text("Saved locally. No face is captured or processed in this preview.").font(.system(size: 11)).foregroundStyle(VTheme.muted)
                        }
                    }.onChange(of: store.faceConsent) { _, _ in store.save() }
                    Divider()
                    Toggle(isOn: $store.notificationsEnabled) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Delivery preference").font(.system(size: 14, weight: .medium))
                            Text("For future photo alerts. No notifications are sent in this build.").font(.system(size: 11)).foregroundStyle(VTheme.muted)
                        }
                    }.onChange(of: store.notificationsEnabled) { _, _ in store.save() }
                }.padding(22).background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 20)).foregroundStyle(VTheme.ink)
                VStack(alignment: .leading, spacing: 13) {
                    Text("Built around your trust.").font(VTheme.serif(25)).foregroundStyle(VTheme.ink)
                    Text("Photos you import are stored inside this app on your device. There is no account, cloud upload, face recognition or analytics connection. The demo contains fictional event records and AI-generated sample photography.").font(.system(size: 13)).foregroundStyle(VTheme.muted).lineSpacing(5)
                    Text("Invitations only open events available on this device. The guest preview is not an authenticated or secure multi-user system.").font(.system(size: 12)).foregroundStyle(VTheme.muted).lineSpacing(4)
                }
                NavigationLink { PlansView() } label: {
                    HStack { Label("Explore studio plans", systemImage: "sparkles"); Spacer(); Image(systemName: "arrow.right") }.font(.system(size: 14, weight: .medium)).foregroundStyle(VTheme.forest).padding(20).background(VTheme.line.opacity(0.4), in: RoundedRectangle(cornerRadius: 17))
                }
                Button(role: .destructive) { confirmDelete = true } label: {
                    Label("Delete all local data", systemImage: "trash").font(.system(size: 13)).frame(maxWidth: .infinity).padding(16)
                }.background(.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 15))
                Text("VEYRA 1.0  ·  PRODUCT PREVIEW").font(.system(size: 9, weight: .medium)).tracking(1.7).foregroundStyle(VTheme.muted).frame(maxWidth: .infinity)
            }.padding(24)
        }.background(VTheme.cream).navigationTitle("Your space").navigationBarTitleDisplayMode(.inline)
            .confirmationDialog("Delete everything stored by Veyra?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete local events and photos", role: .destructive) { store.deleteLocalData() }
                Button("Keep my data", role: .cancel) { }
            } message: { Text("This removes events, imported photos, favorites and preferences from this app. Photos in your device’s library are not changed. This action cannot be undone.") }
    }
    private func metric(_ number: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 6) { Text(number).font(VTheme.serif(28)).foregroundStyle(VTheme.forest); Text(label).font(.system(size: 8, weight: .semibold)).tracking(1).foregroundStyle(VTheme.muted) }
    }
}
