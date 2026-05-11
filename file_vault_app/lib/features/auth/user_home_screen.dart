import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
import 'package:file_vault_app/features/auth/edit_profile_screen.dart';
import 'package:file_vault_app/features/projects/project_provider.dart';

// ─── Design tokens ────────────────────────────────────────────────────────────

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

/// Home screen for regular (non-admin) users.
/// Shows only the projects they have been granted access to.
class UserHomeScreen extends ConsumerStatefulWidget {
  const UserHomeScreen({super.key});

  @override
  ConsumerState<UserHomeScreen> createState() => _UserHomeScreenState();
}

class _UserHomeScreenState extends ConsumerState<UserHomeScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(projectListProvider.notifier).load());
  }

  // ── Profile bottom sheet ──────────────────────────────────────────────────

  void _showProfileSheet(BuildContext context, dynamic user) {
    final isAdmin = user?.isMasterAdmin == true;
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
                    _avatarColor(user?.name ?? 'U'),
                    _avatarColor(user?.name ?? 'U').withValues(alpha: 0.8),
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
                  user?.name?.isNotEmpty == true
                      ? (user!.name as String)[0].toUpperCase()
                      : 'U',
                  style: const TextStyle(
                    fontSize: 28, color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            // Name
            Text(
              user?.name ?? 'User',
              style: const TextStyle(
                fontSize: 18, fontWeight: FontWeight.w700,
                color: _kTextDark,
              ),
            ),
            const SizedBox(height: 4),
            // Email
            Text(
              user?.email ?? '',
              style: const TextStyle(fontSize: 13, color: _kTextGrey),
            ),
            const SizedBox(height: 10),
            // Role badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: isAdmin ? _kPrimaryLight : const Color(0xFFF8F8F8),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isAdmin ? 'Administrator' : 'User',
                style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700,
                  color: isAdmin ? _kPrimary : _kTextGrey,
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
                Navigator.pop(context); // close sheet first
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
                Navigator.pop(context); // close sheet
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
    final user      = ref.watch(authProvider).user;
    final projState = ref.watch(projectListProvider);

    return Scaffold(
      backgroundColor: _kBackground,
      appBar: AppBar(
        backgroundColor: _kBackground,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'File Vault',
          style: TextStyle(
            color: _kTextDark,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: () => _showProfileSheet(context, user),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      _avatarColor(user?.name ?? 'U'),
                      _avatarColor(user?.name ?? 'U').withValues(alpha: 0.8),
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
                    (user?.name.isNotEmpty == true)
                        ? user!.name[0].toUpperCase()
                        : 'U',
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
      ),
      body: RefreshIndicator(
        color: _kPrimary,
        onRefresh: () => ref.read(projectListProvider.notifier).load(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),

              // ── Greeting ─────────────────────────────────────────────────
              Padding(
                padding: _kPagePadding,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome, ${user?.name ?? 'User'}',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: _kTextDark,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Your accessible project folders.',
                      style: TextStyle(fontSize: 13, color: _kTextGrey),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── Section header ───────────────────────────────────────────
              Padding(
                padding: _kPagePadding,
                child: const Text(
                  'My Projects',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _kTextDark,
                  ),
                ),
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
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.folder_off_outlined,
                            color: _kTextGrey, size: 48),
                        SizedBox(height: 12),
                        Text(
                          'No projects assigned yet.\nContact your admin for access.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: _kTextGrey, fontSize: 14, height: 1.5),
                        ),
                      ],
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
                    return _UserProjectCard(
                      project: project,
                      onTap: () => context.push(
                        '/project/${project.id}',
                        extra: {'projectName': project.name},
                      ),
                    );
                  },
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── User project card ────────────────────────────────────────────────────────

class _UserProjectCard extends StatelessWidget {
  final dynamic project; // ProjectModel
  final VoidCallback onTap;

  const _UserProjectCard({required this.project, required this.onTap});

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
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _kPrimaryLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.folder_rounded,
                  color: _kPrimary, size: 22),
            ),
            const SizedBox(width: 12),
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
                  const SizedBox(height: 3),
                  Text(
                    'Case ID: ${project.caseNumber}',
                    style: const TextStyle(fontSize: 11, color: _kTextGrey),
                  ),
                ],
              ),
            ),
            Text(
              project.updatedLabel as String,
              style: const TextStyle(fontSize: 11, color: _kTextGrey),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: _kTextGrey, size: 20),
          ],
        ),
      ),
    );
  }
}
