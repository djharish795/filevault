import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_vault_app/core/api/api_client.dart';
import 'package:file_vault_app/core/utils/secure_storage.dart';
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

      // Persist token to secure storage (Keychain / Keystore).
      await SecureStorage.saveToken(token);

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

  /// Reads the stored token from secure storage.
  /// If found, re-attaches it to Dio so API calls work without re-login.
  /// Does NOT validate the token against the backend — that happens lazily
  /// on the first protected API call (401 will redirect to login).
  Future<void> restoreSession() async {
    final token = await SecureStorage.readToken();
    if (token != null) {
      ApiClient.setToken(token);
      // We have a token but no user object — mark as authenticated with
      // token only. The user object will be populated on the first API call
      // that returns user data, or on next login.
      state = AuthState(token: token);
    }
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  Future<void> logout() async {
    await SecureStorage.deleteToken();
    ApiClient.clearToken();
    state = const AuthState();
  }

  // ---------------------------------------------------------------------------
  // Clear error (called when user starts typing again)
  // ---------------------------------------------------------------------------

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
