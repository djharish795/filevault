/// Matches backend File shape returned by GET /projects/:id
/// { id, name, type, size, folderId, updatedAt, owner, permissions }
class FileModel {
  final String id;
  final String name;
  final String mimeType;
  final int size;
  final String? folderId;
  final String updatedAt;
  final String owner;
  final FilePermissions permissions;

  const FileModel({
    required this.id,
    required this.name,
    required this.mimeType,
    required this.size,
    this.folderId,
    required this.updatedAt,
    required this.owner,
    required this.permissions,
  });

  factory FileModel.fromJson(Map<String, dynamic> json) {
    return FileModel(
      id: json['id'] as String,
      name: json['name'] as String,
      mimeType: (json['type'] ?? json['mimeType'] ?? '') as String,
      size: (json['size'] as num).toInt(),
      folderId: json['folderId'] as String?,
      updatedAt: json['updatedAt'] as String? ?? '',
      owner: json['owner'] as String? ?? '',
      permissions: FilePermissions.fromJson(
        json['permissions'] as Map<String, dynamic>? ?? {},
      ),
    );
  }

  /// Human-readable file size (e.g. "4.2 MB").
  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  /// Broad category used for icon selection.
  FileCategory get category {
    if (mimeType.contains('pdf')) return FileCategory.pdf;
    if (mimeType.contains('image')) return FileCategory.image;
    if (mimeType.contains('sheet') || mimeType.contains('excel') || mimeType.contains('csv')) {
      return FileCategory.spreadsheet;
    }
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return FileCategory.document;
    }
    return FileCategory.generic;
  }
}

class FilePermissions {
  final bool canView;
  final bool canDownload;
  final bool canDelete;
  final bool canShare;

  const FilePermissions({
    required this.canView,
    required this.canDownload,
    required this.canDelete,
    required this.canShare,
  });

  factory FilePermissions.fromJson(Map<String, dynamic> json) {
    return FilePermissions(
      canView: json['canView'] as bool? ?? true,
      canDownload: json['canDownload'] as bool? ?? true,
      canDelete: json['canDelete'] as bool? ?? false,
      canShare: json['canShare'] as bool? ?? false,
    );
  }
}

enum FileCategory { pdf, image, spreadsheet, document, generic }

/// Project member — used in share modal user list.
class ProjectMember {
  final String userId;
  final String name;
  final String email;

  const ProjectMember({
    required this.userId,
    required this.name,
    required this.email,
  });

  factory ProjectMember.fromJson(Map<String, dynamic> json) {
    return ProjectMember(
      userId: json['userId'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
    );
  }

  String get initials {
    final parts = name.trim().split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }
}
