/// Matches backend Project shape returned by GET /v1/projects
class ProjectModel {
  final String id;
  final String name;
  final String caseNumber;
  final int memberCount;
  final DateTime updatedAt;

  const ProjectModel({
    required this.id,
    required this.name,
    required this.caseNumber,
    required this.memberCount,
    required this.updatedAt,
  });

  factory ProjectModel.fromJson(Map<String, dynamic> json) {
    return ProjectModel(
      id: json['id'] as String,
      name: json['name'] as String,
      caseNumber: json['caseNumber'] as String,
      memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  /// Human-readable relative time label.
  String get updatedLabel {
    final diff = DateTime.now().difference(updatedAt);
    if (diff.inMinutes < 60) return 'Updated ${diff.inMinutes}m ago';
    if (diff.inHours < 24) return 'Updated ${diff.inHours}h ago';
    if (diff.inDays < 7) return 'Updated ${diff.inDays}d ago';
    return 'Updated ${(diff.inDays / 7).floor()}w ago';
  }

  /// Short formatted date.
  String get createdLabel {
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[updatedAt.month - 1]} ${updatedAt.day}, ${updatedAt.year}';
  }
}
