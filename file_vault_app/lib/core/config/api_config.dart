/// Centralized API configuration for production deployment
/// 
/// This file contains all API endpoints and configuration for the FileVault application.
/// All services should import and use this configuration instead of hardcoded URLs.
class ApiConfig {
  // Production backend URL (Railway deployment)
  static const String baseUrl = 'https://filevault-production-1be9.up.railway.app';
  
  // API version prefix
  static const String apiVersion = '/api/v1';
  
  // Full base URL with API version
  static String get fullBaseUrl => '$baseUrl$apiVersion';
  
  // Timeout configurations
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 60); // Longer for file uploads
  
  // API Endpoints
  static const String authLogin = '/auth/login';
  static const String authMe = '/auth/me';
  
  static const String projects = '/projects';
  static const String projectsAccessible = '/projects/accessible';
  
  static const String folders = '/folders';
  static String folderRoot(String projectId) => '/folders/root/$projectId';
  static String folderChildren(String folderId) => '/folders/$folderId/children';
  static String folderUpload(String projectId) => '/projects/$projectId/files/upload';
  
  static const String files = '/files';
  static String fileDownload(String projectId, String fileId) => '/projects/$projectId/files/$fileId/download';
  static String fileOpen(String projectId, String fileId) => '/projects/$projectId/files/$fileId/open';
  static String fileDelete(String projectId, String fileId) => '/projects/$projectId/files/$fileId';
  
  static const String sharing = '/sharing';
  static String shareFile(String projectId, String fileId) => '/projects/$projectId/sharing/files/$fileId/share';
  static String unshareFile(String projectId, String fileId) => '/projects/$projectId/sharing/files/$fileId/share';
  
  static const String chat = '/chat';
  static String chatMessages(String folderId) => '/folders/$folderId/messages';
  static String chatSend(String folderId) => '/folders/$folderId/messages';
  
  static const String adminUsers = '/admin/users';
  static String adminUser(String userId) => '/admin/users/$userId';
  
  static const String search = '/search';
  
  // Environment check
  static bool get isProduction => baseUrl.contains('railway.app');
  static bool get isDevelopment => !isProduction;
  
  // Debug info
  static String get environmentInfo => '''
API Configuration:
- Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
- Base URL: $baseUrl
- Full API URL: $fullBaseUrl
- Connect Timeout: ${connectTimeout.inSeconds}s
- Receive Timeout: ${receiveTimeout.inSeconds}s
- Send Timeout: ${sendTimeout.inSeconds}s
''';
}
