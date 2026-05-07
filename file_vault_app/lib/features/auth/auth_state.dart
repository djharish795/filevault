import 'package:file_vault_app/features/auth/auth_model.dart';

/// Immutable state held by AuthNotifier.
class AuthState {
  final AuthUser? user;
  final String? token;
  final bool isLoading;
  final String? errorMessage;

  const AuthState({
    this.user,
    this.token,
    this.isLoading = false,
    this.errorMessage,
  });

  bool get isAuthenticated => token != null && user != null;

  AuthState copyWith({
    AuthUser? user,
    String? token,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    bool clearAuth = false,
  }) {
    return AuthState(
      user: clearAuth ? null : (user ?? this.user),
      token: clearAuth ? null : (token ?? this.token),
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
