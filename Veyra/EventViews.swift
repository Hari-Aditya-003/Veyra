import SwiftUI
import PhotosUI
import CoreImage.CIFilterBuiltins
import UIKit

// MARK: - Event collection

struct EventDetailView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let eventID: UUID
    var guestMode = false
    @State private var selectedFunction = "All"
    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var selectedPhoto: PhotoRecord?
    @State private var showingInvite = false
    @State private var importing = false
    @State private var importedCount = 0
    @State private var importTotal = 0
    @State private var importError: String?
    @State private var importFunction = ""

    private var event: EventRecord? { store.event(eventID) }
    private var photos: [PhotoRecord] {
        guard let event else { return [] }
        return event.photos.filter { selectedFunction == "All" || $0.function == selectedFunction }
    }

    var body: some View {
        Group {
            if let event {
                ScrollView {
                    VStack(alignment: .leading, spacing: 26) {
                        eventHero(event)
                        eventSummary(event)
                        if guestMode { guestNotice }
                        collectionHeader(event)
                        if photos.isEmpty {
                            EmptyCollectionView(
                                symbol: "photo.on.rectangle.angled",
                                title: "The story starts here",
                                message: guestMode ? "Photos will appear when the host adds them to this local gallery." : "Add your first photographs to bring this celebration to life."
                            )
                        } else {
                            photoGrid
                        }
                        if !guestMode { importPanel(event) }
                        Text("PRIVATE BY DESIGN  ·  SAVED ON THIS DEVICE")
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .tracking(1.3)
                            .foregroundStyle(VTheme.muted)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 4)
                    }
                    .padding(.horizontal, 22)
                    .padding(.bottom, 36)
                }
                .background(VTheme.cream)
                .navigationTitle(guestMode ? "Your invitation" : "Event collection")
                .navigationBarTitleDisplayMode(.inline)
                .navigationBarBackButtonHidden(!guestMode)
                .toolbar {
                    if !guestMode {
                        ToolbarItem(placement: .topBarLeading) {
                            Button { dismiss() } label: {
                                Label("Back", systemImage: "chevron.left")
                            }
                            .accessibilityIdentifier("eventBackButton")
                        }
                    }
                    if !guestMode {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button { showingInvite = true } label: {
                                Image(systemName: "qrcode")
                                    .foregroundStyle(VTheme.forest)
                            }
                            .accessibilityLabel("Show event invitation")
                        }
                    }
                }
            } else {
                ContentUnavailableView("Event unavailable", systemImage: "calendar.badge.exclamationmark", description: Text("This event is no longer saved on this device."))
            }
        }
        .sheet(isPresented: $showingInvite) { InviteView(eventID: eventID) }
        .fullScreenCover(item: $selectedPhoto) { photo in
            PhotoViewer(photos: photos, initialID: photo.id)
        }
        .onChange(of: selectedItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await importPhotos(items) }
        }
        .alert("Photo import", isPresented: Binding(get: { importError != nil }, set: { if !$0 { importError = nil } })) {
            Button("OK") { importError = nil }
        } message: { Text(importError ?? "") }
    }

    private func eventHero(_ event: EventRecord) -> some View {
        ZStack(alignment: .bottomLeading) {
            Image(event.coverName)
                .resizable()
                .scaledToFill()
                .frame(height: 278)
                .clipped()
            LinearGradient(colors: [.clear, .black.opacity(0.72)], startPoint: .center, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 12) {
                Text(event.category.uppercased())
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .tracking(2.2)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 7)
                    .background(.white.opacity(0.16), in: Capsule())
                Text(event.title)
                    .font(VTheme.serif(34))
                    .lineLimit(3)
                Label(event.venue, systemImage: "mappin.and.ellipse")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.85))
            }
            .foregroundStyle(.white)
            .padding(24)
        }
        .frame(height: 278)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .padding(.top, 12)
    }

    private func eventSummary(_ event: EventRecord) -> some View {
        HStack(spacing: 0) {
            summaryItem(value: event.date.formatted(.dateTime.day().month(.abbreviated)), label: "THE DATE")
            Rectangle().fill(VTheme.line).frame(width: 1, height: 32)
            summaryItem(value: "\(event.photos.count)", label: "PHOTOGRAPHS")
            Rectangle().fill(VTheme.line).frame(width: 1, height: 32)
            summaryItem(value: "\(event.functions.count)", label: "FUNCTIONS")
        }
        .padding(.vertical, 3)
    }

    private func summaryItem(value: String, label: String) -> some View {
        VStack(spacing: 7) {
            Text(value).font(VTheme.serif(23)).foregroundStyle(VTheme.ink)
            Text(label).font(.system(size: 8, weight: .semibold)).tracking(1.2).foregroundStyle(VTheme.muted)
        }
        .frame(maxWidth: .infinity)
    }

    private var guestNotice: some View {
        Label {
            Text("You're viewing the host’s curated collection. This local demo does not identify faces or send photos to guests.")
                .font(.system(size: 12)).lineSpacing(4)
        } icon: {
            Image(systemName: "lock.shield").font(.system(size: 20))
        }
        .foregroundStyle(VTheme.forest)
        .padding(16)
        .background(VTheme.forest.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
    }

    private func collectionHeader(_ event: EventRecord) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                Text("Every little moment").font(VTheme.serif(26)).foregroundStyle(VTheme.ink)
                Spacer()
                Text("\(photos.count) photos").font(.system(size: 11)).foregroundStyle(VTheme.muted)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["All"] + event.functions, id: \.self) { function in
                        FilterChip(title: function, selected: selectedFunction == function) {
                            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { selectedFunction = function }
                        }
                    }
                }
            }
        }
    }

    private var photoGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(photos, id: \.id) { photo in
                PhotoTile(photo: photo) { selectedPhoto = photo }
            }
        }
    }

    private func importPanel(_ event: EventRecord) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "arrow.up.doc").font(.system(size: 22, weight: .light)).foregroundStyle(VTheme.forest)
                VStack(alignment: .leading, spacing: 5) {
                    Text("Add to the story").font(VTheme.serif(22)).foregroundStyle(VTheme.ink)
                    Text("Import up to 20 photographs at a time. Originals stay in your photo library.")
                        .font(.system(size: 12)).foregroundStyle(VTheme.muted).lineSpacing(3)
                }
            }
            HStack {
                Text("Save under").font(.system(size: 12)).foregroundStyle(VTheme.muted)
                Spacer()
                Menu {
                    ForEach(event.functions, id: \.self) { function in
                        Button(function) { importFunction = function }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(importFunction.isEmpty ? (event.functions.first ?? "Celebration") : importFunction)
                        Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold))
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(VTheme.forest)
                }
                .disabled(importing)
            }
            if importing {
                VStack(alignment: .leading, spacing: 8) {
                    ProgressView(value: Double(importedCount), total: Double(max(importTotal, 1))).tint(VTheme.forest)
                    Text("Importing \(importedCount) of \(importTotal)…")
                        .font(.system(size: 12)).foregroundStyle(VTheme.muted)
                }
                .accessibilityElement(children: .combine)
            } else {
                PhotosPicker(selection: $selectedItems, maxSelectionCount: 20, matching: .images) {
                    Label("Choose photographs", systemImage: "plus")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(VTheme.forest, in: RoundedRectangle(cornerRadius: 13))
                }
            }
        }
        .padding(20)
        .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(VTheme.line, lineWidth: 1))
    }

    @MainActor
    private func importPhotos(_ items: [PhotosPickerItem]) async {
        guard !importing, let event else { return }
        importing = true
        importedCount = 0
        importTotal = items.count
        let function = importFunction.isEmpty ? (event.functions.first ?? "Celebration") : importFunction
        var failures = 0
        for item in items {
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    failures += 1
                    importedCount += 1
                    continue
                }
                try store.addPhoto(data: data, to: eventID, function: function)
            } catch { failures += 1 }
            importedCount += 1
        }
        selectedItems = []
        importing = false
        if failures > 0 {
            importError = "\(items.count - failures) photographs imported. \(failures) could not be imported. Check that the photos are downloaded from iCloud and try again."
        }
    }
}

// MARK: - Library

struct GalleryView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var favoritesOnly = false
    @State private var search = ""
    @State private var selectedPhoto: PhotoRecord?

    private var photos: [PhotoRecord] {
        store.events.flatMap(\.photos).filter { photo in
            (!favoritesOnly || store.favorites.contains(photo.id)) &&
            (search.isEmpty || photo.caption.localizedCaseInsensitiveContains(search) || photo.function.localizedCaseInsensitiveContains(search))
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("THE COLLECTION").font(.system(size: 10, weight: .semibold)).tracking(2.5).foregroundStyle(VTheme.gold)
                    Text("A thousand words.\nOne photograph.")
                        .font(VTheme.serif(36)).foregroundStyle(VTheme.ink).lineSpacing(0)
                    Text("Your celebrations, beautifully kept.")
                        .font(.system(size: 13)).foregroundStyle(VTheme.muted)
                }
                .padding(.top, 18)
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundStyle(VTheme.muted)
                    TextField("Search moments or functions", text: $search)
                        .font(.system(size: 13)).foregroundStyle(VTheme.ink)
                        .autocorrectionDisabled()
                    if !search.isEmpty {
                        Button { search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(VTheme.muted) }
                            .accessibilityLabel("Clear search")
                    }
                }
                .padding(15)
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(VTheme.line, lineWidth: 1))
                HStack {
                    FilterChip(title: "All photographs", selected: !favoritesOnly) { setFavorites(false) }
                    FilterChip(title: "Favourites", selected: favoritesOnly) { setFavorites(true) }
                    Spacer(minLength: 0)
                }
                HStack {
                    Text(favoritesOnly ? "Close to your heart" : "Collected moments").font(VTheme.serif(24)).foregroundStyle(VTheme.ink)
                    Spacer()
                    Text("\(photos.count)").font(.system(size: 12, weight: .medium)).foregroundStyle(VTheme.muted)
                }
                if photos.isEmpty {
                    EmptyCollectionView(symbol: favoritesOnly ? "heart" : "photo.on.rectangle", title: favoritesOnly ? "Keep your favourites close" : "No moments found", message: favoritesOnly ? "Tap the heart on a photograph to collect it here." : "Try another search or add photographs to an event.")
                } else {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(photos, id: \.id) { photo in
                            PhotoTile(photo: photo) { selectedPhoto = photo }
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 32)
        }
        .background(VTheme.cream)
        .navigationTitle("Gallery")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $selectedPhoto) { photo in
            PhotoViewer(photos: photos, initialID: photo.id)
        }
    }

    private func setFavorites(_ value: Bool) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { favoritesOnly = value }
    }
}

// MARK: - Create an event

struct NewEventSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var venue = ""
    @State private var date = Date()
    @State private var selectedFunctions: Set<String> = ["Wedding", "Reception"]
    @State private var customFunction = ""
    @State private var customFunctions: [String] = []
    private let weddingFunctions = ["Mehendi", "Haldi", "Sangeet", "Wedding", "Reception"]

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !venue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !selectedFunctions.isEmpty
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 27) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("A NEW CHAPTER").font(.system(size: 10, weight: .semibold)).tracking(2.3).foregroundStyle(VTheme.gold)
                        Text("Make room for\nsomething beautiful.").font(VTheme.serif(35)).foregroundStyle(VTheme.ink)
                        Text("One home for every photograph and every function.")
                            .font(.system(size: 13)).foregroundStyle(VTheme.muted).lineSpacing(4)
                    }
                    eventField("EVENT NAME", placeholder: "e.g. Aarav & Meera", text: $title)
                    eventField("VENUE", placeholder: "e.g. The Leela Palace, Jaipur", text: $venue)
                    VStack(alignment: .leading, spacing: 10) {
                        fieldLabel("CELEBRATION DATE")
                        DatePicker("Date", selection: $date, displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .tint(VTheme.forest)
                            .padding(16)
                            .background(.white, in: RoundedRectangle(cornerRadius: 14))
                    }
                    VStack(alignment: .leading, spacing: 14) {
                        fieldLabel("YOUR FUNCTIONS")
                        Text("Select each part of the celebration.")
                            .font(.system(size: 12)).foregroundStyle(VTheme.muted)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ForEach(weddingFunctions + customFunctions, id: \.self) { function in
                                Button {
                                    if selectedFunctions.contains(function) { selectedFunctions.remove(function) }
                                    else { selectedFunctions.insert(function) }
                                } label: {
                                    HStack {
                                        Text(function).font(.system(size: 12, weight: .medium)).lineLimit(1)
                                        Spacer(minLength: 4)
                                        Image(systemName: selectedFunctions.contains(function) ? "checkmark.circle.fill" : "circle")
                                    }
                                    .foregroundStyle(selectedFunctions.contains(function) ? VTheme.forest : VTheme.muted)
                                    .padding(15)
                                    .background(selectedFunctions.contains(function) ? VTheme.forest.opacity(0.08) : .white, in: RoundedRectangle(cornerRadius: 13))
                                    .overlay(RoundedRectangle(cornerRadius: 13).stroke(selectedFunctions.contains(function) ? VTheme.forest.opacity(0.35) : VTheme.line, lineWidth: 1))
                                }
                                .accessibilityAddTraits(selectedFunctions.contains(function) ? .isSelected : [])
                            }
                        }
                        HStack {
                            TextField("Add another function", text: $customFunction)
                                .font(.system(size: 13))
                                .onChange(of: customFunction) { _, value in customFunction = String(value.prefix(30)) }
                                .onSubmit(addCustomFunction)
                            Button(action: addCustomFunction) { Image(systemName: "plus.circle.fill").font(.system(size: 23)).foregroundStyle(VTheme.forest) }
                                .disabled(customFunction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                .accessibilityLabel("Add custom function")
                        }
                        .padding(15)
                        .background(.white, in: RoundedRectangle(cornerRadius: 13))
                    }
                    Label("Your event and photographs are stored privately on this device in this build.", systemImage: "lock.shield")
                        .font(.system(size: 12)).foregroundStyle(VTheme.muted).lineSpacing(3)
                    PrimaryButton(title: "Create celebration", icon: "arrow.right") {
                        _ = store.createEvent(
                            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                            venue: venue.trimmingCharacters(in: .whitespacesAndNewlines),
                            date: date,
                            functions: (weddingFunctions + customFunctions).filter { selectedFunctions.contains($0) }
                        )
                        if store.persistenceError == nil { dismiss() }
                    }
                    .disabled(!isValid)
                    .opacity(isValid ? 1 : 0.45)
                    if let error = store.persistenceError {
                        Text(error).font(.system(size: 12)).foregroundStyle(.red)
                    }
                }
                .padding(24)
            }
            .background(VTheme.cream)
            .navigationTitle("Create an event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Cancel") { dismiss() }.foregroundStyle(VTheme.forest) } }
        }
    }

    private func fieldLabel(_ title: String) -> some View {
        Text(title).font(.system(size: 10, weight: .semibold)).tracking(1.7).foregroundStyle(VTheme.muted)
    }

    private func eventField(_ label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            fieldLabel(label)
            TextField(placeholder, text: text)
                .font(.system(size: 15)).foregroundStyle(VTheme.ink)
                .textInputAutocapitalization(.words)
                .padding(17)
                .background(.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(VTheme.line, lineWidth: 1))
                .onChange(of: text.wrappedValue) { _, value in text.wrappedValue = String(value.prefix(80)) }
                .accessibilityLabel(label)
        }
    }

    private func addCustomFunction() {
        let name = customFunction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        if let existing = (weddingFunctions + customFunctions).first(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) {
            selectedFunctions.insert(existing)
        } else {
            customFunctions.append(name)
            selectedFunctions.insert(name)
        }
        customFunction = ""
    }
}

// MARK: - Invitations and guest entry

struct InviteView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let eventID: UUID
    @State private var qrImage: UIImage?
    @State private var showingShare = false
    @State private var copied = false
    private var invitation: String { "veyra://event/\(eventID.uuidString)" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 10) {
                        Text("YOU’RE PART OF THE STORY").font(.system(size: 9, weight: .semibold)).tracking(2.2).foregroundStyle(VTheme.gold)
                        Text("An invitation to remember.").font(VTheme.serif(33)).multilineTextAlignment(.center).foregroundStyle(VTheme.ink)
                    }
                    .padding(.top, 25)
                    VStack(spacing: 20) {
                        Text("VEYRA").font(VTheme.serif(29)).tracking(5).foregroundStyle(VTheme.forest)
                        if let qrImage {
                            Image(uiImage: qrImage).interpolation(.none).resizable().scaledToFit()
                                .frame(width: 208, height: 208)
                                .padding(12)
                                .background(.white)
                                .accessibilityLabel("QR code for the local event invitation")
                        } else {
                            ProgressView().frame(width: 232, height: 232)
                        }
                        VStack(spacing: 7) {
                            Text(store.event(eventID)?.title ?? "Your celebration")
                                .font(VTheme.serif(25)).foregroundStyle(VTheme.ink).multilineTextAlignment(.center)
                            if let event = store.event(eventID) {
                                Text(event.date.formatted(date: .abbreviated, time: .omitted))
                                    .font(.system(size: 12)).foregroundStyle(VTheme.muted)
                            }
                        }
                        Rectangle().fill(VTheme.line).frame(height: 1)
                        Text("Every moment. Everyone it belongs to.")
                            .font(.system(size: 11)).foregroundStyle(VTheme.muted)
                    }
                    .padding(28)
                    .frame(maxWidth: .infinity)
                    .background(.white, in: RoundedRectangle(cornerRadius: 24))
                    .overlay(RoundedRectangle(cornerRadius: 24).stroke(VTheme.gold.opacity(0.25), lineWidth: 1))
                    VStack(alignment: .leading, spacing: 7) {
                        Label("Local demo invitation", systemImage: "iphone")
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(VTheme.forest)
                        Text("This code opens an event already saved on this device. Sharing it does not upload the gallery or give another device access. Online invitations need the future cloud service.")
                            .font(.system(size: 12)).lineSpacing(4).foregroundStyle(VTheme.muted)
                    }
                    .padding(17)
                    .background(VTheme.forest.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
                    PrimaryButton(title: "Share invitation card", icon: "square.and.arrow.up") { showingShare = true }
                        .disabled(qrImage == nil)
                    Button {
                        UIPasteboard.general.string = invitation
                        copied = true
                    } label: {
                        Label(copied ? "Invitation code copied" : "Copy invitation code", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 13, weight: .medium)).foregroundStyle(VTheme.forest)
                    }
                    .padding(.bottom, 16)
                }
                .padding(.horizontal, 24)
            }
            .background(VTheme.cream)
            .navigationTitle("Event invitation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() }.foregroundStyle(VTheme.forest) } }
            .task { qrImage = makeQRImage(invitation) }
            .sheet(isPresented: $showingShare) {
                if let qrImage {
                    ActivitySheet(items: [qrImage, "Veyra local demo invitation: \(invitation)\nThis event must already exist on the receiving device."])
                }
            }
        }
    }

    private func makeQRImage(_ value: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(value.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)),
              let cgImage = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

struct GuestJoinView: View {
    @Environment(AppStore.self) private var store
    @State private var invitation = ""
    @State private var error: String?
    @State private var joinedID: UUID?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                ZStack {
                    Circle().stroke(VTheme.gold.opacity(0.25), lineWidth: 1).frame(width: 154, height: 154)
                    Circle().stroke(VTheme.gold.opacity(0.13), lineWidth: 1).frame(width: 190, height: 190)
                    Image(systemName: "qrcode.viewfinder").font(.system(size: 66, weight: .ultraLight)).foregroundStyle(VTheme.forest)
                }
                .frame(maxWidth: .infinity).padding(.top, 16)
                VStack(alignment: .leading, spacing: 12) {
                    Text("FOR EVERY GUEST").font(.system(size: 10, weight: .semibold)).tracking(2.3).foregroundStyle(VTheme.gold)
                    Text("You were there.\nKeep the feeling.").font(VTheme.serif(37)).foregroundStyle(VTheme.ink)
                    Text("Open an invitation to explore the moments from your celebration.")
                        .font(.system(size: 14)).foregroundStyle(VTheme.muted).lineSpacing(5)
                }
                VStack(alignment: .leading, spacing: 12) {
                    Text("INVITATION CODE").font(.system(size: 10, weight: .semibold)).tracking(1.5).foregroundStyle(VTheme.muted)
                    TextField("Paste a Veyra link or event ID", text: $invitation)
                        .font(.system(size: 13)).foregroundStyle(VTheme.ink)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .padding(18)
                        .background(.white, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(VTheme.line, lineWidth: 1))
                        .submitLabel(.go).onSubmit(joinEvent)
                    if let error { Text(error).font(.system(size: 12)).foregroundStyle(.red) }
                    PrimaryButton(title: "Open my invitation", icon: "arrow.right", action: joinEvent)
                        .disabled(invitation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .opacity(invitation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
                }
                VStack(alignment: .leading, spacing: 17) {
                    guestStep("01", title: "Open the collection", detail: "View the host’s photographs by function.")
                    guestStep("02", title: "Keep what you love", detail: "Favourite a memory and share a photo.")
                    guestStep("03", title: "Selfie search, thoughtfully", detail: "Planned for the connected release, with explicit consent. No face recognition runs in this build.")
                }
                .padding(20)
                .background(.white.opacity(0.65), in: RoundedRectangle(cornerRadius: 20))
                Text("LOCAL DEMO · Only invitations for events on this device can open. A QR scan in the Camera app can also open a saved event.")
                    .font(.system(size: 11)).foregroundStyle(VTheme.muted).lineSpacing(4)
            }
            .padding(24)
        }
        .background(VTheme.cream)
        .navigationTitle("Join a celebration")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: Binding(get: { joinedID != nil }, set: { if !$0 { joinedID = nil } })) {
            if let joinedID { EventDetailView(eventID: joinedID, guestMode: true) }
        }
    }

    private func guestStep(_ number: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(number).font(VTheme.serif(20)).foregroundStyle(VTheme.gold).frame(width: 26)
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(VTheme.ink)
                Text(detail).font(.system(size: 12)).foregroundStyle(VTheme.muted).lineSpacing(3)
            }
        }
    }

    private func joinEvent() {
        let code = invitation.trimmingCharacters(in: .whitespacesAndNewlines)
        var id = UUID(uuidString: code)
        if id == nil, let url = URL(string: code), url.scheme?.lowercased() == "veyra", url.host == "event" {
            let components = url.pathComponents.filter { $0 != "/" }
            if components.count == 1 { id = UUID(uuidString: components[0]) }
        }
        guard let id else {
            error = "Paste a valid Veyra invitation link or event ID."
            return
        }
        guard store.event(id) != nil else {
            error = "This event is not saved on this device. Try an invitation from one of your local events."
            return
        }
        error = nil
        joinedID = id
    }
}

// MARK: - Shared photo components

struct PhotoImage: View {
    @Environment(AppStore.self) private var store
    let photo: PhotoRecord
    @State private var localImage: UIImage?

    var body: some View {
        Group {
            if let localImage {
                Image(uiImage: localImage).resizable().scaledToFill()
            } else if photo.localFilename == nil {
                Image(photo.imageName).resizable().scaledToFill()
            } else {
                ZStack {
                    VTheme.line
                    Image(systemName: "photo").font(.system(size: 25, weight: .light)).foregroundStyle(VTheme.muted)
                }
            }
        }
        .task(id: photo.id) {
            guard let url = store.photoURL(photo) else { return }
            localImage = UIImage(contentsOfFile: url.path)
        }
    }
}

private struct PhotoTile: View {
    @Environment(AppStore.self) private var store
    let photo: PhotoRecord
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(action: action) {
                GeometryReader { geometry in
                    PhotoImage(photo: photo)
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                }
                .frame(height: 208)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open \(photo.caption)")
            .overlay(alignment: .topTrailing) {
                Button { store.toggleFavorite(photo.id) } label: {
                    Image(systemName: store.favorites.contains(photo.id) ? "heart.fill" : "heart")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(store.favorites.contains(photo.id) ? VTheme.forest : .white)
                        .frame(width: 32, height: 32)
                        .background(store.favorites.contains(photo.id) ? .white.opacity(0.95) : .black.opacity(0.22), in: Circle())
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(store.favorites.contains(photo.id) ? "Remove from favourites" : "Add to favourites")
                .padding(2)
            }
            Text(photo.function.uppercased()).font(.system(size: 8, weight: .semibold)).tracking(1.4).foregroundStyle(VTheme.muted).padding(.leading, 2)
        }
        .padding(.bottom, 9)
    }
}

private struct PhotoViewer: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let photos: [PhotoRecord]
    @State private var selectedID: UUID
    @State private var showingShare = false
    @State private var shareImage: UIImage?
    @State private var shareError = false

    init(photos: [PhotoRecord], initialID: UUID) {
        self.photos = photos
        _selectedID = State(initialValue: initialID)
    }

    private var selectedPhoto: PhotoRecord? { photos.first { $0.id == selectedID } }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 17)).frame(width: 44, height: 44) }
                    .accessibilityLabel("Close photograph")
                Spacer()
                Text("\((photos.firstIndex { $0.id == selectedID } ?? 0) + 1) / \(photos.count)")
                    .font(.system(size: 12, weight: .medium, design: .monospaced)).foregroundStyle(.white.opacity(0.6))
                Spacer()
                Button { store.toggleFavorite(selectedID) } label: {
                    Image(systemName: store.favorites.contains(selectedID) ? "heart.fill" : "heart").font(.system(size: 18)).frame(width: 44, height: 44)
                }
                .accessibilityLabel(store.favorites.contains(selectedID) ? "Remove from favourites" : "Add to favourites")
            }
            .foregroundStyle(.white).padding(.horizontal, 12)
            TabView(selection: $selectedID) {
                ForEach(photos, id: \.id) { photo in
                    FittedPhotoView(photo: photo).tag(photo.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text(selectedPhoto?.function.uppercased() ?? "MOMENT").font(.system(size: 9, weight: .semibold)).tracking(2).foregroundStyle(VTheme.gold)
                        Text(selectedPhoto?.caption ?? "A moment to remember").font(VTheme.serif(24)).foregroundStyle(.white)
                    }
                    Spacer()
                    Button(action: sharePhoto) {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 19)).foregroundStyle(.white)
                            .frame(width: 48, height: 48).background(.white.opacity(0.1), in: Circle())
                    }
                    .accessibilityLabel("Share photograph")
                }
                Text("Swipe to explore the collection").font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(24)
        }
        .background(Color(red: 0.055, green: 0.075, blue: 0.068).ignoresSafeArea())
        .sheet(isPresented: $showingShare) { if let shareImage { ActivitySheet(items: [shareImage]) } }
        .alert("Photo unavailable", isPresented: $shareError) {
            Button("OK", role: .cancel) { }
        } message: { Text("The image could not be opened for sharing. Please try again.") }
    }

    private func sharePhoto() {
        guard let photo = selectedPhoto else { return }
        if let url = store.photoURL(photo) { shareImage = UIImage(contentsOfFile: url.path) }
        else { shareImage = UIImage(named: photo.imageName) }
        if shareImage != nil { showingShare = true } else { shareError = true }
    }
}

private struct FittedPhotoView: View {
    @Environment(AppStore.self) private var store
    let photo: PhotoRecord
    @State private var localImage: UIImage?
    @State private var zoomed = false

    var body: some View {
        GeometryReader { geometry in
            Group {
                if let localImage { Image(uiImage: localImage).resizable().scaledToFit() }
                else if photo.localFilename == nil { Image(photo.imageName).resizable().scaledToFit() }
                else { Image(systemName: "photo").font(.largeTitle).foregroundStyle(.white.opacity(0.5)) }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .scaleEffect(zoomed ? 1.8 : 1)
            .clipped()
            .onTapGesture(count: 2) { zoomed.toggle() }
            .accessibilityLabel(photo.caption)
            .accessibilityHint("Double tap to zoom")
        }
        .task(id: photo.id) {
            if let url = store.photoURL(photo) { localImage = UIImage(contentsOfFile: url.path) }
        }
    }
}

private struct FilterChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(.system(size: 12, weight: selected ? .semibold : .regular))
                .foregroundStyle(selected ? .white : VTheme.muted)
                .padding(.horizontal, 17).padding(.vertical, 11)
                .background(selected ? VTheme.forest : .white.opacity(0.65), in: Capsule())
                .overlay(Capsule().stroke(selected ? .clear : VTheme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct EmptyCollectionView: View {
    let symbol: String
    let title: String
    let message: String
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbol).font(.system(size: 35, weight: .ultraLight)).foregroundStyle(VTheme.gold)
            Text(title).font(VTheme.serif(25)).foregroundStyle(VTheme.ink)
            Text(message).font(.system(size: 13)).foregroundStyle(VTheme.muted).multilineTextAlignment(.center).lineSpacing(4)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 25).padding(.vertical, 48)
        .background(.white.opacity(0.5), in: RoundedRectangle(cornerRadius: 20))
    }
}

struct ActivitySheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) { }
}
