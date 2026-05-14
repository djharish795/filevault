import 'dart:io';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:open_file/open_file.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
import 'package:file_vault_app/features/auth/edit_profile_screen.dart';
import 'package:file_vault_app/features/chat/chat_model.dart';
import 'package:file_vault_app/features/chat/chat_provider.dart';
import 'package:file_vault_app/features/files/file_model.dart';
import 'package:file_vault_app/features/folders/folder_model.dart';
import 'package:file_vault_app/features/folders/folder_provider.dart';
import 'package:file_vault_app/features/folders/folder_service.dart';
import 'package:file_vault_app/features/folders/folder_state.dart';

// --- Design tokens ------------------------------------------------------------

const _kPrimary      = Color(0xFFE65C2F);
const _kPrimaryLight = Color(0xFFFFF0EB);
const _kBackground   = Color(0xFFFFFFFF);
const _kSurface      = Color(0xFFF8F8F8);
const _kCardBorder   = Color(0xFFEEEEEE);
const _kOrangeBorder = Color(0xFFF2C1B3);
const _kTextDark     = Color(0xFF1A1A1A);
const _kTextMid      = Color(0xFF555555);
const _kTextGrey     = Color(0xFF999999);
const _kCardRadius   = 12.0;

const _kAvatarColors = [
  Color(0xFF5B8DEF), Color(0xFF3DAB7B), Color(0xFFE65C2F),
  Color(0xFF9B59B6), Color(0xFFE67E22), Color(0xFF1ABC9C),
];
Color _avatarColor(String s) =>
    _kAvatarColors[s.codeUnitAt(0) % _kAvatarColors.length];

// --- FolderScreen -------------------------------------------------------------

class FolderScreen extends ConsumerStatefulWidget {
  final String projectId;
  final String projectName;
  final String? folderId;
  final String? folderName;

  const FolderScreen({
    super.key,
    required this.projectId,
    required this.projectName,
    this.folderId,
    this.folderName,
  });

  @override
  ConsumerState<FolderScreen> createState() => _FolderScreenState();
}

class _FolderScreenState extends ConsumerState<FolderScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late final FolderViewArgs _args;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _args = FolderViewArgs(
      projectId: widget.projectId,
      projectName: widget.projectName,
      folderId: widget.folderId,
      folderName: widget.folderName,
    );
    Future.microtask(
        () => ref.read(folderViewProvider(_args).notifier).load());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // -- Toast -----------------------------------------------------------------

  void _toast(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(fontWeight: FontWeight.w500)),
      backgroundColor:
          isError ? Colors.red.shade700 : const Color(0xFF2E7D32),
      behavior: SnackBarBehavior.floating,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(16),
    ));
  }

  // -- Upload ----------------------------------------------------------------

  Future<void> _uploadFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'pdf', 'doc', 'docx', 'xls', 'xlsx',
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv'
      ],
    );
    if (result == null || result.files.isEmpty) return;
    final picked = result.files.first;
    if (picked.path == null) return;

    const mimeMap = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
      'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
      'txt': 'text/plain', 'csv': 'text/csv',
    };
    final ext  = picked.extension?.toLowerCase() ?? '';
    final mime = mimeMap[ext] ?? 'application/octet-stream';

    _toast('Uploading ${picked.name}�');
    try {
      final file = await FolderService().uploadFile(
        projectId: widget.projectId,
        filePath:  picked.path!,
        fileName:  picked.name,
        mimeType:  mime,
        folderId:  widget.folderId,
      );
      ref.read(folderViewProvider(_args).notifier).onFileUploaded(file);
      _toast('${file.name} uploaded successfully.');
    } catch (_) {
      _toast('Upload failed. Please try again.', isError: true);
    }
  }

  // -- Create subfolder ------------------------------------------------------

  void _showCreateFolderSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateFolderSheet(
        onConfirm: (name) async {
          final err = await ref
              .read(folderViewProvider(_args).notifier)
              .createSubfolder(name);
          if (err != null) {
            _toast(err, isError: true);
          } else {
            _toast('Folder "$name" created.');
          }
        },
      ),
    );
  }

  // -- Delete selected -------------------------------------------------------

  Future<void> _deleteSelected() async {
    final count =
        ref.read(folderViewProvider(_args)).selectedFileIds.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Files',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: Text(
          'Delete $count file${count > 1 ? 's' : ''}? This cannot be undone.',
          style: const TextStyle(color: _kTextMid, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel',
                style: TextStyle(color: _kTextMid)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final err = await ref
        .read(folderViewProvider(_args).notifier)
        .deleteSelectedFiles();
    if (err != null) {
      _toast(err, isError: true);
    } else {
      _toast('Files deleted.');
    }
  }

  // -- Share selected --------------------------------------------------------

  void _shareSelected() {
    final selectedIds = List<String>.from(
        ref.read(folderViewProvider(_args)).selectedFileIds);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ShareModal(
        projectId: widget.projectId,
        fileIds: selectedIds,
        onShare: (userIds) async {
          final err = await ref
              .read(folderViewProvider(_args).notifier)
              .shareFiles(fileIds: selectedIds, userIds: userIds);
          ref.read(folderViewProvider(_args).notifier).clearSelection();
          if (err != null) {
            _toast(err, isError: true);
          } else {
            _toast('Files shared successfully.');
          }
        },
      ),
    );
  }

  // -- Share folder access ---------------------------------------------------

  void _showFolderShareModal() {
    if (widget.folderId == null) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FolderAccessModal(
        projectId: widget.projectId,
        folderId: widget.folderId!,
        folderName: widget.folderName ?? widget.projectName,
        onDone: () => _toast('Folder access updated.'),
      ),
    );
  }

  void _showProjectShareModal() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProjectAccessModal(
        projectId: widget.projectId,
        projectName: widget.projectName,
        onDone: () => _toast('Project access updated.'),
      ),
    );
  }

  // -- Logout ----------------------------------------------------------------

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Logout',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: const Text(
          'Are you sure you want to logout?',
          style: TextStyle(color: _kTextMid, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: _kTextMid)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: _kPrimary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(authProvider.notifier).logout();
      if (mounted) context.go('/login');
    }
  }

  // -- Build -----------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final state    = ref.watch(folderViewProvider(_args));
    final authUser = ref.watch(authProvider).user;
    final isAdmin  = authUser?.isMasterAdmin ?? false;
    final isSel    = state.isSelectionMode;

    return Scaffold(
      backgroundColor: _kBackground,
      appBar: isSel ? _selectionAppBar(state, isAdmin) : _normalAppBar(),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // -- Breadcrumb ---------------------------------------------
          _Breadcrumb(crumbs: state.breadcrumbs),

          // -- Action bar: Select Files + New Subfolder + Upload ------
          if (!isSel)
            _ActionBar(
              isAdmin: isAdmin,
              hasFiles: state.files.isNotEmpty,
              isSubfolder: widget.folderId != null,
              onSelectFiles: () => ref.read(folderViewProvider(_args).notifier).enterSelectionMode(),
              onNewFolder: _showCreateFolderSheet,
              onUpload: _uploadFile,
              onShareFolder: widget.folderId != null ? _showFolderShareModal : _showProjectShareModal,
            ),

          // -- Tab bar (only in subfolders) ---------------------------
          if (widget.folderId != null) _FolderTabBar(controller: _tabController),

          // -- Tab content --------------------------------------------
          Expanded(
            child: widget.folderId != null
                ? TabBarView(
                    controller: _tabController,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _FilesTab(
                        state: state,
                        args: _args,
                        isAdmin: isAdmin,
                        onFolderTap: (folder) => context.push(
                          '/project/${widget.projectId}/folder/${folder.id}',
                          extra: {
                            'projectName': widget.projectName,
                            'folderName': folder.name,
                          },
                        ),
                      ),
                      _ChatPlaceholder(folderId: widget.folderId!),
                    ],
                  )
                : _FilesTab(
                    state: state,
                    args: _args,
                    isAdmin: isAdmin,
                    onFolderTap: (folder) => context.push(
                      '/project/${widget.projectId}/folder/${folder.id}',
                      extra: {
                        'projectName': widget.projectName,
                        'folderName': folder.name,
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  // -- App bars --------------------------------------------------------------

  PreferredSizeWidget _normalAppBar() {
    final authUser = ref.read(authProvider).user;
    final isAdmin  = authUser?.isMasterAdmin ?? false;

    return AppBar(
      backgroundColor: _kBackground,
      elevation: 0,
      scrolledUnderElevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded,
            color: _kTextDark, size: 20),
        onPressed: () => context.pop(),
      ),
      title: Text(
        widget.folderName ?? widget.projectName,
        style: const TextStyle(
            color: _kTextDark, fontWeight: FontWeight.w700, fontSize: 17),
      ),
      actions: [
        // Profile button (right corner)
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: PopupMenuButton<String>(
            offset: const Offset(0, 50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _avatarColor(authUser?.name ?? 'User'),
                    _avatarColor(authUser?.name ?? 'User').withValues(alpha: 0.8),
                  ],
                ),
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(15),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  (authUser?.name ?? '').isNotEmpty
                      ? authUser!.name[0].toUpperCase()
                      : 'U',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            onSelected: (value) {
              if (value == 'logout') {
                _handleLogout();
              } else if (value == 'profile') {
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const EditProfileScreen(),
                ));
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      authUser?.name ?? 'User',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _kTextDark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      authUser?.email ?? '',
                      style: const TextStyle(
                        fontSize: 12,
                        color: _kTextGrey,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: isAdmin ? _kPrimaryLight : _kSurface,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isAdmin ? 'Admin' : 'User',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: isAdmin ? _kPrimary : _kTextGrey,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    Icon(Icons.person_outline, size: 18, color: _kTextMid),
                    SizedBox(width: 12),
                    Text('Edit Profile', style: TextStyle(fontSize: 14)),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded, size: 18, color: Colors.red),
                    SizedBox(width: 12),
                    Text('Logout',
                        style: TextStyle(fontSize: 14, color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  PreferredSizeWidget _selectionAppBar(
      FolderViewState state, bool isAdmin) {
    return AppBar(
      backgroundColor: _kPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.close, color: Colors.white),
        onPressed: () =>
            ref.read(folderViewProvider(_args).notifier).clearSelection(),
      ),
      title: Text(
        '${state.selectedFileIds.length} selected',
        style: const TextStyle(
            color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
      ),
      actions: [
        if (state.selectedFileIds.isNotEmpty)
          TextButton.icon(
            onPressed: _shareSelected,
            icon: const Icon(Icons.share_outlined,
                color: Colors.white, size: 18),
            label: const Text('Share Access',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13)),
          ),
        if (state.selectedFileIds.isNotEmpty && (isAdmin || state.selectedFileIds.every((id) =>
              state.files.any((f) => f.id == id && f.owner == ref.read(authProvider).user?.name))))
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.white),
            tooltip: 'Delete',
            onPressed: _deleteSelected,
          ),
        const SizedBox(width: 4),
      ],
    );
  }
}

// --- Breadcrumb ---------------------------------------------------------------

class _Breadcrumb extends StatelessWidget {
  final List<BreadcrumbEntry> crumbs;
  const _Breadcrumb({required this.crumbs});

  @override
  Widget build(BuildContext context) {
    if (crumbs.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: _kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            const Icon(Icons.home_outlined, size: 14, color: _kTextGrey),
            for (int i = 0; i < crumbs.length; i++) ...[
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4),
                child: Icon(Icons.chevron_right, size: 14, color: _kTextGrey),
              ),
              Text(
                crumbs[i].name,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: i == crumbs.length - 1
                      ? FontWeight.w700
                      : FontWeight.w400,
                  color: i == crumbs.length - 1 ? _kPrimary : _kTextGrey,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// --- Action bar ---------------------------------------------------------------

class _ActionBar extends StatelessWidget {
  final bool isAdmin;
  final bool hasFiles;
  final bool isSubfolder;        // true when folderId != null
  final VoidCallback onSelectFiles;
  final VoidCallback onNewFolder;
  final VoidCallback onUpload;
  final VoidCallback? onShareFolder; // admin only, subfolder only

  const _ActionBar({
    required this.isAdmin,
    required this.hasFiles,
    required this.isSubfolder,
    required this.onSelectFiles,
    required this.onNewFolder,
    required this.onUpload,
    this.onShareFolder,
  });

  @override
  Widget build(BuildContext context) {
    // Buttons to show:
    // - Select Files (when files exist)
    // - New Folder (admin only)
    // - Share Folder Access (admin + inside subfolder)
    // - Upload File (always)
    // Layout: wrap into two rows if too many buttons to avoid overflow
    final List<Widget> buttons = [];

    if (hasFiles)
      buttons.add(_outlineBtn(
        icon: Icons.check_box_outlined,
        label: 'Select Files',
        onTap: onSelectFiles,
      ));

    if (isAdmin)
      buttons.add(_outlineBtn(
        icon: Icons.create_new_folder_outlined,
        label: 'New Folder',
        onTap: onNewFolder,
      ));

    if (isAdmin && onShareFolder != null)
      buttons.add(_outlineBtn(
        icon: Icons.group_add_outlined,
        label: 'Share Access',
        onTap: onShareFolder!,
      ));

    // Upload is always last and always shown
    final uploadBtn = Expanded(
      child: ElevatedButton.icon(
        onPressed: onUpload,
        icon: const Icon(Icons.upload_rounded, size: 16, color: Colors.white),
        label: const Text('Upload File',
            style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
        style: ElevatedButton.styleFrom(
          backgroundColor: _kPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.symmetric(vertical: 10),
        ),
      ),
    );

    // If 3 or more outline buttons, split into two rows
    if (buttons.length >= 3) {
      return Container(
        color: _kBackground,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(
          children: [
            Row(
              children: [
                for (int i = 0; i < buttons.length; i++) ...[
                  buttons[i],
                  if (i < buttons.length - 1) const SizedBox(width: 8),
                ],
              ],
            ),
            const SizedBox(height: 8),
            Row(children: [uploadBtn]),
          ],
        ),
      );
    }

    // Default: single row
    return Container(
      color: _kBackground,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          for (int i = 0; i < buttons.length; i++) ...[
            buttons[i],
            const SizedBox(width: 8),
          ],
          uploadBtn,
        ],
      ),
    );
  }

  Widget _outlineBtn({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 15, color: _kPrimary),
        label: Text(label,
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w600, color: _kPrimary)),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: _kOrangeBorder),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.symmetric(vertical: 10),
          backgroundColor: _kPrimaryLight,
        ),
      ),
    );
  }
}

// --- Tab bar ------------------------------------------------------------------

class _FolderTabBar extends StatelessWidget {
  final TabController controller;
  const _FolderTabBar({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        border: Border(bottom: BorderSide(color: _kCardBorder)),
      ),
      child: TabBar(
        controller: controller,
        labelColor: _kPrimary,
        unselectedLabelColor: _kTextGrey,
        indicatorColor: _kPrimary,
        indicatorWeight: 2.5,
        labelStyle: const TextStyle(
            fontWeight: FontWeight.w700, fontSize: 13),
        unselectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w500, fontSize: 13),
        tabs: const [
          Tab(text: 'Files'),
          Tab(text: 'Chat'),
        ],
      ),
    );
  }
}

// --- Files tab ----------------------------------------------------------------

class _FilesTab extends ConsumerWidget {
  final FolderViewState state;
  final FolderViewArgs args;
  final bool isAdmin;
  final void Function(FolderModel) onFolderTap;

  const _FilesTab({
    required this.state,
    required this.args,
    required this.isAdmin,
    required this.onFolderTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.isLoading) {
      return const Center(
          child: CircularProgressIndicator(color: _kPrimary));
    }

    if (state.errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined,
                  color: _kTextGrey, size: 48),
              const SizedBox(height: 12),
              Text(state.errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: _kTextMid, fontSize: 14)),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () =>
                    ref.read(folderViewProvider(args).notifier).load(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _kPrimary,
                  side: const BorderSide(color: _kOrangeBorder),
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

    if (state.subfolders.isEmpty && state.files.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.folder_open_rounded,
                  color: _kPrimary, size: 40),
            ),
            const SizedBox(height: 16),
            const Text('This folder is empty',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _kTextDark)),
            const SizedBox(height: 6),
            const Text('Upload a file or create a subfolder to get started.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: _kTextGrey)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: _kPrimary,
      onRefresh: () => ref.read(folderViewProvider(args).notifier).load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // -- Subfolders -------------------------------------------
          if (state.subfolders.isNotEmpty) ...[
            _SectionLabel(
                label: 'Folders',
                count: state.subfolders.length),
            const SizedBox(height: 8),
            ...state.subfolders.map(
              (f) => _FolderTile(
                folder: f,
                projectId: args.projectId,
                isAdmin: isAdmin,
                isRoot: args.folderId == null,
                args: args,
                onTap: () => onFolderTap(f),
                onShare: () {
                  showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => _FolderAccessModal(
                      projectId: args.projectId,
                      folderId: f.id,
                      folderName: f.name,
                      onDone: () {},
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
          ],

          // -- Files ------------------------------------------------
          if (state.files.isNotEmpty) ...[
            _SectionLabel(
                label: 'Files', count: state.files.length),
            const SizedBox(height: 8),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.95,
              ),
              itemCount: state.files.length,
              itemBuilder: (context, i) {
                final file = state.files[i];
                final isSel = state.selectedFileIds.contains(file.id);
                return _FileCard(
                  file: file,
                  isSelected: isSel,
                  isSelectionMode: state.isSelectionMode,
                  projectId: args.projectId,
                  args: args,
                  onTap: () {
                    if (state.isSelectionMode) {
                      ref
                          .read(folderViewProvider(args).notifier)
                          .toggleFileSelection(file.id);
                    }
                    // Normal tap (not selection mode) → open file inline
                    // Handled inside _FileCard.build via GestureDetector
                  },
                  onLongPress: () {
                    if (!state.isSelectionMode) {
                      ref.read(folderViewProvider(args).notifier).enterSelectionMode();
                    }
                    ref
                        .read(folderViewProvider(args).notifier)
                        .toggleFileSelection(file.id);
                  },
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

// --- Section label ------------------------------------------------------------

class _SectionLabel extends StatelessWidget {
  final String label;
  final int count;
  const _SectionLabel({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _kTextGrey,
                letterSpacing: 0.8)),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
          decoration: BoxDecoration(
            color: _kSurface,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text('$count',
              style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: _kTextGrey)),
        ),
      ],
    );
  }
}

// --- Folder tile --------------------------------------------------------------

class _FolderTile extends ConsumerWidget {
  final FolderModel folder;
  final String projectId;
  final bool isAdmin;
  final bool isRoot;
  final FolderViewArgs args;
  final VoidCallback onTap;
  final VoidCallback onShare;

  const _FolderTile({
    required this.folder,
    required this.projectId,
    required this.isAdmin,
    required this.isRoot,
    required this.args,
    required this.onTap,
    required this.onShare,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: _kBackground,
          border: Border.all(color: _kCardBorder),
          borderRadius: BorderRadius.circular(_kCardRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(8),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(folder.name,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _kTextDark),
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  const Text(
                    'Tap to open',
                    style: TextStyle(fontSize: 11, color: _kTextGrey),
                  ),
                ],
              ),
            ),
            if (isAdmin)
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, color: _kTextGrey, size: 20),
                onSelected: (val) {
                  if (val == 'share') {
                    onShare();
                  } else if (val == 'rename') {
                    _showRenameFolderDialog(context, ref, folder, args);
                  } else if (val == 'delete') {
                    _showDeleteFolderDialog(context, ref, folder, args);
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'share',
                    child: Text('Share Access', style: TextStyle(fontSize: 13)),
                  ),
                  const PopupMenuItem(
                    value: 'rename',
                    child: Text('Rename', style: TextStyle(fontSize: 13)),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete', style: TextStyle(fontSize: 13, color: Colors.red)),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

Future<void> _showRenameFolderDialog(BuildContext context, WidgetRef ref, FolderModel folder, FolderViewArgs args) async {
  final nameController = TextEditingController(text: folder.name);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Rename Folder', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _kTextDark)),
      content: TextField(
        controller: nameController,
        autofocus: true,
        decoration: const InputDecoration(
          labelText: 'New Folder Name',
          border: OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel', style: TextStyle(color: _kTextGrey)),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: ElevatedButton.styleFrom(backgroundColor: _kPrimary, foregroundColor: Colors.white),
          child: const Text('Rename'),
        ),
      ],
    ),
  );

  if (confirmed == true && nameController.text.trim().isNotEmpty) {
    final newName = nameController.text.trim();
    if (newName == folder.name) return;

    final err = await ref.read(folderViewProvider(args).notifier).renameFolder(folder.id, newName);
    if (!context.mounted) return;

    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: Colors.red));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Folder renamed')));
    }
  }
}

Future<void> _showDeleteFolderDialog(BuildContext context, WidgetRef ref, FolderModel folder, FolderViewArgs args) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Delete Folder', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _kTextDark)),
      content: const Text(
        'Are you sure you want to delete this folder?\n\n'
        'WARNING: This is a huge folder with potentially many files. Deleting it will remove all contents inside it permanently.',
        style: TextStyle(fontSize: 14, color: _kTextMid),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel', style: TextStyle(color: _kTextGrey)),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
          child: const Text('Delete'),
        ),
      ],
    ),
  );

  if (confirmed == true) {
    final err = await ref.read(folderViewProvider(args).notifier).deleteFolder(folder.id);
    if (!context.mounted) return;

    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: Colors.red));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Folder deleted')));
    }
  }
}

// --- File card ----------------------------------------------------------------

class _FileCard extends ConsumerWidget {
  final FileModel file;
  final bool isSelected;
  final bool isSelectionMode;
  final String projectId;
  final FolderViewArgs args;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const _FileCard({
    required this.file,
    required this.isSelected,
    required this.isSelectionMode,
    required this.projectId,
    required this.args,
    required this.onTap,
    required this.onLongPress,
  });

  IconData get _icon {
    switch (file.category) {
      case FileCategory.pdf:
        return Icons.picture_as_pdf_rounded;
      case FileCategory.image:
        return Icons.image_rounded;
      case FileCategory.spreadsheet:
        return Icons.table_chart_rounded;
      case FileCategory.document:
        return Icons.description_rounded;
      case FileCategory.generic:
        return Icons.insert_drive_file_rounded;
    }
  }

  Color get _iconColor {
    switch (file.category) {
      case FileCategory.pdf:
        return const Color(0xFFD32F2F);
      case FileCategory.image:
        return const Color(0xFF1976D2);
      case FileCategory.spreadsheet:
        return const Color(0xFF388E3C);
      case FileCategory.document:
        return const Color(0xFF303F9F);
      case FileCategory.generic:
        return _kTextGrey;
    }
  }

  Color get _iconBg {
    switch (file.category) {
      case FileCategory.pdf:
        return const Color(0xFFFFEBEE);
      case FileCategory.image:
        return const Color(0xFFE3F2FD);
      case FileCategory.spreadsheet:
        return const Color(0xFFE8F5E9);
      case FileCategory.document:
        return const Color(0xFFE8EAF6);
      case FileCategory.generic:
        return _kSurface;
    }
  }

  Future<void> _downloadFile(BuildContext context, WidgetRef ref, String projectId) async {
    try {
      // Show loading indicator
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const SizedBox(
                width: 16, height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Text('Opening ${file.name}�'),
            ],
          ),
          duration: const Duration(seconds: 10),
          backgroundColor: _kPrimary,
        ),
      );

      // Fetch file bytes from the /open endpoint (inline, not attachment)
      final response = await FolderService().downloadFile(
        projectId: projectId,
        fileId: file.id,
      );

      if (!context.mounted) return;
      ScaffoldMessenger.of(context).clearSnackBars();

      // Write bytes to a temp file and open with the system viewer
      final bytes = response.data as List<int>;
      final tempDir = await _getTempDir();
      final tempFile = File('${tempDir.path}/${file.name}');
      await tempFile.writeAsBytes(bytes);

      final result = await OpenFile.open(tempFile.path, type: file.mimeType);

      if (result.type != ResultType.done && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cannot open this file type: ${file.name}'),
            backgroundColor: Colors.orange.shade700,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
    } on DioException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).clearSnackBars();
      final msg = e.response?.statusCode == 404
          ? 'File no longer exists on server.'
          : e.response?.statusCode == 403
              ? 'You do not have access to this file.'
              : 'Failed to open file. Check your connection.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.all(16),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not open ${file.name}'),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.all(16),
        ),
      );
    }
  }

  Future<Directory> _getTempDir() async {
    final dir = Directory('/data/user/0/${_packageName()}/cache/vault_open');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  String _packageName() => 'com.filevault.file_vault_app';

  Future<void> _deleteFile(BuildContext context, WidgetRef ref, String projectId, FolderViewArgs args) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete File',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: Text(
          'Delete "${file.name}"? This cannot be undone.',
          style: const TextStyle(color: _kTextMid, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: _kTextMid)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await FolderService().deleteFile(projectId: projectId, fileId: file.id);
      if (context.mounted) {
        ref.read(folderViewProvider(args).notifier).load();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('File deleted successfully'),
            backgroundColor: Color(0xFF2E7D32),
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Delete failed: ${e.toString()}'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authUser = ref.watch(authProvider).user;
    final isAdmin = authUser?.isMasterAdmin ?? false;

    return GestureDetector(
      onTap: isSelectionMode
          ? onTap  // selection mode → toggle selection
          : () => _downloadFile(context, ref, projectId),  // normal mode → open file
      onLongPress: isSelectionMode ? null : onLongPress,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isSelected ? _kPrimaryLight : _kBackground,
          border: Border.all(
            color: isSelected ? _kPrimary : _kCardBorder,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(_kCardRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(isSelected ? 15 : 6),
              blurRadius: isSelected ? 8 : 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // -- Icon row -----------------------------------------
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: _iconBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_icon, color: _iconColor, size: 24),
                ),
                const Spacer(),
                // Checkbox in selection mode, menu button otherwise
                if (isSelectionMode)
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isSelected ? _kPrimary : Colors.transparent,
                      border: Border.all(
                        color: isSelected ? _kPrimary : _kTextGrey,
                        width: 2,
                      ),
                    ),
                    child: isSelected
                        ? const Icon(Icons.check, size: 14, color: Colors.white)
                        : null,
                  )
                else
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, size: 18, color: _kTextGrey),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    onSelected: (value) {
                      if (value == 'open' || value == 'download') {
                        _downloadFile(context, ref, projectId);
                      } else if (value == 'delete' && (isAdmin || authUser?.name == file.owner)) {
                        _deleteFile(context, ref, projectId, args);
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'open',
                        child: Row(
                          children: [
                            Icon(Icons.open_in_new, size: 16, color: _kTextMid),
                            SizedBox(width: 12),
                            Text('Open', style: TextStyle(fontSize: 14)),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'download',
                        child: Row(
                          children: [
                            Icon(Icons.download_rounded, size: 16, color: _kTextMid),
                            SizedBox(width: 12),
                            Text('Download', style: TextStyle(fontSize: 14)),
                          ],
                        ),
                      ),
                      if (isAdmin || authUser?.name == file.owner) ...[
                        const PopupMenuDivider(),
                        const PopupMenuItem(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(Icons.delete_outline, size: 16, color: Colors.red),
                              SizedBox(width: 12),
                              Text('Delete', style: TextStyle(fontSize: 14, color: Colors.red)),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
              ],
            ),
            const Spacer(),
            // -- File name ----------------------------------------
            Text(
              file.name,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: _kTextDark,
                  height: 1.3),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            // -- Meta row with owner avatar ----------------------
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(file.updatedAt,
                          style: const TextStyle(
                              fontSize: 10, color: _kTextGrey)),
                      const SizedBox(height: 2),
                      Text(file.formattedSize,
                          style: const TextStyle(
                              fontSize: 9, color: _kTextGrey)),
                    ],
                  ),
                ),
                // Owner avatar
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        _avatarColor(file.owner),
                        _avatarColor(file.owner).withValues(alpha: 0.8),
                      ],
                    ),
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(15),
                        blurRadius: 3,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      file.owner.isNotEmpty ? file.owner[0].toUpperCase() : '?',
                      style: const TextStyle(
                        fontSize: 9,
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// --- Member avatars -----------------------------------------------------------

class _MemberAvatars extends ConsumerStatefulWidget {
  final String projectId;
  const _MemberAvatars({required this.projectId});

  @override
  ConsumerState<_MemberAvatars> createState() => _MemberAvatarsState();
}

class _MemberAvatarsState extends ConsumerState<_MemberAvatars> {
  List<ProjectMember> _members = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final m = await FolderService().getProjectMembers(widget.projectId);
      if (mounted) setState(() => _members = m.take(3).toList());
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_members.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      width: _members.length * 22.0 + 10,
      height: 36,
      child: Stack(
        children: [
          for (int i = 0; i < _members.length; i++)
            Positioned(
              left: i * 20.0,
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: _kBackground, width: 1.5),
                ),
                child: CircleAvatar(
                  radius: 13,
                  backgroundColor: _avatarColor(_members[i].name),
                  child: Text(
                    _members[i].initials,
                    style: const TextStyle(
                        fontSize: 9,
                        color: Colors.white,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// --- Create folder bottom sheet -----------------------------------------------

class _CreateFolderSheet extends StatefulWidget {
  final Future<void> Function(String name) onConfirm;
  const _CreateFolderSheet({required this.onConfirm});

  @override
  State<_CreateFolderSheet> createState() => _CreateFolderSheetState();
}

class _CreateFolderSheetState extends State<_CreateFolderSheet> {
  final _ctrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isCreating = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isCreating = true);
    await widget.onConfirm(_ctrl.text.trim());
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        left: 20,
        right: 20,
        top: 8,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Title
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _kPrimaryLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.create_new_folder_outlined,
                      color: _kPrimary, size: 20),
                ),
                const SizedBox(width: 12),
                const Text('New Subfolder',
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: _kTextDark)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close,
                      color: _kTextGrey, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Input
            TextFormField(
              controller: _ctrl,
              autofocus: true,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              style: const TextStyle(
                  fontSize: 15, color: _kTextDark),
              decoration: InputDecoration(
                hintText: 'Folder name',
                hintStyle: const TextStyle(
                    color: _kTextGrey, fontSize: 15),
                prefixIcon: const Icon(Icons.folder_outlined,
                    color: _kPrimary, size: 20),
                filled: true,
                fillColor: _kSurface,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: _kCardBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: _kCardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                      color: _kPrimary, width: 1.5),
                ),
                errorBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      BorderSide(color: Colors.red.shade400),
                ),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Folder name is required';
                }
                if (v.trim().length < 2) {
                  return 'Name must be at least 2 characters';
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            // Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isCreating
                        ? null
                        : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kTextMid,
                      side: const BorderSide(color: _kCardBorder),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding:
                          const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: const Text('Cancel',
                        style: TextStyle(
                            fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isCreating ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding:
                          const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: _isCreating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white),
                          )
                        : const Text('Create',
                            style: TextStyle(
                                fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// --- Share modal --------------------------------------------------------------

class _ShareModal extends ConsumerStatefulWidget {
  final String projectId;
  final List<String> fileIds;
  final Future<void> Function(List<String> userIds) onShare;

  const _ShareModal({
    required this.projectId,
    required this.fileIds,
    required this.onShare,
  });

  @override
  ConsumerState<_ShareModal> createState() => _ShareModalState();
}

class _ShareModalState extends ConsumerState<_ShareModal> {
  List<ProjectMember> _allMembers = [];
  List<ProjectMember> _filtered = [];
  final Set<String> _selected = {};
  final _searchCtrl = TextEditingController();
  bool _isLoading = true;
  bool _isSharing = false;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(_onSearch);
    _loadMembers();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? _allMembers
          : _allMembers
              .where((ProjectMember m) =>
                  m.name.toLowerCase().contains(q) ||
                  m.email.toLowerCase().contains(q))
              .toList();
    });
  }

  Future<void> _loadMembers() async {
    try {
      final members = await FolderService().getAllUsers();
      if (mounted) {
        setState(() {
          _allMembers = members;
          _filtered = members;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    if (_selected.isEmpty) return;
    setState(() => _isSharing = true);
    await widget.onShare(_selected.toList());
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 10),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _kPrimaryLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.share_outlined,
                      color: _kPrimary, size: 18),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Share File Access',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: _kTextDark)),
                    Text(
                      '${widget.fileIds.length} file${widget.fileIds.length > 1 ? 's' : ''} selected',
                      style: const TextStyle(
                          fontSize: 12, color: _kTextGrey),
                    ),
                  ],
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close,
                      color: _kTextGrey, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Search bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(fontSize: 14, color: _kTextDark),
              decoration: InputDecoration(
                hintText: 'Search by name or email�',
                hintStyle: const TextStyle(
                    color: _kTextGrey, fontSize: 14),
                prefixIcon: const Icon(Icons.search,
                    color: _kTextGrey, size: 20),
                filled: true,
                fillColor: _kSurface,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: _kCardBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: _kCardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(
                      color: _kPrimary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1),
          // Member list
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.38,
            ),
            child: _isLoading
                ? const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(
                        child: CircularProgressIndicator(
                            color: _kPrimary)),
                  )
                : _filtered.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(32),
                        child: Center(
                          child: Text(
                            _allMembers.isEmpty
                                ? 'No members in this project.'
                                : 'No users match your search.',
                            style: const TextStyle(
                                color: _kTextGrey, fontSize: 14),
                          ),
                        ),
                      )
                    : ListView.builder(
                        shrinkWrap: true,
                        itemCount: _filtered.length,
                        itemBuilder: (context, i) {
                          final m = _filtered[i];
                          final checked =
                              _selected.contains(m.userId);
                          return ListTile(
                            contentPadding:
                                const EdgeInsets.symmetric(
                                    horizontal: 20, vertical: 2),
                            leading: CircleAvatar(
                              backgroundColor:
                                  _avatarColor(m.name),
                              radius: 20,
                              child: Text(m.initials,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight:
                                          FontWeight.w700)),
                            ),
                            title: Text(m.name,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: _kTextDark)),
                            subtitle: Text(m.email,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: _kTextGrey)),
                            trailing: Checkbox(
                              value: checked,
                              activeColor: _kPrimary,
                              shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(4)),
                              onChanged: (_) => setState(() {
                                checked
                                    ? _selected.remove(m.userId)
                                    : _selected.add(m.userId);
                              }),
                            ),
                            onTap: () => setState(() {
                              checked
                                  ? _selected.remove(m.userId)
                                  : _selected.add(m.userId);
                            }),
                          );
                        },
                      ),
          ),
          const Divider(height: 1),
          // Action buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kTextMid,
                      side: const BorderSide(color: _kCardBorder),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding:
                          const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: const Text('Cancel',
                        style: TextStyle(
                            fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed:
                        (_selected.isEmpty || _isSharing)
                            ? null
                            : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kPrimary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor:
                          _kOrangeBorder,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding:
                          const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: _isSharing
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white),
                          )
                        : Text(
                            _selected.isEmpty
                                ? 'Share'
                                : 'Share with ${_selected.length}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// --- Chat tab (folder-scoped) -------------------------------------------------
// Messages are strictly isolated per folderId.
// This widget is intentionally named _ChatPlaceholder to avoid changing
// the call-site in FolderScreen.build � it is now the real implementation.

// --- Folder access modal -----------------------------------------------------
// Shows ALL users in the system as a checklist.
// Checked = has access. Admin taps to toggle add/remove. Instant feedback.

class _FolderAccessModal extends ConsumerStatefulWidget {
  final String projectId;
  final String folderId;
  final String folderName;
  final VoidCallback onDone;

  const _FolderAccessModal({
    required this.projectId,
    required this.folderId,
    required this.folderName,
    required this.onDone,
  });

  @override
  ConsumerState<_FolderAccessModal> createState() => _FolderAccessModalState();
}

class _FolderAccessModalState extends ConsumerState<_FolderAccessModal> {
  List<ProjectMember> _allUsers = [];
  List<ProjectMember> _filtered = [];
  Set<String> _accessSet        = {};  // userIds who currently have access
  final _searchCtrl = TextEditingController();
  bool _isLoading   = true;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(_onSearch);
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? _allUsers
          : _allUsers.where((ProjectMember u) =>
              u.name.toLowerCase().contains(q) ||
              u.email.toLowerCase().contains(q)).toList();
    });
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final service = FolderService();
      final results = await Future.wait([
        service.getAllUsers(),
        service.getFolderAccessList(widget.folderId),
      ]);
      if (mounted) {
        setState(() {
          _allUsers  = results[0] as List<ProjectMember>;
          _filtered  = results[0] as List<ProjectMember>;
          _accessSet = (results[1] as List<ProjectMember>).map<String>((m) => m.userId).toSet();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // Optimistic toggle � checkbox flips instantly, API fires in background.
  // No spinner, no blocking. If API fails, checkbox reverts with a toast.
  void _toggle(ProjectMember user) {
    final hadAccess = _accessSet.contains(user.userId);

    // Flip immediately so the user sees instant feedback
    setState(() {
      if (hadAccess) {
        _accessSet.remove(user.userId);
      } else {
        _accessSet.add(user.userId);
      }
    });

    // Fire API in background
    final service = FolderService();
    final future = hadAccess
        ? service.revokeFolderAccess(
            folderId: widget.folderId, userId: user.userId)
        : service.grantFolderAccess(
            folderId: widget.folderId, userId: user.userId);

    future.catchError((_) {
      // Revert on failure
      if (mounted) {
        setState(() {
          if (hadAccess) {
            _accessSet.add(user.userId);
          } else {
            _accessSet.remove(user.userId);
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Failed to update access. Please try again.'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final accessCount = _accessSet.length;

    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // -- Handle ------------------------------------------------
          Container(
            margin: const EdgeInsets.only(top: 10),
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // -- Header ------------------------------------------------
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: _kPrimaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.group_add_outlined,
                      color: _kPrimary, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Share Folder Access',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: _kTextDark)),
                      Text(
                        widget.folderName,
                        style: const TextStyle(
                            fontSize: 12, color: _kTextGrey),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close,
                      color: _kTextGrey, size: 20),
                  onPressed: () {
                    Navigator.pop(context);
                    widget.onDone();
                  },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),

          // -- Access count badge ------------------------------------
          if (!_isLoading)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: accessCount > 0 ? _kPrimaryLight : _kSurface,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      accessCount == 0
                          ? 'No users have access'
                          : '$accessCount user${accessCount > 1 ? 's' : ''} have access',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: accessCount > 0 ? _kPrimary : _kTextGrey,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 10),

          // -- Search ------------------------------------------------
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(fontSize: 14, color: _kTextDark),
              decoration: InputDecoration(
                hintText: 'Search users by name or email�',
                hintStyle: const TextStyle(color: _kTextGrey, fontSize: 14),
                prefixIcon: const Icon(Icons.search,
                    color: _kTextGrey, size: 20),
                filled: true,
                fillColor: _kSurface,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _kCardBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _kCardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: _kPrimary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1),

          // -- User list ---------------------------------------------
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.45,
            ),
            child: _isLoading
                ? const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(
                        child: CircularProgressIndicator(color: _kPrimary)),
                  )
                : _filtered.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(40),
                        child: Center(
                          child: Text('No users found.',
                              style: TextStyle(
                                  color: _kTextGrey, fontSize: 14)),
                        ),
                      )
                    : ListView.builder(
                        shrinkWrap: true,
                        itemCount: _filtered.length,
                        itemBuilder: (context, i) {
                          final u = _filtered[i];
                          final hasAccess = _accessSet.contains(u.userId);

                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 4),
                            leading: CircleAvatar(
                              backgroundColor: _avatarColor(u.name),
                              radius: 22,
                              child: Text(u.initials,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700)),
                            ),
                            title: Text(u.name,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: _kTextDark)),
                            subtitle: Text(u.email,
                                style: const TextStyle(
                                    fontSize: 12, color: _kTextGrey)),
                            trailing: Checkbox(
                              value: hasAccess,
                              activeColor: _kPrimary,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4)),
                              onChanged: (_) => _toggle(u),
                            ),
                            onTap: () => _toggle(u),
                          );
                        },
                      ),
          ),

          const Divider(height: 1),

          // -- Done button -------------------------------------------
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  widget.onDone();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kPrimary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                ),
                child: const Text('Done',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatPlaceholder extends ConsumerStatefulWidget {
  final String folderId;
  const _ChatPlaceholder({required this.folderId});

  @override
  ConsumerState<_ChatPlaceholder> createState() => _ChatPlaceholderState();
}

class _ChatPlaceholderState extends ConsumerState<_ChatPlaceholder> {
  final _scrollCtrl  = ScrollController();
  final _textCtrl    = TextEditingController();
  final _focusNode   = FocusNode();

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(chatProvider(widget.folderId).notifier).loadMessages(),
    );
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    _textCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendText() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;
    _textCtrl.clear();
    await ref.read(chatProvider(widget.folderId).notifier).sendText(text);
    _scrollToBottom();
  }

  void _showAttachSheet() {
    // Fetch current folder files for attachment picker
    final folderArgs = ref
        .read(folderViewProvider(FolderViewArgs(
          projectId: '',
          projectName: '',
          folderId: widget.folderId,
        )))
        .files;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AttachFileSheet(
        files: folderArgs,
        onAttach: (fileId) async {
          await ref
              .read(chatProvider(widget.folderId).notifier)
              .sendFileAttachment(fileId);
          _scrollToBottom();
        },
        onUploadNew: () async {
          Navigator.pop(context);
          await _uploadAndAttach();
        },
      ),
    );
  }

  Future<void> _uploadAndAttach() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'pdf','doc','docx','xls','xlsx',
        'jpg','jpeg','png','gif','webp','txt','csv'
      ],
    );
    if (result == null || result.files.isEmpty) return;
    final picked = result.files.first;
    if (picked.path == null) return;

    // We need projectId � read from the parent FolderScreen widget.
    // Since we can't access widget.projectId directly here, we use a
    // workaround: the FolderService upload requires projectId.
    // The chat attach flow uploads to the folder's project.
    // For now we show a toast � full wiring requires projectId passed down.
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Upload via the Files tab, then attach from chat.'),
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider(widget.folderId));
    final authUser  = ref.watch(authProvider).user;
    final myId      = authUser?.id ?? '';

    // Auto-scroll when new messages arrive
    if (chatState.messages.isNotEmpty) _scrollToBottom();

    return Column(
      children: [
        // -- Message list -------------------------------------------
        Expanded(
          child: chatState.isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: _kPrimary))
              : chatState.messages.isEmpty
                  ? _ChatEmptyState()
                  : ListView.builder(
                      controller: _scrollCtrl,
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                      itemCount: chatState.messages.length,
                      itemBuilder: (context, i) {
                        final msg = chatState.messages[i];
                        final isMe = msg.senderId == myId;

                        // Date separator
                        final showDate = i == 0 ||
                            !_sameDay(chatState.messages[i - 1].createdAt,
                                msg.createdAt);

                        return Column(
                          children: [
                            if (showDate)
                              _DateSeparator(date: msg.createdAt),
                            if (msg.type == ChatMessageType.system)
                              _SystemMessage(message: msg)
                            else
                              _ChatBubble(
                                message: msg,
                                isMe: isMe,
                              ),
                          ],
                        );
                      },
                    ),
        ),

        // -- Error banner -------------------------------------------
        if (chatState.errorMessage != null)
          Container(
            width: double.infinity,
            color: Colors.red.shade50,
            padding: const EdgeInsets.symmetric(
                horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Icon(Icons.error_outline,
                    color: Colors.red.shade700, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(chatState.errorMessage!,
                      style: TextStyle(
                          color: Colors.red.shade700, fontSize: 12)),
                ),
                GestureDetector(
                  onTap: () => ref
                      .read(chatProvider(widget.folderId).notifier)
                      .clearError(),
                  child: Icon(Icons.close,
                      color: Colors.red.shade700, size: 16),
                ),
              ],
            ),
          ),

        // -- Composer -----------------------------------------------
        _ChatComposer(
          controller: _textCtrl,
          focusNode: _focusNode,
          isSending: chatState.isSending,
          onSend: _sendText,
          onAttach: _showAttachSheet,
        ),
      ],
    );
  }

  bool _sameDay(DateTime a, DateTime b) {
    final la = a.toLocal();
    final lb = b.toLocal();
    return la.year == lb.year && la.month == lb.month && la.day == lb.day;
  }
}

// --- Chat empty state ---------------------------------------------------------

class _ChatEmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.chat_bubble_outline_rounded,
                  color: _kPrimary, size: 36),
            ),
            const SizedBox(height: 16),
            const Text('No messages yet',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _kTextDark)),
            const SizedBox(height: 6),
            const Text(
              'Messages here are private to this folder.\nStart the conversation.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13, color: _kTextGrey, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

// --- Date separator -----------------------------------------------------------

class _DateSeparator extends StatelessWidget {
  final DateTime date;
  const _DateSeparator({required this.date});

  String get _label {
    final now   = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Convert UTC timestamp to local time before comparing dates
    final local = date.toLocal();
    final d     = DateTime(local.year, local.month, local.day);
    if (d == today) return 'TODAY';
    if (d == today.subtract(const Duration(days: 1))) return 'YESTERDAY';
    return '${local.day} ${_month(local.month)} ${local.year}';
  }

  String _month(int m) => const [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ][m];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          const Expanded(child: Divider(color: _kCardBorder)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _kCardBorder),
              ),
              child: Text(_label,
                  style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: _kTextGrey,
                      letterSpacing: 0.8)),
            ),
          ),
          const Expanded(child: Divider(color: _kCardBorder)),
        ],
      ),
    );
  }
}

// --- System message -----------------------------------------------------------

class _SystemMessage extends StatelessWidget {
  final ChatMessage message;
  const _SystemMessage({required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: _kSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _kCardBorder),
          ),
          child: Text(
            message.text ?? '',
            style: const TextStyle(
                fontSize: 11, color: _kTextGrey),
          ),
        ),
      ),
    );
  }
}

// --- Chat bubble --------------------------------------------------------------

class _ChatBubble extends StatelessWidget {
  final ChatMessage message;
  final bool isMe;
  const _ChatBubble({required this.message, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Sender avatar � incoming only
          if (!isMe) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: _avatarColor(message.senderName),
              child: Text(message.senderInitials,
                  style: const TextStyle(
                      fontSize: 10,
                      color: Colors.white,
                      fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 8),
          ],

          // Bubble
          Flexible(
            child: Column(
              crossAxisAlignment: isMe
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                // Sender name � incoming only
                if (!isMe)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 3),
                    child: Text(message.senderName,
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: _kTextMid)),
                  ),

                // Bubble body
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.68,
                  ),
                  decoration: BoxDecoration(
                    color: isMe ? _kPrimary : _kBackground,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isMe ? 16 : 4),
                      bottomRight: Radius.circular(isMe ? 4 : 16),
                    ),
                    border: isMe
                        ? null
                        : Border.all(color: _kCardBorder),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(8),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  child: message.type == ChatMessageType.file &&
                          message.attachment != null
                      ? _AttachmentPreview(
                          attachment: message.attachment!,
                          isMe: isMe)
                      : Text(
                          message.text ?? '',
                          style: TextStyle(
                            fontSize: 14,
                            color: isMe ? Colors.white : _kTextDark,
                            height: 1.4,
                          ),
                        ),
                ),

                // Timestamp
                Padding(
                  padding: const EdgeInsets.only(top: 3, left: 4, right: 4),
                  child: Text(
                    '${message.timeLabel}${isMe ? '  Me' : ''}',
                    style: const TextStyle(
                        fontSize: 10, color: _kTextGrey),
                  ),
                ),
              ],
            ),
          ),

          if (isMe) const SizedBox(width: 4),
        ],
      ),
    );
  }
}

// --- Attachment preview (inside bubble) --------------------------------------

class _AttachmentPreview extends StatelessWidget {
  final ChatAttachment attachment;
  final bool isMe;
  const _AttachmentPreview(
      {required this.attachment, required this.isMe});

  IconData get _icon {
    switch (attachment.category) {
      case FileCategory.pdf:
        return Icons.picture_as_pdf_rounded;
      case FileCategory.image:
        return Icons.image_rounded;
      case FileCategory.spreadsheet:
        return Icons.table_chart_rounded;
      case FileCategory.document:
        return Icons.description_rounded;
      case FileCategory.generic:
        return Icons.insert_drive_file_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final textColor = isMe ? Colors.white : _kTextDark;
    final subColor  = isMe
        ? Colors.white.withAlpha(180)
        : _kTextGrey;
    final iconBg    = isMe
        ? Colors.white.withAlpha(40)
        : _kPrimaryLight;
    final iconColor = isMe ? Colors.white : _kPrimary;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(_icon, color: iconColor, size: 22),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(attachment.fileName,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: textColor),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1),
              const SizedBox(height: 2),
              Text(attachment.formattedSize,
                  style: TextStyle(
                      fontSize: 11, color: subColor)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Icon(Icons.download_outlined, color: subColor, size: 18),
      ],
    );
  }
}

// --- Chat composer ------------------------------------------------------------

class _ChatComposer extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isSending;
  final VoidCallback onSend;
  final VoidCallback onAttach;

  const _ChatComposer({
    required this.controller,
    required this.focusNode,
    required this.isSending,
    required this.onSend,
    required this.onAttach,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        border: Border(top: BorderSide(color: _kCardBorder)),
      ),
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 10,
        bottom: MediaQuery.of(context).viewInsets.bottom > 0
            ? 10
            : MediaQuery.of(context).padding.bottom + 10,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Attach button
          GestureDetector(
            onTap: onAttach,
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _kSurface,
                shape: BoxShape.circle,
                border: Border.all(color: _kCardBorder),
              ),
              child: const Icon(Icons.add,
                  color: _kTextMid, size: 20),
            ),
          ),
          const SizedBox(width: 8),

          // Text input
          Expanded(
            child: Container(
              constraints: const BoxConstraints(maxHeight: 120),
              decoration: BoxDecoration(
                color: _kSurface,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: _kCardBorder),
              ),
              padding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 8),
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                maxLines: null,
                textInputAction: TextInputAction.newline,
                style: const TextStyle(
                    fontSize: 14, color: _kTextDark),
                decoration: const InputDecoration.collapsed(
                  hintText: 'Type your message�',
                  hintStyle: TextStyle(
                      color: _kTextGrey, fontSize: 14),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Send button
          GestureDetector(
            onTap: isSending ? null : onSend,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isSending
                    ? _kOrangeBorder
                    : _kPrimary,
                shape: BoxShape.circle,
              ),
              child: isSending
                  ? const Padding(
                      padding: EdgeInsets.all(10),
                      child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white),
                    )
                  : const Icon(Icons.send_rounded,
                      color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}

// --- Attach file sheet --------------------------------------------------------

class _AttachFileSheet extends StatelessWidget {
  final List<FileModel> files;
  final void Function(String fileId) onAttach;
  final VoidCallback onUploadNew;

  const _AttachFileSheet({
    required this.files,
    required this.onAttach,
    required this.onUploadNew,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 10),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                const Text('Attach File',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: _kTextDark)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close,
                      color: _kTextGrey, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Upload new option
          ListTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.upload_rounded,
                  color: _kPrimary, size: 20),
            ),
            title: const Text('Upload new file',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _kTextDark)),
            subtitle: const Text('Pick from device',
                style: TextStyle(fontSize: 12, color: _kTextGrey)),
            onTap: onUploadNew,
          ),

          if (files.isNotEmpty) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'FILES IN THIS FOLDER',
                  style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: _kTextGrey,
                      letterSpacing: 0.8),
                ),
              ),
            ),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.35,
              ),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: files.length,
                itemBuilder: (context, i) {
                  final f = files[i];
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 2),
                    leading: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: _kSurface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: _kCardBorder),
                      ),
                      child: Icon(
                        _fileIcon(f.category),
                        color: _kPrimary,
                        size: 18,
                      ),
                    ),
                    title: Text(f.name,
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _kTextDark),
                        overflow: TextOverflow.ellipsis),
                    subtitle: Text(f.formattedSize,
                        style: const TextStyle(
                            fontSize: 11, color: _kTextGrey)),
                    onTap: () {
                      Navigator.pop(context);
                      onAttach(f.id);
                    },
                  );
                },
              ),
            ),
          ],
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  IconData _fileIcon(FileCategory cat) {
    switch (cat) {
      case FileCategory.pdf:
        return Icons.picture_as_pdf_rounded;
      case FileCategory.image:
        return Icons.image_rounded;
      case FileCategory.spreadsheet:
        return Icons.table_chart_rounded;
      case FileCategory.document:
        return Icons.description_rounded;
      case FileCategory.generic:
        return Icons.insert_drive_file_rounded;
    }
  }
}

// --- Project Access Modal -----------------------------------------------------

class ProjectAccessModal extends ConsumerStatefulWidget {
  final String projectId;
  final String projectName;
  final VoidCallback onDone;

  const ProjectAccessModal({
    required this.projectId,
    required this.projectName,
    required this.onDone,
  });

  @override
  ConsumerState<ProjectAccessModal> createState() => _ProjectAccessModalState();
}

class _ProjectAccessModalState extends ConsumerState<ProjectAccessModal> {
  List<ProjectMember> _allUsers = [];
  List<ProjectMember> _filtered = [];
  Set<String> _accessSet        = {};
  final _searchCtrl = TextEditingController();
  bool _isLoading   = true;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(_onSearch);
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? _allUsers
          : _allUsers.where((ProjectMember u) =>
              u.name.toLowerCase().contains(q) ||
              u.email.toLowerCase().contains(q)).toList();
    });
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final service = FolderService();
      final results = await Future.wait([
        service.getAllUsers(),
        service.getProjectMembers(widget.projectId),
      ]);
      if (mounted) {
        setState(() {
          _allUsers  = results[0] as List<ProjectMember>;
          _filtered  = results[0] as List<ProjectMember>;
          _accessSet = (results[1] as List<ProjectMember>).map<String>((m) => m.userId).toSet();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _toggle(ProjectMember user) {
    final hadAccess = _accessSet.contains(user.userId);

    setState(() {
      if (hadAccess) {
        _accessSet.remove(user.userId);
      } else {
        _accessSet.add(user.userId);
      }
    });

    final service = FolderService();
    final future = hadAccess
        ? service.revokeProjectAccess(
            projectId: widget.projectId, userId: user.userId)
        : service.grantProjectAccess(
            projectId: widget.projectId, email: user.email);

    future.catchError((_) {
      if (mounted) {
        setState(() {
          if (hadAccess) {
            _accessSet.add(user.userId);
          } else {
            _accessSet.remove(user.userId);
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Failed to update project access.'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final accessCount = _accessSet.length;

    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 10),
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: _kPrimaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.group_add_outlined,
                      color: _kPrimary, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Share Project Access',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: _kTextDark)),
                      Text(
                        widget.projectName,
                        style: const TextStyle(
                            fontSize: 12, color: _kTextGrey),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close,
                      color: _kTextGrey, size: 20),
                  onPressed: () {
                    Navigator.pop(context);
                    widget.onDone();
                  },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
          if (!_isLoading)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: accessCount > 0 ? _kPrimaryLight : _kSurface,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      accessCount == 0
                          ? 'No users have access'
                          : '$accessCount user${accessCount > 1 ? 's' : ''} have access',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: accessCount > 0 ? _kPrimary : _kTextGrey,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(fontSize: 14, color: _kTextDark),
              decoration: InputDecoration(
                hintText: 'Search users',
                hintStyle: const TextStyle(color: _kTextGrey, fontSize: 14),
                prefixIcon: const Icon(Icons.search,
                    color: _kTextGrey, size: 20),
                filled: true,
                fillColor: _kSurface,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _kCardBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _kCardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: _kPrimary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.45,
            ),
            child: _isLoading
                ? const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(
                        child: CircularProgressIndicator(color: _kPrimary)),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    itemCount: _filtered.length,
                    itemBuilder: (context, i) {
                      final u = _filtered[i];
                      final hasAccess = _accessSet.contains(u.userId);
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 4),
                        leading: CircleAvatar(
                          backgroundColor: _avatarColor(u.name),
                          radius: 22,
                          child: Text(u.initials,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700)),
                        ),
                        title: Text(u.name,
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: _kTextDark)),
                        subtitle: Text(u.email,
                            style: const TextStyle(
                                fontSize: 12, color: _kTextGrey)),
                        trailing: Checkbox(
                          value: hasAccess,
                          activeColor: _kPrimary,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(4)),
                          onChanged: (_) => _toggle(u),
                        ),
                        onTap: () => _toggle(u),
                      );
                    },
                  ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kPrimary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                ),
                child: const Text('Done',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

