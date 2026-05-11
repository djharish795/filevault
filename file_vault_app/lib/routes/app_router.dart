import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
import 'package:file_vault_app/features/auth/login_screen.dart';
import 'package:file_vault_app/features/auth/user_home_screen.dart';
import 'package:file_vault_app/features/projects/dashboard_screen.dart';
import 'package:file_vault_app/features/projects/project_screen.dart';
import 'package:file_vault_app/features/folders/folder_screen.dart';
import 'package:file_vault_app/features/users/user_management_screen.dart';
import 'package:file_vault_app/features/share_target/share_session_screen.dart';
import 'package:file_vault_app/features/share_target/share_intent_service.dart';

GoRouter createRouter(WidgetRef ref) {
  // Notifier fires when auth changes OR when pending share files arrive.
  // Both events must trigger a redirect re-evaluation.
  final routerNotifier = _RouterChangeNotifier(ref);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: routerNotifier,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isAuthenticated = authState.isAuthenticated;
      final isLoginRoute = state.matchedLocation == '/';
      final isShareRoute = state.matchedLocation == '/share';

      // Not logged in → send to login (share state preserved in provider)
      if (!isAuthenticated && !isLoginRoute) return '/';

      // Logged in on login screen → decide where to go
      if (isAuthenticated && isLoginRoute) {
        if (ShareIntentService.instance.hasPendingFiles) return '/share';
        final isAdmin = authState.user?.isMasterAdmin ?? false;
        return isAdmin ? '/dashboard' : '/user-home';
      }

      // Already on dashboard/home but share files just arrived → go to share
      if (isAuthenticated && !isShareRoute &&
          ShareIntentService.instance.hasPendingFiles) {
        return '/share';
      }

      // Share route requires auth
      if (isShareRoute && !isAuthenticated) return '/';

      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
      GoRoute(path: '/user-home', builder: (_, __) => const UserHomeScreen()),
      GoRoute(path: '/share', builder: (_, __) => const ShareSessionScreen()),
      GoRoute(
        path: '/project/:id',
        builder: (context, state) {
          final projectId = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>?;
          return ProjectScreen(
            projectId: projectId,
            projectName: extra?['projectName'] as String? ?? '',
          );
        },
        routes: [
          GoRoute(
            path: 'folder/:folderId',
            builder: (context, state) {
              final projectId = state.pathParameters['id']!;
              final folderId = state.pathParameters['folderId']!;
              final extra = state.extra as Map<String, dynamic>?;
              return FolderScreen(
                projectId: projectId,
                projectName: extra?['projectName'] as String? ?? '',
                folderId: folderId,
                folderName: extra?['folderName'] as String?,
              );
            },
          ),
        ],
      ),
      GoRoute(
        path: '/folder/:id',
        builder: (context, state) {
          final folderId = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>?;
          return FolderScreen(
            projectId: extra?['projectId'] as String? ?? '',
            projectName: extra?['projectName'] as String? ?? '',
            folderId: folderId,
            folderName: extra?['folderName'] as String?,
          );
        },
      ),
      GoRoute(path: '/users', builder: (_, __) => const UserManagementScreen()),
    ],
  );
}

// Fires when auth state changes OR when pending share files are set/cleared.
// This ensures the router re-evaluates the redirect in both cases.
class _RouterChangeNotifier extends ChangeNotifier {
  _RouterChangeNotifier(WidgetRef ref) {
    // Auth changes (login/logout)
    ref.listen(authProvider, (previous, next) {
      if (previous?.isAuthenticated != next.isAuthenticated ||
          previous?.user?.isMasterAdmin != next.user?.isMasterAdmin) {
        notifyListeners();
      }
    });

    // Share intent files arriving — triggers redirect to /share
    ref.listen(pendingShareProvider, (previous, next) {
      final hadFiles = previous != null && previous.isNotEmpty;
      final hasFiles = next.isNotEmpty;
      if (hadFiles != hasFiles) {
        notifyListeners();
      }
    });
  }
}
