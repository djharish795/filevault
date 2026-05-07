import 'package:flutter/material.dart';
import 'package:file_vault_app/features/folders/folder_screen.dart';

/// Project detail screen — renders the root FolderScreen for this project.
/// Receives [projectId] and [projectName] via go_router path parameter + extra.
class ProjectScreen extends StatelessWidget {
  final String projectId;
  final String projectName;

  const ProjectScreen({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    // The root of a project is a FolderScreen with no folderId.
    // This shows all root-level folders and files for the project.
    return FolderScreen(
      projectId: projectId,
      projectName: projectName,
      folderId: null,
      folderName: null,
    );
  }
}
