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

/// Creates the application router.
/// Requires a [WidgetRef] so the redirect logic can read the auth state.
GoRouter createRouter(WidgetRef ref) {
  // Notifier that fires whenever auth state changes, so go_router re-evaluates
  // the redirect guard automatically.
  final authNotifier = _AuthChangeNotifier(ref);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isAuthenticated = authState.isAuthenticated;
      final isLoginRoute = state.matchedLocation == '/';

      // Not logged in → always send to login.
      if (!isAuthenticated && !isLoginRoute) return '/';

      // Already logged in → skip login screen.
      if (isAuthenticated && isLoginRoute) {
        final isAdmin = authState.user?.isMasterAdmin ?? false;
        return isAdmin ? '/dashboard' : '/user-home';
      }

      return null; // No redirect needed.
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/user-home',
        builder: (context, state) => const UserHomeScreen(),
      ),
      GoRoute(
        path: '/project/:id',
        builder: (context, state) {
          final projectId = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>?;
          final projectName = extra?['projectName'] as String? ?? '';
          return ProjectScreen(projectId: projectId, projectName: projectName);
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
      GoRoute(
        path: '/users',
        builder: (context, state) => const UserManagementScreen(),
      ),
    ],
  );
}

// ---------------------------------------------------------------------------
// ChangeNotifier that bridges Riverpod auth state → go_router refreshListenable
// ---------------------------------------------------------------------------

class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(WidgetRef ref) {
    // Listen to auth state changes and notify go_router to re-run redirect.
    ref.listen(authProvider, (previous, next) {
      if (previous?.isAuthenticated != next.isAuthenticated ||
          previous?.user?.isMasterAdmin != next.user?.isMasterAdmin) {
        notifyListeners();
      }
    });
  }
}
