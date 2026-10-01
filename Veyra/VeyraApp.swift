import SwiftUI

@main
struct VeyraApp: App {
    @State private var store: AppStore
    init() {
        if ProcessInfo.processInfo.arguments.contains("--uitesting") {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("VeyraUITest-" + UUID().uuidString)
            _store = State(initialValue: AppStore(directory: directory))
        } else { _store = State(initialValue: AppStore()) }
    }
    var body: some Scene {
        WindowGroup { RootView().environment(store).tint(VTheme.forest).preferredColorScheme(.light) }
    }
}

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tab = 0
    @State private var linkedEvent: EventRecord?
    @State private var invalidLink = false
    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { HomeView() }.tabItem { Label("Discover", systemImage: "square.grid.2x2") }.tag(0)
            NavigationStack { GalleryView() }.tabItem { Label("Gallery", systemImage: "photo.stack") }.tag(1)
            NavigationStack { PlansView() }.tabItem { Label("Studio", systemImage: "sparkles") }.tag(2)
            NavigationStack { ProfileView() }.tabItem { Label("You", systemImage: "person.crop.circle") }.tag(3)
        }
        .sensoryFeedback(.selection, trigger: tab)
        .sheet(item: $linkedEvent) { event in
            NavigationStack {
                EventDetailView(eventID: event.id, guestMode: true)
                    .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { linkedEvent = nil } } }
            }
        }
        .onOpenURL { url in
            let parts = url.pathComponents.filter { $0 != "/" }
            guard url.scheme == "veyra", url.host == "event", parts.count == 1,
                  let id = UUID(uuidString: parts[0]), let event = store.event(id) else { invalidLink = true; return }
            linkedEvent = event
        }
        .alert("Invitation unavailable", isPresented: $invalidLink) {
            Button("OK", role: .cancel) { }
        } message: { Text("This local preview opens events saved on this device. Cross-device invitations will be available with cloud launch.") }
        .overlay(alignment: .top) {
            if let error = store.persistenceError {
                HStack(alignment: .top) {
                    Image(systemName: "exclamationmark.triangle")
                    Text(error).font(.caption)
                    Button { store.persistenceError = nil } label: { Image(systemName: "xmark") }.accessibilityLabel("Dismiss storage error")
                }.padding().foregroundStyle(.white).background(Color(red: 0.55, green: 0.18, blue: 0.14), in: RoundedRectangle(cornerRadius: 16)).padding()
            }
        }
    }
}

struct HomeView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var newEvent = false
    @State private var search = ""
    @State private var appeared = false
    @State private var filter = "All events"
    private var filtered: [EventRecord] {
        store.events.filter { event in
            (search.isEmpty || event.title.localizedCaseInsensitiveContains(search) || event.venue.localizedCaseInsensitiveContains(search)) && (filter == "All events" || event.category == filter)
        }
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                masthead
                VStack(alignment: .leading, spacing: 7) {
                    SectionLabel(title: "Your moments, beautifully together")
                    Text("Some days deserve\nto last forever.").font(VTheme.serif(36)).tracking(-1.3).foregroundStyle(VTheme.ink)
                }
                if let event = store.events.first {
                    NavigationLink { EventDetailView(eventID: event.id) } label: { FeaturedEventCard(event: event) }
                        .buttonStyle(SoftPressStyle()).accessibilityIdentifier("featuredEvent")
                }
                HStack(spacing: 12) {
                    quickAction(icon: "plus", title: "Create an event", subtitle: "Start a new story") { newEvent = true }
                    NavigationLink { GuestJoinView() } label: { quickLabel(icon: "qrcode.viewfinder", title: "Join an event", subtitle: "Open your invitation") }
                        .buttonStyle(SoftPressStyle())
                }
                HStack {
                    Text("Your collections").font(VTheme.serif(27)).foregroundStyle(VTheme.ink)
                    Spacer()
                    Text(String(store.events.count)).font(.system(size: 12, weight: .medium, design: .monospaced)).foregroundStyle(VTheme.muted)
                }
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundStyle(VTheme.muted)
                    TextField("Search celebrations or venues", text: $search).font(.system(size: 13)).accessibilityIdentifier("eventSearch")
                    if !search.isEmpty { Button { search = "" } label: { Image(systemName: "xmark.circle.fill") }.accessibilityLabel("Clear search") }
                }.padding(15).background(.white.opacity(0.85), in: RoundedRectangle(cornerRadius: 14))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(["All events", "Wedding", "Engagement", "Brand launch"], id: \.self) { item in
                            Button {
                                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { filter = item }
                            } label: {
                                Text(item).font(.system(size: 11, weight: .medium)).padding(.horizontal, 15).padding(.vertical, 10)
                                    .foregroundStyle(filter == item ? .white : VTheme.muted)
                                    .background(filter == item ? VTheme.forest : .white.opacity(0.6), in: Capsule())
                            }.buttonStyle(.plain).accessibilityAddTraits(filter == item ? .isSelected : [])
                        }
                    }
                }.padding(.top, -12)
                if filtered.isEmpty {
                    ContentUnavailableView(search.isEmpty ? "Your next story awaits" : "No collections found", systemImage: "photo.on.rectangle.angled", description: Text(search.isEmpty ? "Create your first event to begin." : "Try a different name or venue."))
                } else {
                    LazyVStack(spacing: 16) {
                        ForEach(filtered) { event in
                            NavigationLink { EventDetailView(eventID: event.id) } label: { CollectionRow(event: event) }.buttonStyle(SoftPressStyle())
                        }
                    }
                }
                HStack(alignment: .top, spacing: 13) {
                    Image(systemName: "lock.shield").font(.system(size: 23, weight: .light)).foregroundStyle(VTheme.gold)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("A little more personal.").font(VTheme.serif(20)).foregroundStyle(VTheme.ink)
                        Text("Your imported photos stay on this device. Cloud sharing and AI search are planned for launch.").font(.system(size: 12)).foregroundStyle(VTheme.muted).lineSpacing(3)
                    }
                }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(VTheme.line.opacity(0.35), in: RoundedRectangle(cornerRadius: 18))
                Text("VEYRA  /  EVERY MOMENT, TOGETHER").font(.system(size: 9, weight: .medium)).tracking(2.2).foregroundStyle(VTheme.muted).frame(maxWidth: .infinity).padding(.vertical, 12)
            }.padding(.horizontal, 24).padding(.top, 10).padding(.bottom, 22)
                .opacity(appeared ? 1 : 0).offset(y: appeared || reduceMotion ? 0 : 12)
        }
        .background(VTheme.cream).toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $newEvent) { NewEventSheet() }
        .onAppear { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.5)) { appeared = true } }
    }
    private var masthead: some View {
        HStack(spacing: 10) {
            VeyraMark(size: 37)
            Text("veyra").font(VTheme.serif(30)).tracking(-1).foregroundStyle(VTheme.ink)
            Spacer()
            StatusPill(text: "LOCAL PREVIEW", color: VTheme.gold)
            NavigationLink { ProfileView() } label: {
                Image(systemName: "person.crop.circle").font(.system(size: 26, weight: .ultraLight)).foregroundStyle(VTheme.forest).frame(width: 44, height: 44)
            }.accessibilityLabel("Your profile")
        }
    }
    private func quickAction(icon: String, title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { quickLabel(icon: icon, title: title, subtitle: subtitle) }.buttonStyle(SoftPressStyle()).accessibilityIdentifier("createEvent")
    }
    private func quickLabel(icon: String, title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Image(systemName: icon).font(.system(size: 20, weight: .light)).foregroundStyle(VTheme.gold)
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(VTheme.ink)
                Text(subtitle).font(.system(size: 10)).foregroundStyle(VTheme.muted)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(VTheme.line.opacity(0.65), lineWidth: 1))
    }
}

struct FeaturedEventCard: View {
    let event: EventRecord
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            GeometryReader { geo in
                Image(event.coverName).resizable().scaledToFill().frame(width: geo.size.width, height: geo.size.height).clipped()
            }
            LinearGradient(colors: [.clear, .black.opacity(0.15), VTheme.forest.opacity(0.95)], startPoint: .top, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 8) {
                Spacer()
                HStack(spacing: 6) {
                    Circle().fill(Color(red: 0.90, green: 0.80, blue: 0.59)).frame(width: 5, height: 5)
                    Text("THE FEATURED COLLECTION").font(.system(size: 9, weight: .medium)).tracking(1.7)
                }.foregroundStyle(.white.opacity(0.85))
                Text(event.title).font(VTheme.serif(33)).tracking(-0.6).foregroundStyle(.white)
                HStack {
                    Text(event.venue.components(separatedBy: ",").last?.trimmingCharacters(in: .whitespaces) ?? event.venue)
                    Text("·")
                    Text(event.date.formatted(.dateTime.day().month(.abbreviated)))
                    Spacer()
                    Image(systemName: "arrow.up.right").font(.system(size: 13)).frame(width: 35, height: 35).background(.white.opacity(0.15), in: Circle())
                }.font(.system(size: 11)).foregroundStyle(.white.opacity(0.85))
            }.padding(24)
            Text("ON THIS DEVICE").font(.system(size: 8, weight: .semibold)).tracking(1.3).padding(.horizontal, 11).padding(.vertical, 8).foregroundStyle(.white).background(.black.opacity(0.2), in: Capsule()).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(18)
        }.frame(height: 325).clipShape(RoundedRectangle(cornerRadius: 24))
    }
}

struct CollectionRow: View {
    let event: EventRecord
    var body: some View {
        HStack(spacing: 15) {
            Image(event.coverName).resizable().scaledToFill().frame(width: 80, height: 92).clipped().clipShape(RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 7) {
                Text(event.category.uppercased()).font(.system(size: 8, weight: .semibold)).tracking(1.5).foregroundStyle(VTheme.gold)
                Text(event.title).font(VTheme.serif(21)).foregroundStyle(VTheme.ink)
                Text("\(event.photos.count) photos  ·  \(event.date.formatted(.dateTime.day().month(.abbreviated)))").font(.system(size: 11)).foregroundStyle(VTheme.muted)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 11)).foregroundStyle(VTheme.muted)
        }.padding(12).background(.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 18))
    }
}
