import 'package:dio/dio.dart';
import 'package:file_vault_app/core/config/api_config.dart';

/// Central Dio instance used by all service classes.
/// Base URL points to the NestJS backend (Railway production deployment).
/// JWT token injection is handled via setToken() method.
class ApiClient {
  ApiClient._();

  static Dio get instance => _instance;

  static final Dio _instance = _buildDio();

  static Dio _buildDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.fullBaseUrl,
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
        sendTimeout: ApiConfig.sendTimeout,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    dio.interceptors.add(_LoggingInterceptor());
    dio.interceptors.add(_AuthInterceptor());
    dio.interceptors.add(_ErrorInterceptor());

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
// Error interceptor — handles network errors and provides user-friendly messages
// ---------------------------------------------------------------------------

class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    String userMessage;
    
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        userMessage = 'Connection timeout. Please check your internet connection.';
        break;
      case DioExceptionType.connectionError:
        userMessage = 'Cannot connect to server. Please check your internet connection.';
        break;
      case DioExceptionType.badResponse:
        final statusCode = err.response?.statusCode;
        if (statusCode == 401) {
          userMessage = 'Session expired. Please login again.';
        } else if (statusCode == 403) {
          userMessage = 'Access denied. You do not have permission.';
        } else if (statusCode == 404) {
          userMessage = 'Resource not found.';
        } else if (statusCode == 500) {
          userMessage = 'Server error. Please try again later.';
        } else {
          userMessage = 'Request failed. Please try again.';
        }
        break;
      case DioExceptionType.cancel:
        userMessage = 'Request cancelled.';
        break;
      default:
        userMessage = 'Network error. Please try again.';
    }
    
    // Attach user-friendly message to the error
    final enhancedError = DioException(
      requestOptions: err.requestOptions,
      response: err.response,
      type: err.type,
      error: err.error,
      message: userMessage,
    );
    
    handler.next(enhancedError);
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
