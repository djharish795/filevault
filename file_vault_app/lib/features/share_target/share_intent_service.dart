import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_vault_app/features/share_target/shared_file_model.dart';

/// Single source of truth for pending shared files.
///
/// Architecture:
///   - Files are SET once when Android intent arrives (main.dart)
///   - Files are READ by ShareSessionScreen (never consumed/cleared on read)
///   - Files are CLEARED only on explicit exit: cancel, upload success, or logout
///   - The singleton mirrors the Riverpod state so the router redirect can
///     check hasPendingFiles synchronously without a BuildContext.
class ShareIntentService {
  ShareIntentService._();
  static final ShareIntentService instance = ShareIntentService._();

  List<SharedFileModel> _pendingFiles = [];

  List<SharedFileModel> get pendingFiles => List.unmodifiable(_pendingFiles);
  bool get hasPendingFiles => _pendingFiles.isNotEmpty;

  void setFiles(List<SharedFileModel> files) {
    debugLog('setFiles: ${files.length} file(s)');
    _pendingFiles = List.of(files);
  }

  /// Read without clearing — safe to call multiple times.
  List<SharedFileModel> readFiles() => List.unmodifiable(_pendingFiles);

  /// Clear all pending state — call only on explicit exit.
  void clear() {
    debugLog('clear: pending files removed');
    _pendingFiles = [];
  }

  void debugLog(String msg) {
    // ignore: avoid_print
    print('[ShareIntent] $msg');
  }
}

/// Riverpod provider — mirrors ShareIntentService state reactively.
/// The router's refreshListenable listens to this to trigger redirects.
final pendingShareProvider =
    StateNotifierProvider<PendingShareNotifier, List<SharedFileModel>>(
  (ref) => PendingShareNotifier(),
);

class PendingShareNotifier extends StateNotifier<List<SharedFileModel>> {
  PendingShareNotifier() : super(const []);

  /// Store files — called from main.dart when intent arrives.
  void setFiles(List<SharedFileModel> files) {
    ShareIntentService.instance.setFiles(files);
    state = List.of(files);
  }

  /// Read files without clearing — safe for initState.
  List<SharedFileModel> readFiles() {
    return ShareIntentService.instance.readFiles();
  }

  /// Clear all state — called only on explicit session exit.
  void clear() {
    ShareIntentService.instance.clear();
    state = const [];
  }
}
