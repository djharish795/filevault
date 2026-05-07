import 'package:dio/dio.dart';
import 'package:file_vault_app/core/api/api_client.dart';
import 'package:file_vault_app/features/files/file_model.dart';
import 'package:file_vault_app/features/folders/folder_model.dart';

/// Handles all folder and file API calls for the folder view screen.
class FolderService {
  final Dio _dio = ApiClient.instance;

  // ── GET /folders/root/:projectId ────────────────────────────────────────────
  Future<List<FolderModel>> getRootFolders(String projectId) async {
    final res = await _dio.get('/folders/root/$projectId');
    final list = res.data['data']['folders'] as List<dynamic>;
    return list.map((f) => FolderModel.fromJson(f as Map<String, dynamic>)).toList();
  }

  // ── GET /folders/:folderId/children ─────────────────────────────────────────
  Future<List<FolderModel>> getChildFolders(String folderId) async {
    final res = await _dio.get('/folders/$folderId/children');
    final list = res.data['data']['folders'] as List<dynamic>;
    return list.map((f) => FolderModel.fromJson(f as Map<String, dynamic>)).toList();
  }

  // ── POST /folders — create subfolder ────────────────────────────────────────
  // Body: { name, projectId, parentId? }
  Future<FolderModel> createFolder({
    required String name,
    required String projectId,
    String? parentId,
  }) async {
    final res = await _dio.post('/folders', data: {
      'name': name,
      'projectId': projectId,
      if (parentId != null) 'parentId': parentId,
    });
    return FolderModel.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  // ── GET /projects/:id — returns files with folderId ─────────────────────────
  // Files are filtered client-side by folderId after fetching.
  Future<List<FileModel>> getFilesForProject(String projectId) async {
    final res = await _dio.get('/projects/$projectId');
    final list = res.data['data']['files'] as List<dynamic>;
    return list.map((f) => FileModel.fromJson(f as Map<String, dynamic>)).toList();
  }

  // ── POST /projects/:projectId/files/upload ──────────────────────────────────
  Future<FileModel> uploadFile({
    required String projectId,
    required String filePath,
    required String fileName,
    required String mimeType,
    String? folderId,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: fileName,
          contentType: DioMediaType.parse(mimeType)),
      if (folderId != null) 'folderId': folderId,
    });
    final res = await _dio.post(
      '/projects/$projectId/files/upload',
      data: formData,
    );
    return FileModel.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  // ── DELETE /projects/:projectId/files/:fileId ───────────────────────────────
  Future<void> deleteFile({
    required String projectId,
    required String fileId,
  }) async {
    await _dio.delete('/projects/$projectId/files/$fileId');
  }

  // ── GET /projects/:projectId/files/:fileId/download ─────────────────────────
  Future<Response> downloadFile({
    required String projectId,
    required String fileId,
  }) async {
    return await _dio.get(
      '/projects/$projectId/files/$fileId/download',
      options: Options(responseType: ResponseType.bytes),
    );
  }

  // ── GET /projects/:projectId/sharing — project members ─────────────────────
  Future<List<ProjectMember>> getProjectMembers(String projectId) async {
    final res = await _dio.get('/projects/$projectId/sharing');
    final list = res.data['data']['people'] as List<dynamic>;
    return list
        .map((p) => ProjectMember.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  // ── GET /admin/users — all users in system (for sharing) ───────────────────
  Future<List<ProjectMember>> getAllUsers() async {
    final res = await _dio.get('/admin/users');
    final list = res.data['data']['users'] as List<dynamic>;
    return list
        .map((u) => ProjectMember.fromJson({
              'userId': u['id'],
              'name': u['name'],
              'email': u['email'],
            }))
        .toList();
  }

  // ── POST /projects/:projectId/sharing/files/:fileId/share ───────────────────
  // Shares ONE file with ONE user. Call once per selected user.
  Future<void> shareFile({
    required String projectId,
    required String fileId,
    required String userId,
  }) async {
    await _dio.post(
      '/projects/$projectId/sharing/files/$fileId/share',
      data: {'userId': userId},
    );
  }

  // ── GET /folders/:folderId/access — who has access to this folder ────────────
  Future<List<ProjectMember>> getFolderAccessList(String folderId) async {
    final res = await _dio.get('/folders/$folderId/access');
    final list = res.data['data']['users'] as List<dynamic>;
    return list
        .map((u) => ProjectMember.fromJson({
              'userId': u['id'],
              'name': u['name'],
              'email': u['email'],
            }))
        .toList();
  }

  // ── POST /folders/:folderId/access — grant user access to a folder ───────────
  Future<void> grantFolderAccess({
    required String folderId,
    required String userId,
  }) async {
    await _dio.post('/folders/$folderId/access', data: {'userId': userId});
  }

  // ── DELETE /folders/:folderId/access/:userId — revoke folder access ──────────
  Future<void> revokeFolderAccess({
    required String folderId,
    required String userId,
  }) async {
    await _dio.delete('/folders/$folderId/access/$userId');
  }
}
