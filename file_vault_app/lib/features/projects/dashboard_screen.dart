import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
import 'package:file_vault_app/features/auth/edit_profile_screen.dart';
import 'package:file_vault_app/features/projects/project_provider.dart';

// ─── Design tokens ───────────────────────────────────────────────────────────

const _kPrimary      = Color(0xFFE65C2F);
const _kPrimaryLight = Color(0xFFFFF0EB);
const _kBackground   = Color(0xFFFFFFFF);
const _kCardBorder   = Color(0xFFF2C1B3);
const _kTextDark     = Color(0xFF333333);
const _kTextGrey     = Color(0xFF777777);
const _kCardRadius   = 10.0;
const _kPagePadding  = EdgeInsets.symmetric(horizontal: 18.0);

const _kAvatarColors = [
  Color(0xFF5B8DEF), Color(0xFF3DAB7B), Color(0xFFE65C2F),
  Color(0xFF9B59B6), Color(0xFFE67E22), Color(0xFF1ABC9C),
];
Color _avatarColor(String s) =>
    _kAvatarColors[s.codeUnitAt(0) % _kAvatarColors.length];

// ─── Dashboard screen ─────────────────────────────────────────────────────────

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _selectedTab = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(projectListProvider.notifier).load());
  }

  void _toast(String msg, {bool isError = false}) {
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

  void _showCreateProjectDialog() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateProjectSheet(
        onConfirm: (name, caseNumber) async {
          final err = await ref
              .read(projectListProvider.notifier)
              .createProject(name: name, caseNumber: caseNumber);
          if (err != null) {
            _toast(err, isError: true);
          } else {
            _toast('Project "$name" created.');
          }
        },
      ),
    );
  }

  void _showProfileSheet(BuildContext context) {
    final user = ref.read(authProvider).user;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: _kBackground,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Avatar
            Container(
              width: 72, height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _avatarColor(user?.name ?? 'A'),
                    _avatarColor(user?.name ?? 'A').withValues(alpha: 0.8),
                  ],
                ),
                border: Border.all(color: Colors.white, width: 3),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(20),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  (user?.name ?? '').isNotEmpty
                      ? user!.name[0].toUpperCase()
                      : 'A',
                  style: const TextStyle(
                    fontSize: 28, color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              user?.name ?? 'Admin',
              style: const TextStyle(
                fontSize: 18, fontWeight: FontWeight.w700,
                color: _kTextDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              user?.email ?? '',
              style: const TextStyle(fontSize: 13, color: _kTextGrey),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Administrator',
                style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700,
                  color: _kPrimary,
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 8),
            // Edit Profile
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: _kPrimaryLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.person_outline,
                    color: _kPrimary, size: 20),
              ),
              title: const Text('Edit Profile',
                  style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: _kTextDark)),
              subtitle: const Text('Update your name',
                  style: TextStyle(fontSize: 12, color: _kTextGrey)),
              trailing: const Icon(Icons.chevron_right,
                  color: _kTextGrey, size: 20),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const EditProfileScreen(),
                ));
              },
            ),
            const SizedBox(height: 4),
            // Logout
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.logout_rounded,
                    color: Colors.red.shade600, size: 20),
              ),
              title: Text('Logout',
                  style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: Colors.red.shade600)),
              subtitle: const Text('Sign out of your account',
                  style: TextStyle(fontSize: 12, color: _kTextGrey)),
              onTap: () async {
                Navigator.pop(context);
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    title: const Text('Logout',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16)),
                    content: const Text(
                        'Are you sure you want to logout?',
                        style: TextStyle(fontSize: 14)),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancel',
                            style: TextStyle(color: Colors.grey)),
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
                if (confirmed == true && context.mounted) {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/');
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user     = ref.watch(authProvider).user;
    final projState = ref.watch(projectListProvider);

    return Scaffold(
      backgroundColor: _kBackground,
      appBar: _buildAppBar(user?.name),
      body: RefreshIndicator(
        color: _kPrimary,
        onRefresh: () => ref.read(projectListProvider.notifier).load(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),

              // ── Header ──────────────────────────────────────────────────
              Padding(
                padding: _kPagePadding,
                child: _Header(userName: user?.name),
              ),
              const SizedBox(height: 20),

              // ── Create new button ────────────────────────────────────────
              Padding(
                padding: _kPagePadding,
                child: _CreateNewButton(onTap: _showCreateProjectDialog),
              ),
              const SizedBox(height: 24),

              // ── Stats row ────────────────────────────────────────────────
              Padding(
                padding: _kPagePadding,
                child: _StatsSection(
                  projectCount: projState.projects.length,
                ),
              ),
              const SizedBox(height: 28),

              // ── Recent projects header ───────────────────────────────────
              Padding(
                padding: _kPagePadding,
                child: const _RecentProjectsHeader(),
              ),
              const SizedBox(height: 12),

              // ── Project list ─────────────────────────────────────────────
              if (projState.isLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: CircularProgressIndicator(color: _kPrimary),
                  ),
                )
              else if (projState.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.cloud_off_outlined,
                            color: _kTextGrey, size: 48),
                        const SizedBox(height: 12),
                        Text(projState.errorMessage!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: _kTextGrey, fontSize: 14)),
                        const SizedBox(height: 16),
                        OutlinedButton(
                          onPressed: () =>
                              ref.read(projectListProvider.notifier).load(),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _kPrimary,
                            side: const BorderSide(color: _kCardBorder),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (projState.projects.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: Text(
                      'No projects yet.\nTap + CREATE NEW to get started.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: _kTextGrey, fontSize: 14),
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: _kPagePadding,
                  itemCount: projState.projects.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final project = projState.projects[index];
                    return _ProjectCard(
                      project: project,
                      onTap: () => context.push(
                        '/project/${project.id}',
                        extra: {'projectName': project.name},
                      ),
                      onRename: () {
                        _showRenameProjectDialog(project);
                      },
                      onDelete: () async {
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16)),
                            title: const Text('Delete Project',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16)),
                            content: Text(
                              'Delete "${project.name}"? This will remove all folders and files.',
                              style: const TextStyle(fontSize: 14),
                            ),
                            actions: [
                              TextButton(
                                onPressed: () =>
                                    Navigator.pop(ctx, false),
                                child: const Text('Cancel'),
                              ),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.red.shade700,
                                  foregroundColor: Colors.white,
                                ),
                                onPressed: () =>
                                    Navigator.pop(ctx, true),
                                child: const Text('Delete'),
                              ),
                            ],
                          ),
                        );
                        if (confirmed == true) {
                          final err = await ref
                              .read(projectListProvider.notifier)
                              .deleteProject(project.id);
                          if (err != null) _toast(err, isError: true);
                        }
                      },
                    );
                  },
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _BottomNav(
        selectedIndex: _selectedTab,
        onTap: (index) {
          setState(() => _selectedTab = index);
          if (index == 1) context.go('/users');
        },
      ),
    );
  }

  void _showRenameProjectDialog(dynamic project) {
    final nameController = TextEditingController(text: project.name);
    final caseController = TextEditingController(text: project.caseNumber ?? '');
    showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rename Project', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Project Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: caseController,
              decoration: const InputDecoration(
                labelText: 'Case Number (Optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: _kPrimary, foregroundColor: Colors.white),
            child: const Text('Rename'),
          ),
        ],
      ),
    ).then((confirmed) async {
      if (confirmed == true && nameController.text.trim().isNotEmpty) {
        final newName = nameController.text.trim();
        final newCase = caseController.text.trim();
        if (newName == project.name && newCase == (project.caseNumber ?? '')) return;
        
        final err = await ref.read(projectListProvider.notifier).updateProject(project.id, newName, newCase);
        if (err != null) {
          _toast(err, isError: true);
        } else {
          _toast('Project updated successfully');
        }
      }
    });
  }

  PreferredSizeWidget _buildAppBar(String? userName) {
    return AppBar(
      backgroundColor: _kBackground,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: false,
      title: const Text(
        'File Vault',
        style: TextStyle(
          color: _kTextDark,
          fontWeight: FontWeight.w700,
          fontSize: 18,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.search, color: _kTextDark),
          onPressed: () {},
        ),
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: GestureDetector(
            onTap: () => _showProfileSheet(context),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _avatarColor(userName ?? 'A'),
                    _avatarColor(userName ?? 'A').withValues(alpha: 0.8),
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
                  (userName?.isNotEmpty == true)
                      ? userName![0].toUpperCase()
                      : 'A',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final String? userName;
  const _Header({this.userName});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Project Dashboard',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: _kTextDark,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Manage and monitor high-stakes document vaults.',
          style: TextStyle(fontSize: 13, color: _kTextGrey),
        ),
      ],
    );
  }
}

// ─── Create new button ────────────────────────────────────────────────────────

class _CreateNewButton extends StatelessWidget {
  final VoidCallback onTap;
  const _CreateNewButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 46,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: _kPrimary,
          foregroundColor: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_kCardRadius),
          ),
        ),
        child: const Text(
          '+ CREATE NEW',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            letterSpacing: 0.8,
          ),
        ),
      ),
    );
  }
}

// ─── Stats section ────────────────────────────────────────────────────────────

class _StatsSection extends StatelessWidget {
  final int projectCount;
  const _StatsSection({required this.projectCount});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _StatCard(
          label: 'ACTIVE PROJECTS',
          value: projectCount.toString().padLeft(2, '0'),
          valueColor: _kPrimary,
        ),
        const SizedBox(height: 10),
        const _StatCard(
          label: 'PENDING APPROVALS',
          value: '00',
          valueColor: _kTextDark,
        ),
        const SizedBox(height: 10),
        const _StatCard(
          label: 'STORAGE UTILIZED',
          value: '—',
          valueColor: _kTextDark,
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;

  const _StatCard({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: _kBackground,
        border: Border.all(color: _kCardBorder),
        borderRadius: BorderRadius.circular(_kCardRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: _kTextGrey,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Recent projects header ───────────────────────────────────────────────────

class _RecentProjectsHeader extends StatelessWidget {
  const _RecentProjectsHeader();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Recent Projects',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: _kTextDark,
          ),
        ),
      ],
    );
  }
}

// ─── Project card ─────────────────────────────────────────────────────────────

class _ProjectCard extends StatelessWidget {
  final dynamic project; // ProjectModel
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  const _ProjectCard({
    required this.project,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: _kBackground,
          border: Border.all(color: _kCardBorder),
          borderRadius: BorderRadius.circular(_kCardRadius),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // ── Folder icon ────────────────────────────────────────────────
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.folder_rounded,
                color: _kPrimary,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),

            // ── Name + case ID ─────────────────────────────────────────────
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    project.name as String,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: _kTextDark,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Case ID: ${project.caseNumber?.isNotEmpty == true ? project.caseNumber : "N/A"}',
                    style: const TextStyle(fontSize: 11, color: _kTextGrey),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),

            // ── Updated label ──────────────────────────────────────────────
            Text(
              project.updatedLabel as String,
              style: const TextStyle(fontSize: 11, color: _kTextGrey),
            ),
            const SizedBox(width: 4),

            // ── More menu ──────────────────────────────────────────────────
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: _kTextGrey, size: 18),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              onSelected: (value) {
                if (value == 'rename') onRename();
                if (value == 'delete') onDelete();
              },
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'rename',
                  child: Row(
                    children: [
                      Icon(Icons.edit_outlined, color: _kTextDark, size: 18),
                      SizedBox(width: 8),
                      Text('Rename', style: TextStyle(color: _kTextDark)),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline,
                          color: Colors.red, size: 18),
                      SizedBox(width: 8),
                      Text('Delete',
                          style: TextStyle(color: Colors.red)),
                    ],
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

// ─── Bottom navigation bar ────────────────────────────────────────────────────

class _BottomNav extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _BottomNav({required this.selectedIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: _kBackground,
        border: Border(top: BorderSide(color: Color(0xFFEEEEEE))),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              _NavItem(
                icon: Icons.folder_copy_rounded,
                label: 'ALL PROJECTS',
                isActive: selectedIndex == 0,
                onTap: () => onTap(0),
              ),
              _NavItem(
                icon: Icons.person_add_alt_1_rounded,
                label: 'USERS',
                isActive: selectedIndex == 1,
                onTap: () => onTap(1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isActive ? _kPrimary : _kTextGrey;

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: color,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Create project bottom sheet ──────────────────────────────────────────────

class _CreateProjectSheet extends StatefulWidget {
  final Future<void> Function(String name, String caseNumber) onConfirm;
  const _CreateProjectSheet({required this.onConfirm});

  @override
  State<_CreateProjectSheet> createState() => _CreateProjectSheetState();
}

class _CreateProjectSheetState extends State<_CreateProjectSheet> {
  final _nameCtrl = TextEditingController();
  final _caseCtrl = TextEditingController();
  final _formKey  = GlobalKey<FormState>();
  bool _isCreating = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _caseCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isCreating = true);
    await widget.onConfirm(_nameCtrl.text.trim(), _caseCtrl.text.trim());
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
                const Text('New Project',
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: _kTextDark)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: _kTextGrey, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Project name
            TextFormField(
              controller: _nameCtrl,
              autofocus: true,
              textInputAction: TextInputAction.next,
              style: const TextStyle(fontSize: 15, color: _kTextDark),
              decoration: _inputDecoration('Project name', Icons.folder_outlined),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Project name is required';
                if (v.trim().length < 2) return 'Name must be at least 2 characters';
                return null;
              },
            ),
            const SizedBox(height: 14),
            // Case number
            TextFormField(
              controller: _caseCtrl,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              style: const TextStyle(fontSize: 15, color: _kTextDark),
              decoration: _inputDecoration('Case number (Optional)', Icons.tag),
              validator: (v) {
                return null;
              },
            ),
            const SizedBox(height: 20),
            // Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isCreating ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kTextGrey,
                      side: const BorderSide(color: Color(0xFFEEEEEE)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: const Text('Cancel',
                        style: TextStyle(fontWeight: FontWeight.w600)),
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
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: _isCreating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Create',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: _kTextGrey, fontSize: 15),
      prefixIcon: Icon(icon, color: _kPrimary, size: 20),
      filled: true,
      fillColor: const Color(0xFFF8F8F8),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFEEEEEE)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFEEEEEE)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _kPrimary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.red.shade400),
      ),
    );
  }
}
