import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_vault_app/features/projects/project_model.dart';
import 'package:file_vault_app/features/projects/project_service.dart';

// ─── State ────────────────────────────────────────────────────────────────────

class ProjectListState {
  final List<ProjectModel> projects;
  final bool isLoading;
  final String? errorMessage;

  const ProjectListState({
    this.projects = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  ProjectListState copyWith({
    List<ProjectModel>? projects,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ProjectListState(
      projects: projects ?? this.projects,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

final projectListProvider =
    NotifierProvider<ProjectListNotifier, ProjectListState>(
  ProjectListNotifier.new,
);

class ProjectListNotifier extends Notifier<ProjectListState> {
  final _service = ProjectService();

  @override
  ProjectListState build() => const ProjectListState();

  // ── Load projects ────────────────────────────────────────────────────────────

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final projects = await _service.getProjects();
      state = state.copyWith(projects: projects, isLoading: false);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: _mapError(e));
    } catch (_) {
      state = state.copyWith(
          isLoading: false, errorMessage: 'Failed to load projects.');
    }
  }

  // ── Create project ───────────────────────────────────────────────────────────

  Future<String?> createProject({
    required String name,
    required String caseNumber,
  }) async {
    try {
      final project =
          await _service.createProject(name: name, caseNumber: caseNumber);
      state = state.copyWith(projects: [project, ...state.projects]);
      return null;
    } on DioException catch (e) {
      return _mapError(e);
    } catch (_) {
      return 'Failed to create project.';
    }
  }

  // ── Delete project ───────────────────────────────────────────────────────────

  Future<String?> deleteProject(String projectId) async {
    final previous = state.projects;
    state = state.copyWith(
      projects: state.projects.where((p) => p.id != projectId).toList(),
    );
    try {
      await _service.deleteProject(projectId);
      return null;
    } on DioException catch (e) {
      state = state.copyWith(projects: previous);
      return _mapError(e);
    } catch (_) {
      state = state.copyWith(projects: previous);
      return 'Failed to delete project.';
    }
  }

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
