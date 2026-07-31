import Foundation
import Tauri
import UIKit
import UniformTypeIdentifiers

private let vaultBookmarkKey = "com.cosmos.icloud-vault.bookmark"

private struct VaultFileArgs: Decodable {
  let path: String
  let content: String?
}

/// Keeps user-selected iCloud Drive vaults open in place. The bookmark lets
/// iOS restore the security-scoped directory after Cosmos is relaunched.
final class IcloudVaultPlugin: Plugin, UIDocumentPickerDelegate {
  private var activeVaultURL: URL?
  private var pendingInvoke: Invoke?

  override init() {
    super.init()
    restoreVaultAccess()
  }

  @objc public func chooseVault(_ invoke: Invoke) throws {
    guard pendingInvoke == nil else {
      invoke.reject("A vault picker is already open")
      return
    }
    pendingInvoke = invoke

    guard #available(iOS 14.0, *) else {
      pendingInvoke?.reject("Cosmos for iPhone requires iOS 14 or later")
      pendingInvoke = nil
      return
    }
    showVaultPicker()
  }

  /// iCloud Drive can change the file from another device while Cosmos is
  /// running. Coordinate every task-store read so iOS presents a consistent
  /// version instead of racing the file provider.
  @objc public func readTaskStore(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(VaultFileArgs.self)
    do {
      let content = try coordinatedRead(taskStoreURL(for: args.path))
      invoke.resolve(["content": content])
    } catch {
      invoke.reject("Could not read iCloud task store: \(error.localizedDescription)")
    }
  }

  /// Coordinate replacement writes to avoid clobbering an in-flight iCloud
  /// update. The task store is deliberately separate from the main vault
  /// index, so this operation only ever touches task data.
  @objc public func writeTaskStore(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(VaultFileArgs.self)
    guard let content = args.content else {
      invoke.reject("Task store content is required")
      return
    }

    do {
      try coordinatedWrite(content, to: taskStoreURL(for: args.path))
      invoke.resolve()
    } catch {
      invoke.reject("Could not write iCloud task store: \(error.localizedDescription)")
    }
  }

  @available(iOS 14.0, *)
  private func showVaultPicker() {
    DispatchQueue.main.async {
      let picker = UIDocumentPickerViewController(
        forOpeningContentTypes: [UTType.folder],
        asCopy: false
      )
      picker.delegate = self
      picker.allowsMultipleSelection = false
      picker.modalPresentationStyle = .fullScreen
      self.manager.viewController?.present(picker, animated: true)
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    defer { pendingInvoke = nil }
    guard let url = urls.first else {
      pendingInvoke?.reject("No vault folder was selected")
      return
    }

    do {
      try activateVault(url)
      pendingInvoke?.resolve(["path": url.path])
    } catch {
      pendingInvoke?.reject("Could not access this iCloud Drive folder: \(error.localizedDescription)")
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pendingInvoke?.reject("Vault selection was cancelled")
    pendingInvoke = nil
  }

  private func restoreVaultAccess() {
    guard let bookmark = UserDefaults.standard.data(forKey: vaultBookmarkKey) else { return }
    var isStale = false

    do {
      let url = try URL(
        resolvingBookmarkData: bookmark,
        options: [],
        relativeTo: nil,
        bookmarkDataIsStale: &isStale
      )
      try activateVault(url, persistBookmark: isStale)
    } catch {
      // The app can still open its vault picker if iOS invalidates a bookmark.
      UserDefaults.standard.removeObject(forKey: vaultBookmarkKey)
    }
  }

  private func activateVault(_ url: URL, persistBookmark: Bool = true) throws {
    if let activeVaultURL {
      activeVaultURL.stopAccessingSecurityScopedResource()
      self.activeVaultURL = nil
    }

    guard url.startAccessingSecurityScopedResource() else {
      throw NSError(
        domain: "CosmosIcloudVault",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "iOS did not grant access to this folder"]
      )
    }

    do {
      if persistBookmark {
        // iOS does not support macOS's `.withSecurityScope` bookmark option.
        // A normal bookmark plus `startAccessingSecurityScopedResource()` is
        // the supported way to reopen a folder chosen in Files.
        let bookmark = try url.bookmarkData(
          options: [],
          includingResourceValuesForKeys: nil,
          relativeTo: nil
        )
        UserDefaults.standard.set(bookmark, forKey: vaultBookmarkKey)
      }
      activeVaultURL = url
    } catch {
      url.stopAccessingSecurityScopedResource()
      throw error
    }
  }

  private func taskStoreURL(for vaultPath: String) -> URL {
    URL(fileURLWithPath: vaultPath, isDirectory: true)
      .appendingPathComponent(".moodboard", isDirectory: true)
      .appendingPathComponent("tasks.json", isDirectory: false)
  }

  private func coordinatedRead(_ url: URL) throws -> String {
    let coordinator = NSFileCoordinator()
    var coordinationError: NSError?
    var content: String?
    var operationError: Error?

    coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinatedURL in
      do {
        content = try String(contentsOf: coordinatedURL, encoding: .utf8)
      } catch {
        operationError = error
      }
    }

    if let coordinationError { throw coordinationError }
    if let operationError { throw operationError }
    guard let content else {
      throw NSError(
        domain: "CosmosIcloudVault",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "The iCloud task store was empty"]
      )
    }
    return content
  }

  private func coordinatedWrite(_ content: String, to url: URL) throws {
    let coordinator = NSFileCoordinator()
    var coordinationError: NSError?
    var operationError: Error?
    let data = Data(content.utf8)

    coordinator.coordinate(writingItemAt: url, options: [], error: &coordinationError) { coordinatedURL in
      do {
        try data.write(to: coordinatedURL, options: .atomic)
      } catch {
        operationError = error
      }
    }

    if let coordinationError { throw coordinationError }
    if let operationError { throw operationError }
  }
}

@_cdecl("init_plugin_cosmos_icloud_vault")
func initPlugin() -> Plugin {
  return IcloudVaultPlugin()
}
