import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:file_vault_app/routes/app_router.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';
import 'package:file_vault_app/features/share_target/shared_file_model.dart';
import 'package:file_vault_app/features/share_target/share_intent_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: _AppEntry()));
}

class _AppEntry extends ConsumerStatefulWidget {
  const _AppEntry();

  @override
  ConsumerState<_AppEntry> createState() => _AppEntryState();
}

class _AppEntryState extends ConsumerState<_AppEntry> {
  late final _router = createRouter(ref);
  StreamSubscription? _intentSub;

  @override
  void initState() {
    super.initState();
    _restoreAndInit();
  }

  // ── Restore session first, then init share intent ─────────────────────────────
  // Sequential: session must be fully restored before we check auth for share routing.

  Future<void> _restoreAndInit() async {
    // Clear stale share state from any previous session.
    ShareIntentService.instance.clear();
    // Session restoration now handled by SplashScreen for better UX.
    if (mounted) _initShareIntent();
  }

  @override
  void dispose() {
    _intentSub?.cancel();
    super.dispose();
  }

  // ── Share intent initialisation ───────────────────────────────────────────────

  void _initShareIntent() {
    final intent = ReceiveSharingIntent.instance;

    // (a) Cold launch — reset FIRST so the same intent never fires twice
    intent.getInitialMedia().then((files) {
      intent.reset(); // Must be before processing
      if (files.isNotEmpty && mounted) _handleIncomingFiles(files);
    }).catchError((e) {
      debugPrint('[ShareIntent] getInitialMedia error: $e');
    });

    // (b) Hot launch (app already running, new share arrives)
    _intentSub = intent.getMediaStream().listen(
      (files) {
        if (files.isNotEmpty && mounted) _handleIncomingFiles(files);
      },
      onError: (e) => debugPrint('[ShareIntent] stream error: $e'),
    );
  }

  // ── Mime type from extension ──────────────────────────────────────────────────

  String _mimeFromExt(String ext) {
    const map = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'doc': 'application/msword',
      'docx':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip': 'application/zip',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    return map[ext] ?? 'application/octet-stream';
  }

  // ── Route incoming files ──────────────────────────────────────────────────────

  void _handleIncomingFiles(List<SharedMediaFile> raw) {
    _resolveSharedFiles(raw).then((files) {
      if (files.isEmpty || !mounted) return;
      debugPrint('[ShareIntent] ${files.length} file(s) received, storing in provider');
      // Store files — router notifier listens and triggers redirect to /share.
      ref.read(pendingShareProvider.notifier).setFiles(files);
    }).catchError((e) {
      debugPrint('[ShareIntent] resolve error: $e');
    });
  }

  // ── Resolve content:// URIs → real temp files ─────────────────────────────────
  // Android share intents deliver content:// URIs, not file paths.
  // MultipartFile.fromFile() requires a real filesystem path.
  // We copy each file to the app's temp directory first.

  Future<List<SharedFileModel>> _resolveSharedFiles(
      List<SharedMediaFile> raw) async {
    final tempDir = await getTemporaryDirectory();
    final vaultDir = Directory('${tempDir.path}/vault_share');
    if (!await vaultDir.exists()) await vaultDir.create(recursive: true);

    final List<SharedFileModel> result = [];

    for (final m in raw) {
      try {
        final rawPath = m.path;
        String resolvedPath;
        String fileName;

        if (rawPath.startsWith('content://')) {
          // Content URI — must copy to temp file via platform channel
          // receive_sharing_intent already copies the file for us on Android,
          // but the path it returns may still be a content URI on some devices.
          // Use the thumbnail path or copy manually.
          final copied = await _copyContentUri(rawPath, vaultDir);
          if (copied == null) continue;
          resolvedPath = copied.path;
          fileName = copied.path.split('/').last;
        } else {
          // Already a real file path (e.g. /data/user/0/.../cache/...)
          resolvedPath = rawPath;
          fileName = rawPath.split('/').last;
        }

        final ext = fileName.contains('.')
            ? fileName.split('.').last.toLowerCase()
            : '';
        final mimeType = _mimeFromExt(ext);

        int size = 0;
        try {
          size = File(resolvedPath).lengthSync();
        } catch (_) {}

        result.add(SharedFileModel(
          path: resolvedPath,
          name: fileName,
          mimeType: mimeType,
          size: size,
        ));
      } catch (e) {
        debugPrint('[ShareIntent] Failed to resolve file: ${m.path} — $e');
      }
    }

    return result;
  }

  // ── Copy a content:// URI to a real temp file ─────────────────────────────────

  Future<File?> _copyContentUri(String contentUri, Directory destDir) async {
    try {
      // Use Flutter's platform channel to read the content URI bytes
      const channel = MethodChannel('vault_dms/file_utils');
      final bytes = await channel.invokeMethod<Uint8List>(
        'readContentUri',
        {'uri': contentUri},
      );
      if (bytes == null || bytes.isEmpty) return null;

      // Generate a safe filename from the URI
      final uriName = contentUri.split('/').last.split('%2F').last;
      final safeName = uriName.isNotEmpty ? uriName : 'shared_file_${DateTime.now().millisecondsSinceEpoch}';
      final dest = File('${destDir.path}/$safeName');
      await dest.writeAsBytes(bytes);
      return dest;
    } catch (_) {
      // Platform channel not available — the path from receive_sharing_intent
      // should already be a resolved temp path on most devices
      return null;
    }
  }

  // ── Open destination selection screen ────────────────────────────────────────
  // Removed: share flow now uses context.go('/share') via go_router.
  // This keeps the share session completely isolated from the dashboard stack.

  @override
  Widget build(BuildContext context) {
    // After login with pending files, router redirect handles /share routing.
    // No manual navigation needed here.
    return MaterialApp.router(
      title: 'Vault DMS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE65C2F)),
        useMaterial3: true,
      ),
      routerConfig: _router,
    );
  }
}
