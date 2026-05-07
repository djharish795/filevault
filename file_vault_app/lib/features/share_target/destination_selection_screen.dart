import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
import 'package:file_vault_app/features/projects/project_model.dart';
import 'package:file_vault_app/features/projects/project_service.dart';
import 'package:file_vault_app/features/folders/folder_model.dart';
import 'package:file_vault_app/features/folders/folder_service.dart';
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

// ─── Destination Selection Screen ─────────────────────────────────────────────

class DestinationSelectionScreen extends ConsumerStatefulWidget {
  final List<SharedFileModel> sharedFiles;

  const DestinationSelectionScreen({
    super.key,
    required this.sharedFiles,
  });

  @override
  ConsumerState<DestinationSelectionScreen> createState() =>
      _DestinationSelectionScreenState();
}

class _DestinationSelectionScreenState
    extends ConsumerState<DestinationSelectionScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  
  // Navigation state
  String? _selectedProjectId;
  String? _selectedFolderId;
  final List<BreadcrumbEntry> _breadcrumbs = [];
  
  // Data
  List<ProjectModel> _projects = [];
  List<FolderModel> _folders = [];
  bool _isLoading = true;
  bool _isUploading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadProjects();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // ── Load projects ─────────────────────────────────────────────────────────────

  Future<void> _loadProjects() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final projects = await ProjectService().getProjects();
      if (mounted) {
        setState(() {
          _projects = projects;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load projects';
          _isLoading = false;
        });
      }
    }
  }

  // ── Load folders ──────────────────────────────────────────────────────────────

  Future<void> _loadFolders() async {
    if (_selectedProjectId == null) return;
    
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    
    try {
      final List<FolderModel> folders;
      if (_selectedFolderId == null) {
        folders = await FolderService().getRootFolders(_selectedProjectId!);
      } else {
        folders = await FolderService().getChildFolders(_selectedFolderId!);
      }
      
      if (mounted) {
        setState(() {
          _folders = folders;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load folders';
          _isLoading = false;
        });
      }
    }
  }

  // ── Navigate into project ─────────────────────────────────────────────────────

  void _selectProject(ProjectModel project) {
    setState(() {
      _selectedProjectId = project.id;
      _selectedFolderId = null;
      _breadcrumbs.clear();
      _breadcrumbs.add(BreadcrumbEntry(id: project.id, name: project.name));
    });
    _loadFolders();
  }

  // ── Navigate into folder ──────────────────────────────────────────────────────

  void _selectFolder(FolderModel folder) {
    setState(() {
      _selectedFolderId = folder.id;
      _breadcrumbs.add(BreadcrumbEntry(id: folder.id, name: folder.name));
    });
    _loadFolders();
  }

  // ── Navigate back ─────────────────────────────────────────────────────────────

  void _navigateBack() {
    if (_breadcrumbs.length <= 1) {
      // Back to project list
      setState(() {
        _selectedProjectId = null;
        _selectedFolderId = null;
        _breadcrumbs.clear();
        _folders.clear();
      });
    } else {
      // Back to parent folder
      setState(() {
        _breadcrumbs.removeLast();
        if (_breadcrumbs.length == 1) {
          _selectedFolderId = null;
        } else {
          _selectedFolderId = _breadcrumbs[_breadcrumbs.length - 1].id;
        }
      });
      _loadFolders();
    }
  }

  // ── Navigate to breadcrumb ────────────────────────────────────────────────────

  void _navigateToBreadcrumb(int index) {
    if (index == 0) {
      // Back to project root
      setState(() {
        _selectedFolderId = null;
        _breadcrumbs.removeRange(1, _breadcrumbs.length);
      });
      _loadFolders();
    } else {
      // Navigate to specific folder
      setState(() {
        _selectedFolderId = _breadcrumbs[index].id;
        _breadcrumbs.removeRange(index + 1, _breadcrumbs.length);
      });
      _loadFolders();
    }
  }

  // ── Upload files ──────────────────────────────────────────────────────────────

  Future<void> _uploadFiles() async {
    if (_selectedProjectId == null) return;
    
    setState(() => _isUploading = true);
    
    int successCount = 0;
    int failCount = 0;
    
    for (final sharedFile in widget.sharedFiles) {
      try {
        await FolderService().uploadFile(
          projectId: _selectedProjectId!,
          filePath: sharedFile.path,
          fileName: sharedFile.name,
          mimeType: sharedFile.mimeType,
          folderId: _selectedFolderId,
        );
        successCount++;
      } catch (e) {
        failCount++;
      }
    }
    
    if (mounted) {
      setState(() => _isUploading = false);
      
      if (failCount == 0) {
        _showToast('${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully');
        context.go('/home');
      } else {
        _showToast(
          '$successCount uploaded, $failCount failed',
          isError: true,
        );
      }
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────

  void _showToast(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(fontWeight: FontWeight.w500)),
      backgroundColor:
          isError ? Colors.red.shade700 : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(16),
    ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBackground,
      appBar: AppBar(
        backgroundColor: _kBackground,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: _kTextDark, size: 20),
          onPressed: _selectedProjectId == null ? () => context.pop() : _navigateBack,
        ),
        title: const Text(
          'Select destination',
          style: TextStyle(
              color: _kTextDark, fontWeight: FontWeight.w700, fontSize: 17),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: _kTextDark, size: 22),
            onPressed: () {
              // TODO: Implement search
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // ── File preview section ──────────────────────────────────────
          _FilePreviewSection(files: widget.sharedFiles),
          
          // ── Breadcrumb ────────────────────────────────────────────────
          if (_breadcrumbs.isNotEmpty) _BreadcrumbBar(
            breadcrumbs: _breadcrumbs,
            onTap: _navigateToBreadcrumb,
          ),
          
          // ── Tabs (only when project selected) ─────────────────────────
          if (_selectedProjectId != null)
            Container(
              decoration: const BoxDecoration(
                color: _kBackground,
                border: Border(bottom: BorderSide(color: _kCardBorder)),
              ),
              child: TabBar(
                controller: _tabController,
                labelColor: _kPrimary,
                unselectedLabelColor: _kTextGrey,
                indicatorColor: _kPrimary,
                indicatorWeight: 2.5,
                labelStyle: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13),
                unselectedLabelStyle: const TextStyle(
                    fontWeight: FontWeight.w500, fontSize: 13),
                tabs: const [
                  Tab(text: 'My Projects'),
                  Tab(text: 'Shared With Me'),
                ],
              ),
            ),
          
          // ── Content ───────────────────────────────────────────────────
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: _kPrimary))
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline,
                                color: _kTextGrey, size: 48),
                            const SizedBox(height: 12),
                            Text(_errorMessage!,
                                style: const TextStyle(
                                    color: _kTextMid, fontSize: 14)),
                            const SizedBox(height: 16),
                            OutlinedButton(
                              onPressed: _selectedProjectId == null
                                  ? _loadProjects
                                  : _loadFolders,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _selectedProjectId == null
                        ? _ProjectList(
                            projects: _projects,
                            onSelect: _selectProject,
                          )
                        : _FolderList(
                            folders: _folders,
                            onSelect: _selectFolder,
                          ),
          ),
        ],
      ),
      bottomNavigationBar: _UploadFooter(
        isEnabled: _selectedProjectId != null,
        isUploading: _isUploading,
        fileCount: widget.sharedFiles.length,
        onCancel: () => context.pop(),
        onUpload: _uploadFiles,
      ),
    );
  }
}

// ─── File Preview Section ─────────────────────────────────────────────────────

class _FilePreviewSection extends StatelessWidget {
  final List<SharedFileModel> files;
  const _FilePreviewSection({required this.files});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: _kSurface,
        border: Border(bottom: BorderSide(color: _kCardBorder)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${files.length} file${files.length > 1 ? 's' : ''} to upload',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: _kTextGrey,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 60,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: files.length,
              itemBuilder: (context, i) {
                final file = files[i];
                return Container(
                  width: 60,
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    color: _kBackground,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _kCardBorder),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _getFileIcon(file.mimeType),
                        color: _kPrimary,
                        size: 24,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        file.extension.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: _kTextGrey,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  IconData _getFileIcon(String mimeType) {
    if (mimeType.contains('pdf')) return Icons.picture_as_pdf_rounded;
    if (mimeType.contains('image')) return Icons.image_rounded;
    if (mimeType.contains('video')) return Icons.videocam_rounded;
    if (mimeType.contains('word')) return Icons.description_rounded;
    if (mimeType.contains('excel') || mimeType.contains('sheet')) {
      return Icons.table_chart_rounded;
    }
    if (mimeType.contains('zip')) return Icons.folder_zip_rounded;
    return Icons.insert_drive_file_rounded;
  }
}

// ─── Breadcrumb Bar ───────────────────────────────────────────────────────────

class _BreadcrumbBar extends StatelessWidget {
  final List<BreadcrumbEntry> breadcrumbs;
  final void Function(int) onTap;
  
  const _BreadcrumbBar({
    required this.breadcrumbs,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: _kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            const Icon(Icons.home_outlined, size: 14, color: _kTextGrey),
            for (int i = 0; i < breadcrumbs.length; i++) ...[
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4),
                child: Icon(Icons.chevron_right, size: 14, color: _kTextGrey),
              ),
              GestureDetector(
                onTap: () => onTap(i),
                child: Text(
                  breadcrumbs[i].name,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: i == breadcrumbs.length - 1
                        ? FontWeight.w700
                        : FontWeight.w400,
                    color: i == breadcrumbs.length - 1 ? _kPrimary : _kTextGrey,
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

// ─── Project List ─────────────────────────────────────────────────────────────

class _ProjectList extends StatelessWidget {
  final List<ProjectModel> projects;
  final void Function(ProjectModel) onSelect;
  
  const _ProjectList({
    required this.projects,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    if (projects.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.folder_open_rounded, color: _kTextGrey, size: 48),
            SizedBox(height: 12),
            Text('No projects available',
                style: TextStyle(color: _kTextMid, fontSize: 14)),
          ],
        ),
      );
    }
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: projects.length,
      itemBuilder: (context, i) {
        final project = projects[i];
        return _ProjectCard(project: project, onTap: () => onSelect(project));
      },
    );
  }
}

// ─── Project Card ─────────────────────────────────────────────────────────────

class _ProjectCard extends StatelessWidget {
  final ProjectModel project;
  final VoidCallback onTap;
  
  const _ProjectCard({required this.project, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _kBackground,
          border: Border.all(color: _kCardBorder),
          borderRadius: BorderRadius.circular(_kCardRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(6),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.folder_rounded,
                  color: _kPrimary, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    project.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _kTextDark,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Case #${project.caseNumber}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: _kTextGrey,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: _kTextGrey, size: 24),
          ],
        ),
      ),
    );
  }
}

// ─── Folder List ──────────────────────────────────────────────────────────────

class _FolderList extends StatelessWidget {
  final List<FolderModel> folders;
  final void Function(FolderModel) onSelect;
  
  const _FolderList({
    required this.folders,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    if (folders.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.folder_open_rounded, color: _kTextGrey, size: 48),
            SizedBox(height: 12),
            Text('No subfolders',
                style: TextStyle(color: _kTextMid, fontSize: 14)),
            SizedBox(height: 6),
            Text('You can upload files here',
                style: TextStyle(color: _kTextGrey, fontSize: 12)),
          ],
        ),
      );
    }
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: folders.length,
      itemBuilder: (context, i) {
        final folder = folders[i];
        return _FolderCard(folder: folder, onTap: () => onSelect(folder));
      },
    );
  }
}

// ─── Folder Card ──────────────────────────────────────────────────────────────

class _FolderCard extends StatelessWidget {
  final FolderModel folder;
  final VoidCallback onTap;
  
  const _FolderCard({required this.folder, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: _kBackground,
          border: Border.all(color: _kCardBorder),
          borderRadius: BorderRadius.circular(_kCardRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(6),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.folder_rounded,
                  color: _kPrimary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                folder.name,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _kTextDark,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Icon(Icons.chevron_right, color: _kTextGrey, size: 20),
          ],
        ),
      ),
    );
  }
}

// ─── Upload Footer ────────────────────────────────────────────────────────────

class _UploadFooter extends StatelessWidget {
  final bool isEnabled;
  final bool isUploading;
  final int fileCount;
  final VoidCallback onCancel;
  final VoidCallback onUpload;
  
  const _UploadFooter({
    required this.isEnabled,
    required this.isUploading,
    required this.fileCount,
    required this.onCancel,
    required this.onUpload,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: _kBackground,
        border: Border(top: BorderSide(color: _kCardBorder)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 8,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: isUploading ? null : onCancel,
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
                onPressed: (isEnabled && !isUploading) ? onUpload : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kPrimary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: _kTextGrey,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: isUploading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : Text(
                        'Upload Here ($fileCount)',
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
