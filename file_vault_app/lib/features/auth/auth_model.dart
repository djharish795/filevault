/// Represents the authenticated user returned by the backend.
/// Field names match the actual API response:
///   { "success": true, "data": { "accessToken": "...", "user": { ... } } }
class AuthUser {
  final String id;
  final String email;
  final String name;
  final bool isMasterAdmin;

  const AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.isMasterAdmin,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      isMasterAdmin: json['isMasterAdmin'] as bool? ?? false,
    );
  }

  @override
  String toString() => 'AuthUser(id: $id, email: $email, isAdmin: $isMasterAdmin)';
}
