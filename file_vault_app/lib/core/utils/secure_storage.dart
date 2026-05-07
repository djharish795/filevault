import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around FlutterSecureStorage.
/// Stores the JWT access token in the platform keychain / keystore.
/// Never logs token values.
class SecureStorage {
  SecureStorage._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _keyToken = 'access_token';

  /// Persist the JWT access token securely.
  static Future<void> saveToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }

  /// Read the stored JWT access token. Returns null if not found.
  static Future<String?> readToken() async {
    return _storage.read(key: _keyToken);
  }

  /// Delete the stored token (called on logout).
  static Future<void> deleteToken() async {
    await _storage.delete(key: _keyToken);
  }
}
