import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
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
              onTap: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/');
              },
              child: CircleAvatar(
                radius: 18,
                backgroundColor: _kPrimary,
                child: Text(
                  (user?.name.isNotEmpty == true)
                      ? user!.name[0].toUpperCase()
                      : 'U',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
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
