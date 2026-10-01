import XCTest
import UIKit
@testable import Veyra

final class StoreTests: XCTestCase {
    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("VeyraTests-" + UUID().uuidString)
    }

    @MainActor
    func testEventAndPreferencesSurviveRelaunch() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory, seedSamples: false)
        let id = store.createEvent(title: "Reception", venue: "Udaipur", date: Date(), functions: ["Reception"])
        store.faceConsent = true
        store.notificationsEnabled = true
        store.selectedPlan = "Studio"
        store.save()
        let restored = AppStore(directory: directory, seedSamples: false)
        XCTAssertEqual(restored.event(id)?.title, "Reception")
        XCTAssertTrue(restored.faceConsent)
        XCTAssertTrue(restored.notificationsEnabled)
        XCTAssertEqual(restored.selectedPlan, "Studio")
        XCTAssertNil(restored.persistenceError)
    }

    @MainActor
    func testEventInputIsNormalizedAndBounded() {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory, seedSamples: false)
        let id = store.createEvent(title: "  Aanya  &\n Rohan  ", venue: "   ", date: Date(),
                                   functions: [" Haldi ", "haldi", "", "Wedding"])
        XCTAssertEqual(store.event(id)?.title, "Aanya & Rohan")
        XCTAssertEqual(store.event(id)?.venue, "Venue to be announced")
        XCTAssertEqual(store.event(id)?.functions, ["Haldi", "Wedding"])
        let empty = store.createEvent(title: " ", venue: "", date: Date(), functions: [])
        XCTAssertEqual(store.event(empty)?.title, "Untitled event")
        XCTAssertEqual(store.event(empty)?.functions, ["Main event"])
        let long = store.createEvent(title: String(repeating: "a", count: 200), venue: "", date: Date(), functions: [])
        XCTAssertEqual(store.event(long)?.title.count, 120)
    }

    @MainActor
    func testFavoritesPersistAndUnknownPhotosCannotBeFavorited() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory)
        let photo = try XCTUnwrap(store.events.first?.photos.first)
        store.toggleFavorite(photo.id)
        XCTAssertTrue(AppStore(directory: directory).favorites.contains(photo.id))
        store.toggleFavorite(photo.id)
        XCTAssertFalse(store.favorites.contains(photo.id))
        let unknownID = UUID()
        store.toggleFavorite(unknownID)
        XCTAssertFalse(store.favorites.contains(unknownID))
    }

    @MainActor
    func testImportDeletionAndEventIsolation() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory, seedSamples: false)
        let first = store.createEvent(title: "First", venue: "", date: Date(), functions: ["Wedding"])
        let second = store.createEvent(title: "Second", venue: "", date: Date(), functions: ["Launch"])
        let image = UIGraphicsImageRenderer(size: CGSize(width: 80, height: 60)).image { context in
            UIColor.purple.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 80, height: 60))
        }
        let data = try XCTUnwrap(image.pngData())
        try store.addPhoto(data: data, to: first, function: "Wedding")
        XCTAssertEqual(store.event(first)?.photos.count, 1)
        XCTAssertEqual(store.event(second)?.photos.count, 0)
        let photo = try XCTUnwrap(store.event(first)?.photos.first)
        let url = try XCTUnwrap(store.photoURL(photo))
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        XCTAssertNotNil(UIImage(contentsOfFile: url.path))
        store.toggleFavorite(photo.id)
        store.deletePhoto(photo.id, from: second)
        XCTAssertEqual(store.event(first)?.photos.count, 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        store.deletePhoto(photo.id, from: first)
        XCTAssertEqual(store.event(first)?.photos.count, 0)
        XCTAssertFalse(store.favorites.contains(photo.id))
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertEqual(AppStore(directory: directory).event(first)?.photos.count, 0)
    }

    @MainActor
    func testInvalidImageAndWrongEventDoNotMutateGallery() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory, seedSamples: false)
        let id = store.createEvent(title: "Wedding", venue: "", date: Date(), functions: ["Haldi"])
        XCTAssertThrowsError(try store.addPhoto(data: Data("not an image".utf8), to: id, function: "Haldi"))
        XCTAssertThrowsError(try store.addPhoto(data: Data(), to: UUID(), function: "Haldi"))
        XCTAssertThrowsError(try store.addPhoto(data: Data(), to: id, function: "Launch"))
        XCTAssertEqual(store.event(id)?.photos.count, 0)
    }

    @MainActor
    func testLargePhotoIsDownsampledBeforeStorage() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory, seedSamples: false)
        let id = store.createEvent(title: "Wedding", venue: "", date: Date(), functions: ["Wedding"])
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 3_000, height: 1_000), format: format).image { context in
            UIColor.orange.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 3_000, height: 1_000))
        }
        try store.addPhoto(data: XCTUnwrap(image.pngData()), to: id, function: "Wedding")
        let photo = try XCTUnwrap(store.event(id)?.photos.first)
        let url = try XCTUnwrap(store.photoURL(photo))
        let storedImage = try XCTUnwrap(UIImage(contentsOfFile: url.path)?.cgImage)
        XCTAssertLessThanOrEqual(storedImage.width, 2_400)
        XCTAssertLessThanOrEqual(storedImage.height, 2_400)
        XCTAssertTrue(photo.localFilename?.hasSuffix(".jpg") == true)
    }

    @MainActor
    func testUntrustedPhotoPathCannotEscapeStorage() {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory, seedSamples: false)
        let photo = PhotoRecord(imageName: "", localFilename: "../../private.jpg", function: "Wedding", caption: "")
        XCTAssertNil(store.photoURL(photo))
        let absolute = PhotoRecord(imageName: "", localFilename: "/tmp/private.jpg", function: "Wedding", caption: "")
        XCTAssertNil(store.photoURL(absolute))
    }

    @MainActor
    func testDeleteLocalDataRemainsEmptyAfterRelaunch() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = AppStore(directory: directory)
        store.faceConsent = true
        store.selectedPlan = "Studio"
        let photo = try XCTUnwrap(store.events.first?.photos.first)
        store.toggleFavorite(photo.id)
        store.deleteLocalData()
        let restored = AppStore(directory: directory)
        XCTAssertTrue(restored.events.isEmpty)
        XCTAssertTrue(restored.favorites.isEmpty)
        XCTAssertFalse(restored.faceConsent)
        XCTAssertFalse(restored.notificationsEnabled)
        XCTAssertEqual(restored.selectedPlan, "Starter")
    }

    @MainActor
    func testCorruptPersistenceIsReportedAndPreserved() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let badData = Data("broken json".utf8)
        let stateURL = directory.appendingPathComponent("state.json")
        try badData.write(to: stateURL)
        let store = AppStore(directory: directory)
        XCTAssertNotNil(store.persistenceError)
        XCTAssertTrue(store.events.isEmpty)
        store.save()
        XCTAssertNotNil(store.persistenceError)
        XCTAssertEqual(try Data(contentsOf: stateURL), badData)
        store.deleteLocalData()
        XCTAssertNil(store.persistenceError)
        XCTAssertTrue(AppStore(directory: directory).events.isEmpty)
    }
}
