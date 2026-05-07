import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:file_vault_app/routes/app_router.dart';
// import 'package:file_vault_app/features/share_target/shared_file_model.dart';
// import 'package:file_vault_app/features/share_target/destination_selection_screen.dart';
// import 'package:file_vault_app/features/auth/auth_provider.dart';

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

  @override
  Widget build(BuildContext context) {

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
