import 'dart:io';

class SharedFileModel {
  final String path;
  final String name;
  final String mimeType;
  final int size;

  const SharedFileModel({
    required this.path,
    required this.name,
    required this.mimeType,
    required this.size,
  });

  String get extension {
    final parts = name.split('.');
    return parts.length > 1 ? parts.last : '';
  }

  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  factory SharedFileModel.fromFile(File file, String mimeType) {
    return SharedFileModel(
      path: file.path,
      name: file.path.split('/').last,
      mimeType: mimeType,
      size: file.lengthSync(),
    );
  }
}
