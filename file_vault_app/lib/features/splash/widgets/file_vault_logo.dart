import 'package:flutter/material.dart';

/// FILEVAULT ICON WIDGET
/// Displays the branding image from assets.
class FileVaultLogo extends StatelessWidget {
  final double size;
  const FileVaultLogo({super.key, this.size = 120});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Image.asset(
        'assets/images/logo.png',
        fit: BoxFit.contain,
      ),
    );
  }
}
