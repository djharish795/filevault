import 'package:dio/dio.dart';
import 'package:file_vault_app/core/api/api_client.dart';
import 'package:file_vault_app/features/users/user_model.dart';

/// Handles all user management API calls.
/// Endpoints: GET/POST/DELETE /admin/users, PATCH /admin/users/:id/password
class UserService {
  final Dio _dio = ApiClient.instance;

  // ── GET /admin/users ────────────────────────────────────────────────────────
  Future<List<UserModel>> getUsers() async {
    final response = await _dio.get('/admin/users');
    final users = response.data['data']['users'] as List<dynamic>;
    return users
        .map((u) => UserModel.fromJson(u as Map<String, dynamic>))
        .toList();
  }

  // ── POST /admin/users ───────────────────────────────────────────────────────
  Future<UserModel> createUser({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await _dio.post(
      '/admin/users',
      data: {'name': name, 'email': email, 'password': password},
    );
    return UserModel.fromJson(
      response.data['data']['user'] as Map<String, dynamic>,
    );
  }

  // ── DELETE /admin/users/:id ─────────────────────────────────────────────────
  Future<void> deleteUser(String userId) async {
    await _dio.delete('/admin/users/$userId');
  }

  // ── PATCH /admin/users/:id/password ────────────────────────────────────────
  Future<void> resetPassword({
    required String userId,
    required String newPassword,
  }) async {
    await _dio.patch(
      '/admin/users/$userId/password',
      data: {'password': newPassword},
    );
  }
}
