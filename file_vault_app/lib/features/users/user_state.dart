import 'package:file_vault_app/features/users/user_model.dart';

/// Immutable state for the user management screen.
class UserManagementState {
  final List<UserModel> users;
  final bool isLoading;
  final String? errorMessage;

  const UserManagementState({
    this.users = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  UserManagementState copyWith({
    List<UserModel>? users,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return UserManagementState(
      users: users ?? this.users,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
