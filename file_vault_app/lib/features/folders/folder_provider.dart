import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_vault_app/features/files/file_model.dart';
import 'package:file_vault_app/features/folders/folder_model.dart';
import 'package:file_vault_app/features/folders/folder_service.dart';
import 'package:file_vault_app/features/folders/folder_state.dart';

/// Family provider — one notifier instance per (projectId, folderId?) pair.
/// folderId == null means we are at the project root level.
final folderViewProvider = NotifierProviderFamily<FolderViewNotifier,
    FolderViewState, FolderViewArgs>(FolderViewNotifier.new);

class FolderViewArgs {
  final String projectId;
  final String projectName;
  final String? folderId;
  final String? folderName;

  const FolderViewArgs({
    required this.projectId,
    required this.projectName,
    this.folderId,
    this.folderName,
  });

  @override
  bool operator ==(Object other) =>
      other is FolderViewArgs &&
      other.projectId == projectId &&
      other.folderId == folderId;

  @override
  int get hashCode => Object.hash(projectId, folderId);
}

class FolderViewNotifier
    extends FamilyNotifier<FolderViewState, FolderViewArgs> {
  final _service = FolderService();

  @override
  FolderViewState build(FolderViewArgs arg) {
    // Build initial breadcrumb.
    final crumbs = <BreadcrumbEntry>[
      BreadcrumbEntry(id: arg.projectId, name: arg.projectName),
      if (arg.folderId != null && arg.folderName != null)
        BreadcrumbEntry(id: arg.folderId!, name: arg.folderName!),
    ];
    return FolderViewState(breadcrumbs: crumbs);
  }

  // ── Load folders + files for current context ────────────────────────────────

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final folderId = arg.folderId;

      // Fetch subfolders.
      final List<FolderModel> subfolders;
      if (folderId == null) {
        subfolders = await _service.getRootFolders(arg.projectId);
      } else {
        subfolders = await _service.getChildFolders(folderId);
      }

      // Fetch all project files, then filter by current folderId.
      final allFiles = await _service.getFilesForProject(arg.projectId);
      final files = allFiles
          .where((f) => f.folderId == folderId)
          .toList();

      state = state.copyWith(
        subfolders: subfolders,
        files: files,
        isLoading: false,
      );
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: _mapError(e),
      );
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load folder contents.',
      );
    }
  }

  // ── Create subfolder ────────────────────────────────────────────────────────

  Future<String?> createSubfolder(String name) async {
    try {
      final folder = await _service.createFolder(
        name: name,
        projectId: arg.projectId,
        parentId: arg.folderId,
      );
      // Optimistic insert at top of subfolder list.
      state = state.copyWith(
        subfolders: [folder, ...state.subfolders],
      );
      return null;
    } on DioException catch (e) {
      return _mapError(e);
    } catch (_) {
      return 'Failed to create folder.';
    }
  }

  // ── Rename folder ───────────────────────────────────────────────────────────

  Future<String?> renameFolder(String folderId, String newName) async {
    try {
      await _service.renameFolder(folderId: folderId, name: newName);
      // Optimistic update
      final updatedFolders = state.subfolders.map<FolderModel>((f) {
        if (f.id == folderId) return f.copyWith(name: newName);
        return f;
      }).toList();
      state = state.copyWith(subfolders: updatedFolders);
      return null;
    } on DioException catch (e) {
      return _mapError(e);
    } catch (_) {
      return 'Failed to rename folder.';
    }
  }

  // ── Delete folder ───────────────────────────────────────────────────────────

  Future<String?> deleteFolder(String folderId) async {
    try {
      await _service.deleteFolder(folderId);
      // Optimistic update
      final updatedFolders = state.subfolders.where((f) => f.id != folderId).toList();
      state = state.copyWith(subfolders: updatedFolders);
      return null;
    } on DioException catch (e) {
      return _mapError(e);
    } catch (_) {
      return 'Failed to delete folder.';
    }
  }

  // ── File selection (multi-select) ───────────────────────────────────────────

  void enterSelectionMode() {
    state = state.copyWith(isSelectionMode: true, selectedFileIds: {});
  }

  void toggleFileSelection(String fileId) {
    final next = Set<String>.from(state.selectedFileIds);
    if (next.contains(fileId)) {
      next.remove(fileId);
    } else {
      next.add(fileId);
    }
    state = state.copyWith(selectedFileIds: next);
  }

  void clearSelection() {
    state = state.copyWith(isSelectionMode: false, selectedFileIds: {});
  }

  // ── Delete selected files ───────────────────────────────────────────────────

  Future<String?> deleteSelectedFiles() async {
    final ids = List<String>.from(state.selectedFileIds);
    // Optimistic removal.
    final previous = state.files;
    state = state.copyWith(
      files: state.files.where((f) => !ids.contains(f.id)).toList(),
      selectedFileIds: {},
    );
    try {
      for (final id in ids) {
        await _service.deleteFile(projectId: arg.projectId, fileId: id);
      }
      return null;
    } on DioException catch (e) {
      // Rollback.
      state = state.copyWith(files: previous);
      return _mapError(e);
    } catch (_) {
      state = state.copyWith(files: previous);
      return 'Failed to delete files.';
    }
  }

  // ── Share selected files with chosen users ──────────────────────────────────
  // Each (fileId, userId) pair is a separate API call.
  // Returns error string or null on full success.

  Future<String?> shareFiles({
    required List<String> fileIds,
    required List<String> userIds,
  }) async {
    int failed = 0;
    for (final fileId in fileIds) {
      for (final userId in userIds) {
        try {
          await _service.shareFile(
            projectId: arg.projectId,
            fileId: fileId,
            userId: userId,
          );
        } catch (_) {
          failed++;
        }
      }
    }
    if (failed > 0) return '$failed share operation(s) failed.';
    return null;
  }

  // ── Add newly uploaded file to local state ──────────────────────────────────

  void onFileUploaded(FileModel file) {
    state = state.copyWith(files: [...state.files, file]);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  String _mapError(DioException e) {
    final msg = e.response?.data?['error']?['message'] as String?;
    if (msg != null) return msg;
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach server. Check your network.';
    }
    return 'Something went wrong.';
  }
}
