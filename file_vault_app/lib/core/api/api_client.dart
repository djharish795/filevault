import 'package:dio/dio.dart';

/// Central Dio instance used by all service classes.
/// Base URL points to the NestJS backend.
/// JWT token injection will be wired in once auth is implemented.
class ApiClient {
  ApiClient._();

  // 10.0.2.2 is the Android emulator's alias for the host machine (your PC).
  // Use this instead of localhost — localhost inside the emulator points to
  // the emulator itself, not your Windows machine where the backend runs.
  static const String _baseUrl = 'http://10.0.2.2:3000/api/v1';

  static Dio get instance => _instance;

  static final Dio _instance = _buildDio();

  static Dio _buildDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    dio.interceptors.add(_LoggingInterceptor());
    dio.interceptors.add(_AuthInterceptor());

    return dio;
  }

  /// Call this after login to attach the JWT token to every request.
  static void setToken(String token) {
    _instance.options.headers['Authorization'] = 'Bearer $token';
  }

  /// Call this on logout to remove the token.
  static void clearToken() {
    _instance.options.headers.remove('Authorization');
  }
}

// ---------------------------------------------------------------------------
// Logging interceptor — prints method, path, status for every request
// ---------------------------------------------------------------------------

class _LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // ignore: avoid_print
    print('[API] --> ${options.method} ${options.path}');
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    // ignore: avoid_print
    print('[API] <-- ${response.statusCode} ${response.requestOptions.path}');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // ignore: avoid_print
    print(
      '[API] ERR ${err.response?.statusCode} '
      '${err.requestOptions.path} — ${err.message}',
    );
    handler.next(err);
  }
}

// ---------------------------------------------------------------------------
// Auth interceptor — placeholder for token refresh logic (Phase 2)
// ---------------------------------------------------------------------------

class _AuthInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // 401 handling / token refresh will be implemented in the auth feature.
    // For now, pass the error through unchanged.
    handler.next(err);
  }
}
