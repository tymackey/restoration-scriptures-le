import AppKit

// A convenience launcher for the isolated simulator build, not a Mac port.
final class Launcher: NSObject, NSApplicationDelegate {
    private var window: NSWindow!
    private let device = "74FCB00A-3609-4F19-B166-6750BD06ABC6"
    private let bundleID = "info.scriptures.rescriptures.lelabels"

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 410, height: 120),
                          styleMask: [.titled], backing: .buffered, defer: false)
        window.title = "Scriptures LE Test"
        let label = NSTextField(labelWithString: "Opening your scriptures in iPad Simulator…")
        label.frame = NSRect(x: 24, y: 65, width: 365, height: 22)
        let progress = NSProgressIndicator(frame: NSRect(x: 24, y: 32, width: 362, height: 16))
        progress.style = .bar
        progress.isIndeterminate = true
        progress.startAnimation(nil)
        window.contentView?.addSubview(label)
        window.contentView?.addSubview(progress)
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try self.openScriptures()
                DispatchQueue.main.async { NSApp.terminate(nil) }
            } catch {
                let message = error.localizedDescription
                DispatchQueue.main.async {
                    self.window.orderOut(nil)
                    let alert = NSAlert()
                    alert.messageText = "Scriptures LE Test could not open"
                    alert.informativeText = "This launcher needs Xcode and the dedicated Scriptures LE Test iPad simulator.\n\n" + message
                    alert.addButton(withTitle: "OK")
                    alert.runModal()
                    NSApp.terminate(nil)
                }
            }
        }
    }

    @discardableResult
    private func run(_ executable: String, _ arguments: [String], allowFailure: Bool = false) throws -> Int32 {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        var environment = ProcessInfo.processInfo.environment
        environment["DEVELOPER_DIR"] = "/Applications/Xcode.app/Contents/Developer"
        process.environment = environment
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        try process.run()
        let output = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        if process.terminationStatus != 0 && !allowFailure {
            throw NSError(domain: "ScripturesLELauncher", code: Int(process.terminationStatus),
                          userInfo: [NSLocalizedDescriptionKey: String(data: output, encoding: .utf8) ?? "The system command failed."])
        }
        return process.terminationStatus
    }

    private func openScriptures() throws {
        try run("/usr/bin/xcrun", ["simctl", "bootstatus", device, "-b"])
        // Reuse the existing installation and its saved reading state.
        if try run("/usr/bin/xcrun", ["simctl", "get_app_container", device, bundleID, "app"], allowFailure: true) != 0 {
            guard let archive = Bundle.main.url(forResource: "ScripturesLETest", withExtension: "zip") else {
                throw NSError(domain: "ScripturesLELauncher", code: 1,
                              userInfo: [NSLocalizedDescriptionKey: "The bundled test app is missing."])
            }
            let scratch = FileManager.default.temporaryDirectory.appendingPathComponent("ScripturesLE-" + UUID().uuidString)
            try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: scratch) }
            try run("/usr/bin/ditto", ["-x", "-k", archive.path, scratch.path])
            try run("/usr/bin/xcrun", ["simctl", "install", device, scratch.appendingPathComponent("ScripturesLETest.app").path])
        }
        try run("/usr/bin/xcrun", ["simctl", "launch", device, bundleID])
        try run("/usr/bin/open", ["-a", "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app", "--args", "-CurrentDeviceUDID", device])
    }
}

let app = NSApplication.shared
let delegate = Launcher()
app.setActivationPolicy(.accessory)
app.delegate = delegate
app.run()
