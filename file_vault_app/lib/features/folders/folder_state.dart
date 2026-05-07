import 'package:file_vault_app/features/files/file_model.dart';
import 'package:file_vault_app/features/folders/folder_model.dart';

/// Immutable state for the folder view screen.
class FolderViewState {
  /// Subfolders of the current folder (or root folders of the project).
  final List<FolderModel> subfolders;

  /// All files visible to the user in the current folder.
  final List<FileModel> files;

  /// IDs of files currently selected (multi-select mode).
  final Set<String> selectedFileIds;

  /// Breadcrumb trail: project name → folder → subfolder …
  final List<BreadcrumbEntry> breadcrumbs;

  final bool isLoading;
  final String? errorMessage;
  
  /// Whether selection mode is active (independent of whether files are selected)
  final bool isSelectionMode;

  const FolderViewState({
    this.subfolders = const [],
    this.files = const [],
    this.selectedFileIds = const {},
    this.breadcrumbs = const [],
    this.isLoading = false,
    this.errorMessage,
    this.isSelectionMode = false,
  });

  FolderViewState copyWith({
    List<FolderModel>? subfolders,
    List<FileModel>? files,
    Set<String>? selectedFileIds,
    List<BreadcrumbEntry>? breadcrumbs,
    bool? isLoading,
    String? errorMessage,
    bool? isSelectionMode,
    bool clearError = false,
  }) {
    return FolderViewState(
      subfolders: subfolders ?? this.subfolders,
      files: files ?? this.files,
      selectedFileIds: selectedFileIds ?? this.selectedFileIds,
      breadcrumbs: breadcrumbs ?? this.breadcrumbs,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      isSelectionMode: isSelectionMode ?? this.isSelectionMode,
    );
  }
}
