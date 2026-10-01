import Foundation
import Observation
import UIKit
import ImageIO

struct PhotoRecord: Codable, Identifiable, Hashable {
    var id = UUID()
    var imageName: String
    var localFilename: String? = nil
    var function: String
    var caption: String
}

struct EventRecord: Codable, Identifiable, Hashable {
    var id = UUID()
    var title: String
    var venue: String
    var date: Date
    var coverName: String
    var functions: [String]
    var photos: [PhotoRecord]
    var guests: Int
    var category: String
}

enum LocalStoreError: LocalizedError {
    case eventNotFound
    case unknownFunction
    case imageTooLarge
    case invalidImage
    case storageFailure(String)

    var errorDescription: String? {
        switch self {
        case .eventNotFound: return "This event is no longer available."
        case .unknownFunction: return "Choose a function that belongs to this event."
        case .imageTooLarge: return "Choose a photo smaller than 30 MB and 80 megapixels."
        case .invalidImage: return "This file could not be opened as a photo. Try a JPEG, PNG, or HEIC image."
        case .storageFailure(let reason): return "Your changes could not be saved on this device. \(reason)"
        }
    }
}

/// Local-only product prototype. Matching and message delivery require a separate service.
@MainActor
@Observable
final class AppStore {
    var events: [EventRecord] = []
    var favorites: Set<UUID> = []
    var faceConsent = false
    var notificationsEnabled = false
    var selectedPlan = "Starter"
    var persistenceError: String?

    private var unreadableState = false
    private let directory: URL
    private var photosDirectory: URL { directory.appendingPathComponent("Photos", isDirectory: true) }
    private var stateURL: URL { directory.appendingPathComponent("state.json") }
    private let fileManager = FileManager.default

    private struct SavedState: Codable {
        var version: Int
        var events: [EventRecord]
        var favorites: Set<UUID>
        var faceConsent: Bool
        var notificationsEnabled: Bool
        var selectedPlan: String
    }

    convenience init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        self.init(directory: base.appendingPathComponent("Veyra", isDirectory: true))
    }

    init(directory: URL, seedSamples: Bool = true) {
        self.directory = directory
        do {
            try prepareDirectories()
            if fileManager.fileExists(atPath: stateURL.path) {
                let attributes = try fileManager.attributesOfItem(atPath: stateURL.path)
                guard ((attributes[.size] as? NSNumber)?.intValue ?? 0) < 20_000_000 else {
                    throw LocalStoreError.storageFailure("The saved event index is too large to open.")
                }
                let state = try JSONDecoder().decode(SavedState.self, from: Data(contentsOf: stateURL))
                guard state.version == 1 else {
                    throw LocalStoreError.storageFailure("This data was created by a newer app version.")
                }
                let eventIDs = state.events.map(\.id)
                let photoIDs = state.events.flatMap(\.photos).map(\.id)
                guard Set(eventIDs).count == eventIDs.count, Set(photoIDs).count == photoIDs.count else {
                    throw LocalStoreError.storageFailure("The saved gallery contains duplicate records.")
                }
                events = state.events
                let knownPhotos = Set(events.flatMap(\.photos).map(\.id))
                favorites = state.favorites.intersection(knownPhotos)
                faceConsent = state.faceConsent
                notificationsEnabled = state.notificationsEnabled
                selectedPlan = state.selectedPlan
            } else {
                events = seedSamples ? Self.sampleEvents() : []
                try persistState()
            }
        } catch {
            // Block subsequent saves too; only explicit local-data deletion may replace unreadable data.
            unreadableState = fileManager.fileExists(atPath: stateURL.path)
            persistenceError = "Saved events could not be opened. \(error.localizedDescription)"
        }
    }

    @discardableResult
    func createEvent(title: String, venue: String, date: Date, functions: [String]) -> UUID {
        let title = Self.normalized(title, limit: 120)
        let venue = Self.normalized(venue, limit: 160)
        var seen = Set<String>()
        let functions = functions.map { Self.normalized($0, limit: 40) }
            .filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
        let event = EventRecord(
            title: title.isEmpty ? "Untitled event" : title,
            venue: venue.isEmpty ? "Venue to be announced" : venue,
            date: date.timeIntervalSinceReferenceDate.isFinite ? date : Date(),
            coverName: "celebration",
            functions: functions.isEmpty ? ["Main event"] : Array(functions.prefix(12)),
            photos: [], guests: 0, category: "Celebration"
        )
        events.insert(event, at: 0)
        save()
        return event.id
    }

    func event(_ id: UUID) -> EventRecord? {
        events.first { $0.id == id }
    }

    func toggleFavorite(_ id: UUID) {
        guard events.contains(where: { $0.photos.contains(where: { $0.id == id }) }) else {
            persistenceError = "This photo is no longer available."
            return
        }
        if favorites.contains(id) { favorites.remove(id) } else { favorites.insert(id) }
        save()
    }

    /// Imports a bounded, downsampled JPEG. Original metadata and location are not copied.
    func addPhoto(data: Data, to eventID: UUID, function: String) throws {
        guard let index = events.firstIndex(where: { $0.id == eventID }) else {
            throw LocalStoreError.eventNotFound
        }
        guard events[index].functions.contains(function) else { throw LocalStoreError.unknownFunction }
        let jpeg = try Self.optimizedJPEG(data)
        let id = UUID()
        let filename = id.uuidString.lowercased() + ".jpg"
        let url = photosDirectory.appendingPathComponent(filename)
        do {
            try prepareDirectories()
            try jpeg.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            let photo = PhotoRecord(id: id, imageName: "", localFilename: filename,
                                    function: function, caption: "\(function) · Your photograph")
            events[index].photos.append(photo)
            do {
                try persistState()
            } catch {
                events[index].photos.removeAll { $0.id == id }
                // The generated path is owned by this import; cleanup never uses external input.
                do { try fileManager.removeItem(at: url) }
                catch {
                    throw LocalStoreError.storageFailure("The import failed, and its unfinished local photo could not be removed. \(error.localizedDescription)")
                }
                throw error
            }
            persistenceError = nil
        } catch {
            let failure = LocalStoreError.storageFailure(error.localizedDescription)
            persistenceError = failure.localizedDescription
            throw failure
        }
    }

    func deletePhoto(_ id: UUID, from eventID: UUID) {
        guard let eventIndex = events.firstIndex(where: { $0.id == eventID }),
              let photoIndex = events[eventIndex].photos.firstIndex(where: { $0.id == id }) else { return }
        let oldPhotos = events[eventIndex].photos
        let oldFavorites = favorites
        let photo = events[eventIndex].photos.remove(at: photoIndex)
        favorites.remove(id)
        do {
            try persistState()
        } catch {
            events[eventIndex].photos = oldPhotos
            favorites = oldFavorites
            persistenceError = "The photo could not be deleted. \(error.localizedDescription)"
            return
        }
        do {
            let stillReferenced = events.flatMap(\.photos).contains {
                $0.localFilename != nil && $0.localFilename == photo.localFilename
            }
            if !stillReferenced, let url = photoURL(photo), fileManager.fileExists(atPath: url.path) {
                try fileManager.removeItem(at: url)
            }
            persistenceError = nil
        } catch {
            persistenceError = "The photo was removed from your gallery, but its local file could not be deleted. \(error.localizedDescription)"
        }
    }

    /// Erases local galleries, preferences, and imported images. Does not reseed sample events.
    func deleteLocalData() {
        let previous = currentState()
        let wasUnreadable = unreadableState
        unreadableState = false
        events = []
        favorites = []
        faceConsent = false
        notificationsEnabled = false
        selectedPlan = "Starter"
        do {
            try persistState()
        } catch {
            unreadableState = wasUnreadable
            events = previous.events
            favorites = previous.favorites
            faceConsent = previous.faceConsent
            notificationsEnabled = previous.notificationsEnabled
            selectedPlan = previous.selectedPlan
            persistenceError = "Local data could not be deleted. \(error.localizedDescription)"
            return
        }
        do {
            if fileManager.fileExists(atPath: photosDirectory.path) {
                try fileManager.removeItem(at: photosDirectory)
            }
            try prepareDirectories()
            persistenceError = nil
        } catch {
            persistenceError = "Your galleries were cleared, but some local photo files could not be erased. \(error.localizedDescription)"
        }
    }

    func save() {
        do {
            try persistState()
            persistenceError = nil
        } catch {
            persistenceError = "Your changes are visible but could not be saved on this device. \(error.localizedDescription)"
        }
    }

    /// Only app-generated UUID filenames are resolvable, including when loading edited JSON.
    func photoURL(_ photo: PhotoRecord) -> URL? {
        guard let filename = photo.localFilename,
              filename.hasSuffix(".jpg"), filename.count == 40,
              let uuid = UUID(uuidString: String(filename.dropLast(4))),
              filename.lowercased() == uuid.uuidString.lowercased() + ".jpg" else { return nil }
        let candidate = photosDirectory.appendingPathComponent(filename)
        let resolvedParent = candidate.resolvingSymlinksInPath().deletingLastPathComponent()
        guard resolvedParent == photosDirectory.resolvingSymlinksInPath() else { return nil }
        return candidate
    }

    private func prepareDirectories() throws {
        try fileManager.createDirectory(at: photosDirectory, withIntermediateDirectories: true,
                                        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        var protectedDirectory = directory
        var values = URLResourceValues()
        // Face-related preferences and private event photos stay on this device.
        values.isExcludedFromBackup = true
        try protectedDirectory.setResourceValues(values)
    }

    private func currentState() -> SavedState {
        SavedState(version: 1, events: events, favorites: favorites, faceConsent: faceConsent,
                   notificationsEnabled: notificationsEnabled, selectedPlan: selectedPlan)
    }

    private func persistState() throws {
        guard !unreadableState else {
            throw LocalStoreError.storageFailure("Existing data is unreadable and has been preserved. Delete local data in You to reset this device.")
        }
        try prepareDirectories()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(currentState())
        try data.write(to: stateURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    private static func normalized(_ text: String, limit: Int) -> String {
        let collapsed = text.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }.joined(separator: " ")
        return String(collapsed.prefix(limit))
    }

    private static func optimizedJPEG(_ data: Data) throws -> Data {
        guard data.count <= 30_000_000 else { throw LocalStoreError.imageTooLarge }
        guard !data.isEmpty,
              let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              CGImageSourceGetCount(source) > 0,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue,
              let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue,
              width > 0, height > 0 else { throw LocalStoreError.invalidImage }
        guard width <= 32_000, height <= 32_000, width <= 80_000_000 / height else {
            throw LocalStoreError.imageTooLarge
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 2_400,
            kCGImageSourceShouldCacheImmediately: true
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              let jpeg = UIImage(cgImage: image).jpegData(compressionQuality: 0.86) else {
            throw LocalStoreError.invalidImage
        }
        return jpeg
    }

    private static func sampleEvents() -> [EventRecord] {
        let calendar = Calendar(identifier: .gregorian)
        func date(_ day: Int, month: Int = 9) -> Date {
            calendar.date(from: DateComponents(year: 2026, month: month, day: day, hour: 18)) ?? Date()
        }
        return [
            EventRecord(title: "Aanya & Rohan", venue: "The Oberoi Udaivilas, Udaipur", date: date(12),
                        coverName: "weddingHero", functions: ["Haldi", "Mehendi", "Sangeet", "Wedding", "Reception"],
                        photos: [
                            PhotoRecord(imageName: "weddingHero", function: "Wedding", caption: "A new forever begins"),
                            PhotoRecord(imageName: "weddingDetail", function: "Mehendi", caption: "Every little detail, remembered"),
                            PhotoRecord(imageName: "celebration", function: "Sangeet", caption: "A night made of joy")
                        ], guests: 248, category: "Wedding"),
            EventRecord(title: "Ishita & Kabir", venue: "Samode Haveli, Jaipur", date: date(20),
                        coverName: "weddingDetail", functions: ["Engagement", "Portraits"],
                        photos: [PhotoRecord(imageName: "weddingDetail", function: "Engagement", caption: "The beginning of always")],
                        guests: 86, category: "Engagement"),
            EventRecord(title: "Studio After Hours", venue: "The Bombay Canteen, Mumbai", date: date(25),
                        coverName: "celebration", functions: ["Launch", "Afterparty"],
                        photos: [PhotoRecord(imageName: "celebration", function: "Launch", caption: "Bright ideas. Brighter company.")],
                        guests: 120, category: "Brand launch")
        ]
    }
}
