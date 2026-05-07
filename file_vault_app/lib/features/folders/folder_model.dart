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
      projectId: json['projectId'] as String,
      parentId: json['parentId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Breadcrumb entry used for folder navigation trail.
class BreadcrumbEntry {
  final String id;
  final String name;

  const BreadcrumbEntry({required this.id, required this.name});
}
