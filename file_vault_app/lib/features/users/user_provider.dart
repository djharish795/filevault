import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_vault_app/features/users/user_service.dart';
import 'package:file_vault_app/features/users/user_state.dart';

final userManagementProvider =
    NotifierProvider<UserManagementNotifier, UserManagementState>(
  UserManagementNotifier.new,
);

class UserManagementNotifier extends Notifier<UserManagementState> {
  final _service = UserService();

  @override
  UserManagementState build() => const UserManagementState();

  // ── Load users ──────────────────────────────────────────────────────────────

  Future<void> loadUsers() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final users = await _service.getUsers();
      state = state.copyWith(users: users, isLoading: false);
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: _mapError(e),
      );
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load users.',
      );
    }
  }

  // ── Create user — returns error string or null on success ───────────────────

  Future<String?> createUser({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final newUser = await _service.createUser(
        name: name,
        email: email,
        password: password,
      );
      // Optimistic insert at top of list.
      state = state.copyWith(users: [newUser, ...state.users]);
      return null;
    } on DioException catch (e) {
      return _mapError(e);
    } catch (_) {
      return 'Failed to create user.';
    }
  }

  // ── Delete user ─────────────────────────────────────────────────────────────

  Future<String?> deleteUser(String userId) async {
    // Optimistic removal.
    final previous = state.users;
    state = state.copyWith(
      users: state.users.where((u) => u.id != userId).toList(),
    );
    try {
      await _service.deleteUser(userId);
      return null;
    } on DioException catch (e) {
      // Rollback on failure.
      state = state.copyWith(users: previous);
      return _mapError(e);
    } catch (_) {
      state = state.copyWith(users: previous);
      return 'Failed to delete user.';
    }
  }

  // ── Reset password — returns error string or null on success ────────────────

  Future<String?> resetPassword({
    required String userId,
    required String newPassword,
  }) async {
    try {
      await _service.resetPassword(userId: userId, newPassword: newPassword);
      return null;
    } on DioException catch (e) {
      return _mapError(e);
    } catch (_) {
      return 'Failed to reset password.';
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  String _mapError(DioException e) {
    final serverMsg = e.response?.data?['error']?['message'] as String?;
    if (serverMsg != null) return serverMsg;
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach server. Check your network.';
    }
    return 'Something went wrong. Please try again.';
  }
}
