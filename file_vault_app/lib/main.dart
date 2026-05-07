import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// TEMPORARILY DISABLED: Requires Developer Mode on Windows
// import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:file_vault_app/routes/app_router.dart';
// import 'package:file_vault_app/features/share_target/shared_file_model.dart';
// import 'package:file_vault_app/features/share_target/destination_selection_screen.dart';
import 'package:file_vault_app/features/auth/auth_provider.dart';

void main() {
  runApp(
    const ProviderScope(child: _AppEntry()),
  );
}

/// Thin wrapper that lives inside ProviderScope so we can obtain a
/// ProviderContainer-backed ref to pass to the router.
class _AppEntry extends ConsumerStatefulWidget {
  const _AppEntry();

  @override
  ConsumerState<_AppEntry> createState() => _AppEntryState();
}

class _AppEntryState extends ConsumerState<_AppEntry> {
  // Router is created once and held for the lifetime of the widget.
  late final _router = createRouter(ref);
  
  // SHARE INTENT TEMPORARILY DISABLED - Requires Developer Mode on Windows
  // Share intent subscriptions
  // StreamSubscription? _intentDataStreamSubscription;
  // List<SharedFileModel>? _sharedFiles;

  @override
  void initState() {
    super.initState();
    // _initShareIntent(); // DISABLED
  }

  @override
  void dispose() {
    // _intentDataStreamSubscription?.cancel(); // DISABLED
    super.dispose();
  }

  // ── Initialize share intent handling ──────────────────────────────────────────
  // TEMPORARILY DISABLED - Requires Developer Mode on Windows for symlink support
  /*
  void _initShareIntent() {
    // Create instance
    final receiveSharingIntent = ReceiveSharingIntent.instance;
    
    // Handle share intent when app is already running
    _intentDataStreamSubscription = receiveSharingIntent.getMediaStream().listen(
      (List<SharedMediaFile> value) {
        if (value.isNotEmpty) {
          _handleSharedFiles(value);
        }
      },
      onError: (err) {
        debugPrint('Share intent error: $err');
      },
    );

    // Handle share intent when app is launched from share
    receiveSharingIntent.getInitialMedia().then((List<SharedMediaFile> value) {
      if (value.isNotEmpty) {
        _handleSharedFiles(value);
      }
      // Clear the initial shared data to prevent re-processing
      receiveSharingIntent.reset();
    });
  }

  // ── Handle shared files ───────────────────────────────────────────────────────

  void _handleSharedFiles(List<SharedMediaFile> mediaFiles) {
    final sharedFiles = mediaFiles.map((media) {
      // Determine mime type from file extension or media type
      String mimeType = 'application/octet-stream';
      final path = media.path.toLowerCase();
      
      if (path.endsWith('.pdf')) {
        mimeType = 'application/pdf';
      } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (path.endsWith('.png')) {
        mimeType = 'image/png';
      } else if (path.endsWith('.mp4')) {
        mimeType = 'video/mp4';
      } else if (path.endsWith('.doc')) {
        mimeType = 'application/msword';
      } else if (path.endsWith('.docx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (path.endsWith('.xls')) {
        mimeType = 'application/vnd.ms-excel';
      } else if (path.endsWith('.xlsx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
      
      return SharedFileModel(
        path: media.path,
        name: media.path.split('/').last,
        mimeType: mimeType,
        size: 0, // Size will be calculated when needed
      );
    }).toList();

    setState(() {
      _sharedFiles = sharedFiles;
    });

    // Check if user is logged in
    final authState = ref.read(authProvider);
    if (authState.user == null) {
      // Redirect to login, then continue to destination selection
      _router.go('/login');
    } else {
      // Navigate to destination selection
      _navigateToDestinationSelection();
    }
  }
  */

  // ── Navigate to destination selection ─────────────────────────────────────────
  // DISABLED
  /*
  void _navigateToDestinationSelection() {
    if (_sharedFiles == null || _sharedFiles!.isEmpty) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => DestinationSelectionScreen(
          sharedFiles: _sharedFiles!,
        ),
      ),
    );

    // Clear shared files after navigation
    setState(() {
      _sharedFiles = null;
    });
  }
  */

  @override
  Widget build(BuildContext context) {
    // DISABLED: Share intent listener
    /*
    // If user logs in and we have pending shared files, navigate to destination selection
    ref.listen(authProvider, (previous, next) {
      if (previous?.user == null && next.user != null && _sharedFiles != null) {
        Future.delayed(const Duration(milliseconds: 500), () {
          _navigateToDestinationSelection();
        });
      }
    });
    */

    return MaterialApp.router(
      title: 'FileVault',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      routerConfig: _router,
    );
  }
}
