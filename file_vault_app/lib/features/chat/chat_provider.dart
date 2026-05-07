import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_vault_app/features/chat/chat_model.dart';
import 'package:file_vault_app/features/chat/chat_service.dart';

/// Family provider — one independent ChatNotifier per folderId.
/// Messages from folder A are NEVER visible in folder B.
final chatProvider = NotifierProviderFamily<ChatNotifier, ChatState, String>(
  ChatNotifier.new,
);

class ChatNotifier extends FamilyNotifier<ChatState, String> {
  final _service = ChatService();

  /// arg == folderId
  @override
  ChatState build(String arg) => const ChatState();

  // ── Load messages ────────────────────────────────────────────────────────────

  Future<void> loadMessages() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final messages = await _service.getMessages(arg);
      state = state.copyWith(messages: messages, isLoading: false);
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: _mapError(e),
      );
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load messages.',
      );
    }
  }

  // ── Send text message ────────────────────────────────────────────────────────

  Future<void> sendText(String text) async {
    if (text.trim().isEmpty) return;
    state = state.copyWith(isSending: true);
    try {
      final msg = await _service.sendTextMessage(
        folderId: arg,
        text: text,
      );
      // Append to end — chat is ascending by time.
      state = state.copyWith(
        messages: [...state.messages, msg],
        isSending: false,
      );
    } on DioException catch (e) {
      state = state.copyWith(
        isSending: false,
        errorMessage: _mapError(e),
      );
    } catch (_) {
      state = state.copyWith(
        isSending: false,
        errorMessage: 'Failed to send message.',
      );
    }
  }

  // ── Send file attachment ─────────────────────────────────────────────────────

  Future<void> sendFileAttachment(String fileId) async {
    state = state.copyWith(isSending: true);
    try {
      final msg = await _service.sendFileMessage(
        folderId: arg,
        fileId: fileId,
      );
      state = state.copyWith(
        messages: [...state.messages, msg],
        isSending: false,
      );
    } on DioException catch (e) {
      state = state.copyWith(
        isSending: false,
        errorMessage: _mapError(e),
      );
    } catch (_) {
      state = state.copyWith(
        isSending: false,
        errorMessage: 'Failed to attach file.',
      );
    }
  }

  // ── Clear error ──────────────────────────────────────────────────────────────

  void clearError() => state = state.copyWith(clearError: true);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  String _mapError(DioException e) {
    final msg = e.response?.data?['error']?['message'] as String?;
    if (msg != null) return msg;
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach server. Check your network.';
    }
    return 'Something went wrong.';
  }
}
