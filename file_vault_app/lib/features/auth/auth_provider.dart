import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_vault_app/core/api/api_client.dart';
import 'package:file_vault_app/core/utils/secure_storage.dart';
import 'package:file_vault_app/features/auth/auth_model.dart';
import 'package:file_vault_app/features/auth/auth_service.dart';
import 'package:file_vault_app/features/auth/auth_state.dart';

/// Riverpod provider — exposes AuthNotifier to the widget tree.
final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

class AuthNotifier extends Notifier<AuthState> {
  final _service = AuthService();

  @override
  AuthState build() => const AuthState();

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  /// Calls the backend login endpoint.
  /// On success: stores token securely, attaches it to Dio, updates state.
  /// On failure: sets errorMessage — never throws to the UI.
  Future<void> login({
    required String email,
    required String password,
  }) async {
    // Guard: prevent duplicate requests while one is in flight.
    if (state.isLoading) return;

    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final (token, user) = await _service.login(
        email: email,
        password: password,
      );

      // Persist token and user to secure storage.
      await SecureStorage.saveToken(token);
      await SecureStorage.saveUser(user);

      // Attach token to every subsequent Dio request.
      ApiClient.setToken(token);

      state = AuthState(user: user, token: token, isLoading: false);
    } on DioException catch (e) {
      final message = _mapDioError(e);
      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'An unexpected error occurred. Please try again.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Restore session on app start
  // ---------------------------------------------------------------------------

  /// Reads the stored token, re-attaches it to Dio, then fetches the current
  /// user profile from the backend so the user object is always populated.
  Future<void> restoreSession() async {
    final token = await SecureStorage.readToken();
    if (token == null) return;

    ApiClient.setToken(token);

    // Load cached user immediately — no network needed.
    // This ensures correct name/role/avatar on startup even if offline.
    final cachedUser = await SecureStorage.readUser();
    state = AuthState(token: token, user: cachedUser);

    // Then refresh from backend in background to pick up any profile changes.
    try {
      final res = await ApiClient.instance.get('/auth/me');
      final freshUser = AuthUser.fromJson(
        res.data['data']['user'] as Map<String, dynamic>,
      );
      // Update cache and state with fresh data
      await SecureStorage.saveUser(freshUser);
      state = AuthState(token: token, user: freshUser);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        // Token expired — force re-login
        await SecureStorage.clearAll();
        ApiClient.clearToken();
        state = const AuthState();
      }
      // Network error — cached user is already set, app works normally
    } catch (_) {
      // Non-critical — cached user already in state
    }
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  Future<void> logout() async {
    await SecureStorage.clearAll();
    ApiClient.clearToken();
    state = const AuthState();
  }

  // ---------------------------------------------------------------------------
  // Update profile (name) — any authenticated user, no admin required
  // ---------------------------------------------------------------------------

  Future<String?> updateProfile({ required String name }) async {
    if (name.trim().isEmpty) return 'Name cannot be empty';
    try {
      final dio = ApiClient.instance;
      final res = await dio.patch('/auth/profile', data: { 'name': name.trim() });
      final updatedUser = AuthUser.fromJson(
        res.data['data']['user'] as Map<String, dynamic>,
      );
      // Update state with new name, keep token
      state = state.copyWith(user: updatedUser);
      await SecureStorage.saveUser(updatedUser);
      return null;
    } on DioException catch (e) {
      final msg = e.response?.data?['error']?['message'] as String?;
      return msg ?? 'Failed to update profile.';
    } catch (_) {
      return 'An unexpected error occurred.';
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  String _mapDioError(DioException e) {
    if (e.response?.statusCode == 401) {
      return 'Invalid email or password.';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Connection timed out. Check your network.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach server. Check your network.';
    }
    // Try to extract backend error message.
    final serverMsg = e.response?.data?['error']?['message'] as String?;
    return serverMsg ?? 'Login failed. Please try again.';
  }
}
