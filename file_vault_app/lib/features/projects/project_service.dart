import 'package:dio/dio.dart';
import 'package:file_vault_app/core/api/api_client.dart';
import 'package:file_vault_app/features/projects/project_model.dart';

/// Handles all project-level API calls.
class ProjectService {
  final Dio _dio = ApiClient.instance;

  // ── GET /v1/projects ─────────────────────────────────────────────────────────
  Future<List<ProjectModel>> getProjects() async {
    final res = await _dio.get('/projects');
    final list = res.data['data'] as List<dynamic>;
    return list
        .map((p) => ProjectModel.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  // ── POST /v1/projects — admin only ───────────────────────────────────────────
  Future<ProjectModel> createProject({
    required String name,
    String? caseNumber,
  }) async {
    final res = await _dio.post('/projects', data: {
      'name': name.trim(),
      if (caseNumber != null && caseNumber.trim().isNotEmpty) 'caseNumber': caseNumber.trim(),
    });
    return ProjectModel.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  // ── DELETE /v1/projects/:id — admin only ─────────────────────────────────────
  Future<void> deleteProject(String projectId) async {
    await _dio.delete('/projects/$projectId');
  }

  // ── PATCH /v1/projects/:id — admin only ──────────────────────────────────────
  Future<void> updateProject(String projectId, String name, [String? caseNumber]) async {
    final data = <String, dynamic>{'name': name};
    if (caseNumber != null) data['caseNumber'] = caseNumber;
    await _dio.patch('/projects/$projectId', data: data);
  }
}
