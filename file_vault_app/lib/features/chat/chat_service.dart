import 'package:dio/dio.dart';
import 'package:file_vault_app/core/api/api_client.dart';
import 'package:file_vault_app/features/chat/chat_model.dart';

/// Handles all chat API calls.
/// Every call is scoped by folderId — messages never cross folder boundaries.
///
/// Backend endpoints (to be implemented):
///   GET  /folders/:folderId/messages
///   POST /folders/:folderId/messages
class ChatService {
  final Dio _dio = ApiClient.instance;

  // ── GET /folders/:folderId/messages ─────────────────────────────────────────
  /// Fetches all messages for a specific folder.
  /// Returns newest-last (ascending by createdAt).
  Future<List<ChatMessage>> getMessages(String folderId) async {
    final res = await _dio.get('/folders/$folderId/messages');
    final list = res.data['data']['messages'] as List<dynamic>;
    return list
        .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
        .toList();
  }

  // ── POST /folders/:folderId/messages — send text ─────────────────────────────
  Future<ChatMessage> sendTextMessage({
    required String folderId,
    required String text,
  }) async {
    final res = await _dio.post(
      '/folders/$folderId/messages',
      data: {
        'folderId':    folderId,
        'messageType': 'text',
        'text':        text.trim(),
      },
    );
    return ChatMessage.fromJson(
        res.data['data']['message'] as Map<String, dynamic>);
  }

  // ── POST /folders/:folderId/messages — send file attachment ──────────────────
  /// Attaches an existing folder file to a chat message.
  /// The file must already exist in the folder (uploaded separately).
  Future<ChatMessage> sendFileMessage({
    required String folderId,
    required String fileId,
  }) async {
    final res = await _dio.post(
      '/folders/$folderId/messages',
      data: {
        'folderId':    folderId,
        'messageType': 'file',
        'fileId':      fileId,
      },
    );
    return ChatMessage.fromJson(
        res.data['data']['message'] as Map<String, dynamic>);
  }
}
