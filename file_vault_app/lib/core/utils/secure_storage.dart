import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:file_vault_app/features/auth/auth_model.dart';

class SecureStorage {
  SecureStorage._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _keyToken = 'access_token';
  static const _keyUser  = 'cached_user';

  // ── Token ──────────────────────────────────────────────────────────────────

  static Future<void> saveToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }

  static Future<String?> readToken() async {
    return _storage.read(key: _keyToken);
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _keyToken);
  }

  // ── User cache — persists name/email/role across restarts ─────────────────
  // Avoids showing "User" when network is unavailable on startup.

  static Future<void> saveUser(AuthUser user) async {
    final json = jsonEncode({
      'id': user.id,
      'email': user.email,
      'name': user.name,
      'isMasterAdmin': user.isMasterAdmin,
    });
    await _storage.write(key: _keyUser, value: json);
  }

  static Future<AuthUser?> readUser() async {
    final raw = await _storage.read(key: _keyUser);
    if (raw == null) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return AuthUser.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  static Future<void> deleteUser() async {
    await _storage.delete(key: _keyUser);
  }

  // ── Clear all ──────────────────────────────────────────────────────────────

  static Future<void> clearAll() async {
    await Future.wait([deleteToken(), deleteUser()]);
  }
}
