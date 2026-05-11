import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
import 'package:file_vault_app/features/folders/folder_model.dart';
import 'package:file_vault_app/features/folders/folder_service.dart';
import 'package:file_vault_app/features/projects/project_model.dart';
import 'package:file_vault_app/features/projects/project_service.dart';
import 'package:file_vault_app/features/share_target/share_intent_service.dart';
import 'package:file_vault_app/features/share_target/shared_file_model.dart';

// ─── Design tokens ────────────────────────────────────────────────────────────

const _kPrimary      = Color(0xFFE65C2F);
const _kPrimaryLight = Color(0xFFFFF0EB);
const _kBackground   = Color(0xFFFFFFFF);
const _kSurface      = Color(0xFFF8F8F8);
const _kCardBorder   = Color(0xFFEEEEEE);
const _kTextDark     = Color(0xFF1A1A1A);
const _kTextMid      = Color(0xFF555555);
const _kTextGrey     = Color(0xFF999999);
const _kCardRadius   = 12.0;

// ─── ShareSessionScreen ───────────────────────────────────────────────────────
// Completely isolated from the normal dashboard.
// Entered ONLY via context.go('/share') when Android share intent fires.
// Exited ONLY via _exitShareSession() which clears all state and goes to dashboard.

class ShareSessionScreen extends ConsumerStatefulWidget {
  const ShareSessionScreen({super.key});

  @override
  ConsumerState<ShareSessionScreen> createState() => _ShareSessionScreenState();
}

class _ShareSessionScreenState extends ConsumerState<ShareSessionScreen> {

  // ── Share session state ───────────────────────────────────────────────────────
  late List<SharedFileModel> _sharedFiles;

  // ── Navigation state ──────────────────────────────────────────────────────────
  String? _selectedProjectId;
  String? _selectedFolderId;
  final List<_Crumb> _breadcrumbs = [];

  // ── Data ──────────────────────────────────────────────────────────────────────
  List<ProjectModel> _allProjects = [];
  List<ProjectModel> _filteredProjects = [];
  List<FolderModel> _allFolders = [];
  List<FolderModel> _filteredFolders = [];

  // ── UI state ──────────────────────────────────────────────────────────────────
  bool _isLoading = true;
  bool _isUploading = false;
  bool _uploadDone = false;
  String? _errorMessage;
  final _searchCtrl = TextEditingController();
  bool _searchVisible = false;

  @override
  void initState() {
    super.initState();
    // READ files without clearing — safe across rebuilds.
    // Files are only cleared on explicit exit (_exitShareSession).
    _sharedFiles = ref.read(pendingShareProvider.notifier).readFiles();
    debugPrint('[ShareSession] initState: ${_sharedFiles.length} file(s)');
    _searchCtrl.addListener(_onSearch);
    _loadProjects();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  // ── Exit share session — clear everything, go to dashboard ───────────────────

  void _exitShareSession() {
    debugPrint('[ShareSession] exit — clearing share state');
    ref.read(pendingShareProvider.notifier).clear();
    final isAdmin = ref.read(authProvider).user?.isMasterAdmin ?? false;
    context.go(isAdmin ? '/dashboard' : '/user-home');
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  void _onSearch() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      if (_selectedProjectId == null) {
        _filteredProjects = q.isEmpty
            ? _allProjects
            : _allProjects.where((p) =>
                p.name.toLowerCase().contains(q) ||
                (p.caseNumber?.toLowerCase().contains(q) ?? false)).toList();
      } else {
        _filteredFolders = q.isEmpty
            ? _allFolders
            : _allFolders.where((f) =>
                f.name.toLowerCase().contains(q)).toList();
      }
    });
  }

  void _toggleSearch() {
    setState(() {
      _searchVisible = !_searchVisible;
      if (!_searchVisible) {
        _searchCtrl.clear();
        _filteredProjects = _allProjects;
        _filteredFolders = _allFolders;
      }
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────────

  Future<void> _loadProjects() async {
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final projects = await ProjectService().getProjects();
      if (mounted) setState(() {
        _allProjects = projects;
        _filteredProjects = projects;
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _errorMessage = 'Failed to load projects. Check your connection.';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadFolders() async {
    if (_selectedProjectId == null) return;
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final folders = _selectedFolderId == null
          ? await FolderService().getRootFolders(_selectedProjectId!)
          : await FolderService().getChildFolders(_selectedFolderId!);
      if (mounted) setState(() {
        _allFolders = folders;
        _filteredFolders = folders;
        _isLoading = false;
        _searchCtrl.clear();
      });
    } catch (_) {
      if (mounted) setState(() {
        _errorMessage = 'Failed to load folders.';
        _isLoading = false;
      });
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  void _selectProject(ProjectModel project) {
    setState(() {
      _selectedProjectId = project.id;
      _selectedFolderId = null;
      _breadcrumbs.clear();
      _breadcrumbs.add(_Crumb(id: project.id, name: project.name));
      _searchVisible = false;
      _searchCtrl.clear();
    });
    _loadFolders();
  }

  void _openFolder(FolderModel folder) {
    setState(() {
      _selectedFolderId = folder.id;
      _breadcrumbs.add(_Crumb(id: folder.id, name: folder.name));
      _searchVisible = false;
      _searchCtrl.clear();
    });
    _loadFolders();
  }

  void _navigateBack() {
    if (_selectedProjectId == null) {
      _exitShareSession();
      return;
    }
    if (_breadcrumbs.length <= 1) {
      setState(() {
        _selectedProjectId = null;
        _selectedFolderId = null;
        _breadcrumbs.clear();
        _allFolders = [];
        _filteredFolders = [];
        _searchVisible = false;
        _searchCtrl.clear();
      });
    } else {
      setState(() {
        _breadcrumbs.removeLast();
        _selectedFolderId = _breadcrumbs.length == 1
            ? null
            : _breadcrumbs.last.id;
        _searchVisible = false;
        _searchCtrl.clear();
      });
      _loadFolders();
    }
  }

  void _navigateToBreadcrumb(int index) {
    if (index == 0) {
      setState(() {
        _selectedFolderId = null;
        _breadcrumbs.removeRange(1, _breadcrumbs.length);
        _searchCtrl.clear();
      });
      _loadFolders();
    } else {
      setState(() {
        _selectedFolderId = _breadcrumbs[index].id;
        _breadcrumbs.removeRange(index + 1, _breadcrumbs.length);
        _searchCtrl.clear();
      });
      _loadFolders();
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  Future<void> _upload() async {
    if (_selectedProjectId == null) return;
    debugPrint('[ShareSession] upload start — ${_sharedFiles.length} file(s) → project=$_selectedProjectId folder=$_selectedFolderId');
    setState(() => _isUploading = true);

    final List<String> failed = [];

    for (final f in _sharedFiles) {
      try {
        debugPrint('[ShareSession] uploading: ${f.name} (${f.mimeType})');
        await FolderService().uploadFile(
          projectId: _selectedProjectId!,
          filePath: f.path,
          fileName: f.name,
          mimeType: f.mimeType,
          folderId: _selectedFolderId,
        );
        debugPrint('[ShareSession] upload success: ${f.name}');
      } catch (e) {
        debugPrint('[ShareSession] upload FAILED for ${f.name}: $e');
        failed.add(f.name);
      }
    }

    if (!mounted) return;
    setState(() { _isUploading = false; _uploadDone = failed.isEmpty; });

    if (failed.length == _sharedFiles.length) {
      _showToast('Upload failed. Check your connection and try again.', isError: true);
    } else {
      if (failed.isNotEmpty) {
        _showToast('${failed.length} file(s) failed to upload.', isError: true);
      }
      debugPrint('[ShareSession] upload complete — exiting share session');
      await Future.delayed(const Duration(milliseconds: 1500));
      if (mounted) _exitShareSession();
    }
  }

  void _showToast(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(fontWeight: FontWeight.w500)),
      backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(16),
    ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // If provider was cleared externally (e.g. logout), re-read to stay in sync.
    // But never exit just because of a rebuild — only exit on explicit action.
    final providerFiles = ref.watch(pendingShareProvider);
    if (providerFiles.isNotEmpty && _sharedFiles.isEmpty) {
      _sharedFiles = providerFiles;
    }

    // Only exit if provider is empty AND we have no local copy either.
    if (_sharedFiles.isEmpty && providerFiles.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _exitShareSession();
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: _kPrimary)),
      );
    }

    // Success state
    if (_uploadDone) {
      return Scaffold(
        backgroundColor: _kBackground,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.check_rounded,
                    color: Color(0xFF2E7D32), size: 44),
              ),
              const SizedBox(height: 20),
              const Text('File shared successfully',
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700,
                      color: _kTextDark)),
              const SizedBox(height: 8),
              const Text('Returning to your workspace…',
                  style: TextStyle(fontSize: 13, color: _kTextGrey)),
            ],
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _navigateBack();
      },
      child: Scaffold(
        backgroundColor: _kBackground,
        appBar: _buildAppBar(),
        body: Column(
          children: [
            // ── File preview strip ────────────────────────────────────
            _FileStrip(files: _sharedFiles),

            // ── Breadcrumb ────────────────────────────────────────────
            if (_breadcrumbs.isNotEmpty)
              _BreadcrumbBar(
                crumbs: _breadcrumbs,
                onTap: _navigateToBreadcrumb,
              ),

            // ── Content ───────────────────────────────────────────────
            Expanded(child: _buildContent()),
          ],
        ),
        bottomNavigationBar: _buildFooter(),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: _kBackground,
      elevation: 0,
      scrolledUnderElevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.close, color: _kTextDark, size: 22),
        tooltip: 'Cancel',
        onPressed: _exitShareSession,
      ),
      title: _searchVisible
          ? TextField(
              controller: _searchCtrl,
              autofocus: true,
              style: const TextStyle(fontSize: 15, color: _kTextDark),
              decoration: InputDecoration(
                hintText: _selectedProjectId == null
                    ? 'Search projects…'
                    : 'Search folders…',
                hintStyle: const TextStyle(color: _kTextGrey),
                border: InputBorder.none,
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Select destination',
                    style: TextStyle(
                        color: _kTextDark,
                        fontWeight: FontWeight.w700,
                        fontSize: 16)),
                Text(
                  _selectedProjectId == null
                      ? 'Choose a project'
                      : _selectedFolderId == null
                          ? 'Choose a folder or upload here'
                          : 'Upload here or go deeper',
                  style: const TextStyle(fontSize: 11, color: _kTextGrey),
                ),
              ],
            ),
      actions: [
        IconButton(
          icon: Icon(
            _searchVisible ? Icons.close : Icons.search,
            color: _kTextDark, size: 22,
          ),
          onPressed: _toggleSearch,
        ),
      ],
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: _kPrimary));
    }
    if (_errorMessage != null) {
      return _ErrorState(
        message: _errorMessage!,
        onRetry: _selectedProjectId == null ? _loadProjects : _loadFolders,
      );
    }
    if (_selectedProjectId == null) {
      return _ProjectList(
        projects: _filteredProjects,
        onSelect: _selectProject,
      );
    }
    return _FolderList(
      folders: _filteredFolders,
      onOpen: _openFolder,
    );
  }

  Widget _buildFooter() {
    final canUpload = _selectedProjectId != null && !_isUploading;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      decoration: const BoxDecoration(
        color: _kBackground,
        border: Border(top: BorderSide(color: _kCardBorder)),
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, -2))],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _isUploading ? null : _exitShareSession,
                style: OutlinedButton.styleFrom(
                  foregroundColor: _kTextMid,
                  side: const BorderSide(color: _kCardBorder),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Cancel',
                    style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: canUpload ? _upload : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kPrimary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFCCCCCC),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _isUploading
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(
                        canUpload
                            ? 'Share File (${_sharedFiles.length})'
                            : 'Select a project first',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Internal breadcrumb model ────────────────────────────────────────────────

class _Crumb {
  final String id;
  final String name;
  const _Crumb({required this.id, required this.name});
}

// ─── File strip ───────────────────────────────────────────────────────────────

class _FileStrip extends StatelessWidget {
  final List<SharedFileModel> files;
  const _FileStrip({required this.files});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: _kSurface,
        border: Border(bottom: BorderSide(color: _kCardBorder)),
      ),
      child: Row(
        children: [
          // File icon(s)
          ...files.take(3).map((f) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: _kBackground,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _kCardBorder),
                  ),
                  child: Icon(_iconFor(f.mimeType), color: _kPrimary, size: 22),
                ),
              )),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  files.length == 1 ? files.first.name : '${files.length} files',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700,
                      color: _kTextDark),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  files.length == 1
                      ? files.first.formattedSize
                      : 'Select where to save',
                  style: const TextStyle(fontSize: 11, color: _kTextGrey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconFor(String mime) {
    if (mime.contains('pdf')) return Icons.picture_as_pdf_rounded;
    if (mime.contains('image')) return Icons.image_rounded;
    if (mime.contains('video')) return Icons.videocam_rounded;
    if (mime.contains('word')) return Icons.description_rounded;
    if (mime.contains('excel') || mime.contains('sheet')) return Icons.table_chart_rounded;
    if (mime.contains('zip')) return Icons.folder_zip_rounded;
    return Icons.insert_drive_file_rounded;
  }
}

// ─── Breadcrumb bar ───────────────────────────────────────────────────────────

class _BreadcrumbBar extends StatelessWidget {
  final List<_Crumb> crumbs;
  final void Function(int) onTap;
  const _BreadcrumbBar({required this.crumbs, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: _kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            const Icon(Icons.home_outlined, size: 13, color: _kTextGrey),
            for (int i = 0; i < crumbs.length; i++) ...[
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 3),
                child: Icon(Icons.chevron_right, size: 13, color: _kTextGrey),
              ),
              GestureDetector(
                onTap: () => onTap(i),
                child: Text(
                  crumbs[i].name,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: i == crumbs.length - 1
                        ? FontWeight.w700
                        : FontWeight.w400,
                    color: i == crumbs.length - 1 ? _kPrimary : _kTextGrey,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Project list ─────────────────────────────────────────────────────────────

class _ProjectList extends StatelessWidget {
  final List<ProjectModel> projects;
  final void Function(ProjectModel) onSelect;
  const _ProjectList({required this.projects, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    if (projects.isEmpty) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.folder_open_rounded, color: _kTextGrey, size: 48),
          SizedBox(height: 12),
          Text('No projects available',
              style: TextStyle(color: _kTextMid, fontSize: 14)),
        ]),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: projects.length,
      itemBuilder: (_, i) {
        final p = projects[i];
        return GestureDetector(
          onTap: () => onSelect(p),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _kBackground,
              border: Border.all(color: _kCardBorder),
              borderRadius: BorderRadius.circular(_kCardRadius),
              boxShadow: [BoxShadow(color: Colors.black.withAlpha(5), blurRadius: 4, offset: const Offset(0, 2))],
            ),
            child: Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: _kPrimaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.folder_rounded, color: _kPrimary, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.name,
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w700,
                              color: _kTextDark),
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text('Case ID: ${p.caseNumber?.isNotEmpty == true ? p.caseNumber : "N/A"}',
                          style: const TextStyle(fontSize: 11, color: _kTextGrey)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: _kTextGrey, size: 20),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── Folder list ──────────────────────────────────────────────────────────────

class _FolderList extends StatelessWidget {
  final List<FolderModel> folders;
  final void Function(FolderModel) onOpen;
  const _FolderList({required this.folders, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    if (folders.isEmpty) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.folder_open_rounded, color: _kTextGrey, size: 48),
          SizedBox(height: 12),
          Text('No subfolders here',
              style: TextStyle(color: _kTextMid, fontSize: 14)),
          SizedBox(height: 4),
          Text('Tap "Share File" to upload here',
              style: TextStyle(color: _kTextGrey, fontSize: 12)),
        ]),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: folders.length,
      itemBuilder: (_, i) {
        final f = folders[i];
        return GestureDetector(
          onTap: () => onOpen(f),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: _kBackground,
              border: Border.all(color: _kCardBorder),
              borderRadius: BorderRadius.circular(_kCardRadius),
              boxShadow: [BoxShadow(color: Colors.black.withAlpha(5), blurRadius: 4, offset: const Offset(0, 2))],
            ),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: _kPrimaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.folder_rounded, color: _kPrimary, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(f.name,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600,
                          color: _kTextDark),
                      overflow: TextOverflow.ellipsis),
                ),
                const Icon(Icons.chevron_right, color: _kTextGrey, size: 20),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── Error state ──────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, color: _kTextGrey, size: 48),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: _kTextMid, fontSize: 14)),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                foregroundColor: _kPrimary,
                side: const BorderSide(color: _kPrimary),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
