import 'package:dio/dio.dart';
import 'package:file_vault_app/core/api/api_client.dart';
import 'package:file_vault_app/features/auth/auth_model.dart';

/// Handles authentication API calls.
/// Calls POST /auth/login and parses the response.
class AuthService {
  final Dio _dio = ApiClient.instance;

  /// Login with email and password.
  /// Returns (accessToken, user) on success.
  /// Throws DioException on failure (401 = invalid credentials, etc).
  Future<(String, AuthUser)> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );

    // Backend wraps response: { success: true, data: { accessToken, user } }
    final data = response.data['data'] as Map<String, dynamic>;
    final accessToken = data['accessToken'] as String;
    final user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);

    return (accessToken, user);
  }
}
