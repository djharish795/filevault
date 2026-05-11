


import 'package:file_vault_app/features/files/file_model.dart';

/// Message types that can appear in a folder chat.
enum ChatMessageType { text, file, system }

/// A single chat message scoped to a folder.
/// Matches the backend contract for POST/GET /folders/:id/messages.
class ChatMessage {
  final String id;
  final String folderId;
  final String senderId;
  final String senderName;
  final ChatMessageType type;

  /// Non-null when type == text or system.
  final String? text;

  /// Non-null when type == file — the attached file metadata.
  final ChatAttachment? attachment;

  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.folderId,
    required this.senderId,
    required this.senderName,
    required this.type,
    this.text,
    this.attachment,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final typeStr = json['messageType'] as String? ?? 'text';
    final type = switch (typeStr) {
      'file'   => ChatMessageType.file,
      'system' => ChatMessageType.system,
      _        => ChatMessageType.text,
    };

    return ChatMessage(
      id:          json['id'] as String,
      folderId:    json['folderId'] as String,
      senderId:    json['senderId'] as String,
      senderName:  json['senderName'] as String? ?? 'Unknown',
      type:        type,
      text:        json['text'] as String?,
      attachment:  json['attachment'] != null
          ? ChatAttachment.fromJson(
              json['attachment'] as Map<String, dynamic>)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
    'folderId':    folderId,
    'messageType': type.name,
    if (text != null) 'text': text,
    if (attachment != null) 'fileId': attachment!.fileId,
  };

  /// Initials for sender avatar.
  String get senderInitials {
    final parts = senderName.trim().split(' ')
        .where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  /// Formatted time string in IST (HH:MM AM/PM).
  String get timeLabel {
    // Backend sends UTC ISO string. Convert to device local time (IST = UTC+5:30).
    final local = createdAt.toLocal();
    final hour   = local.hour;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? 'PM' : 'AM';
    final h12    = hour % 12 == 0 ? 12 : hour % 12;
    return '$h12:$minute $period';
  }
}

/// File attachment metadata embedded in a chat message.
class ChatAttachment {
  final String fileId;
  final String fileName;
  final String mimeType;
  final int size;

  const ChatAttachment({
    required this.fileId,
    required this.fileName,
    required this.mimeType,
    required this.size,
  });

  factory ChatAttachment.fromJson(Map<String, dynamic> json) {
    return ChatAttachment(
      fileId:   json['fileId'] as String,
      fileName: json['fileName'] as String,
      mimeType: json['mimeType'] as String? ?? '',
      size:     (json['size'] as num?)?.toInt() ?? 0,
    );
  }

  /// Human-readable size.
  String get formattedSize {
    if (size < 1024) { return '$size B'; }
    if (size < 1024 * 1024) {
      return '${(size / 1024).toStringAsFixed(1)} KB';
    }
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  FileCategory get category {
    if (mimeType.contains('pdf')) { return FileCategory.pdf; }
    if (mimeType.contains('image')) { return FileCategory.image; }
    if (mimeType.contains('sheet') ||
        mimeType.contains('excel') ||
        mimeType.contains('csv')) { return FileCategory.spreadsheet; }
    if (mimeType.contains('word') ||
        mimeType.contains('document')) { return FileCategory.document; }
    return FileCategory.generic;
  }
}

/// Immutable chat state for a single folder.
class ChatState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final bool isSending;
  final String? errorMessage;

  const ChatState({
    this.messages = const [],
    this.isLoading = false,
    this.isSending = false,
    this.errorMessage,
  });

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    bool? isSending,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ChatState(
      messages:     messages     ?? this.messages,
      isLoading:    isLoading    ?? this.isLoading,
      isSending:    isSending    ?? this.isSending,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
