import XCTest

final class VeyraUITests: XCTestCase {
    @MainActor
    func testGuestCanBrowseEventAndReturnToGallery() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        XCTAssertTrue(app.buttons["featuredEvent"].waitForExistence(timeout: 10))
        app.buttons["featuredEvent"].tap()
        XCTAssertTrue(app.staticTexts["Aanya & Rohan"].firstMatch.waitForExistence(timeout: 5))
        let back = app.buttons["eventBackButton"]
        XCTAssertTrue(back.waitForExistence(timeout: 5))
        back.tap()
        app.tabBars.buttons["Gallery"].tap()
        XCTAssertTrue(app.textFields["Search moments or functions"].waitForExistence(timeout: 5))
        app.buttons["Favourites"].tap()
        XCTAssertTrue(app.staticTexts["Keep your favourites close"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testPlanPreviewExplicitlyDoesNotCharge() {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        app.tabBars.buttons["Studio"].tap()
        let preview = app.buttons["previewPlan"]
        for _ in 0..<3 where !preview.isHittable { app.swipeUp() }
        XCTAssertTrue(preview.waitForExistence(timeout: 5))
        preview.tap()
        XCTAssertTrue(app.alerts.firstMatch.waitForExistence(timeout: 5))
        let noCharge = app.alerts.staticTexts
            .containing(NSPredicate(format: "label CONTAINS %@", "No payment was taken"))
            .firstMatch
        XCTAssertTrue(noCharge.waitForExistence(timeout: 5))
    }
}
