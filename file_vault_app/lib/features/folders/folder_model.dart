/// Matches backend Folder shape: { id, name, projectId, parentId, createdAt }
class FolderModel {
  final String id;
  final String name;
  final String projectId;
  final String? parentId;
  final DateTime createdAt;

  const FolderModel({
    required this.id,
    required this.name,
    required this.projectId,
    this.parentId,
    required this.createdAt,
  });

  factory FolderModel.fromJson(Map<String, dynamic> json) {
    return FolderModel(
      id: json['id'] as String,
      name: json['name'] as String,
      // projectId may be absent in older list responses — fall back to empty.
      projectId: (json['projectId'] as String?) ?? '',
      // parentId is null when the folder is at the root level.
      parentId: json['parentId'] as String?,
      // createdAt may be absent in older responses — fall back to now.
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }

  FolderModel copyWith({
    String? id,
    String? name,
    String? projectId,
    String? parentId,
    DateTime? createdAt,
  }) {
    return FolderModel(
      id: id ?? this.id,
      name: name ?? this.name,
      projectId: projectId ?? this.projectId,
      parentId: parentId ?? this.parentId,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

/// Breadcrumb entry used for folder navigation trail.
class BreadcrumbEntry {
  final String id;
  final String name;

  const BreadcrumbEntry({required this.id, required this.name});
}
