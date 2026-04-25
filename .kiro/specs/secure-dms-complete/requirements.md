# Requirements Document

## Introduction

Vault DMS is a secure, enterprise-grade Document Management System for banking workflows. It is modelled after Google Drive but with strict access controls suited to regulated environments. The system manages project-based file storage where a Master Admin controls all access, and regular users (lawyers, auditors, etc.) operate within the boundaries set by the admin.

The system is built on a NestJS + PostgreSQL backend and a React + Vite frontend. A significant portion of the core infrastructure is already implemented. This document covers the **complete** system requirements — marking what is already built and what must still be implemented — so that the remaining work can be planned and executed as a single coherent implementation sprint.

**Implementation Status Legend used in Acceptance Criteria:**
- ✅ Already implemented
- 🔲 Not yet implemented / incomplete

---

## Glossary

- **System**: The Vault DMS application as a whole (backend API + frontend UI).
- **Master_Admin**: A user with `isMasterAdmin = true` in the database. Has unrestricted access to all system features.
- **User**: A non-admin authenticated account. Access is limited to assigned projects and shared files.
- **Project**: A named case folder (e.g., "Madhav Home Loan") that groups members and files together.
- **File**: A document stored within a Project. Supported types: PDF, images, Excel, Word, CSV, plain text.
- **ProjectMember**: A join record linking a User to a Project with an assigned role.
- **Role**: A string value assigned per ProjectMember. Valid values: `manager`, `editor`, `viewer`.
- **Permission**: A specific action a User may perform on a Project or File. Derived from the User's Role.
- **FilePermission**: The set of actions (view, download, upload, delete, share) a specific User may perform on a specific File.
- **Bin / Trash**: A soft-delete holding area for files before permanent deletion.
- **AuditLog**: An immutable record of every significant action performed in the System.
- **ShareModal**: The UI dialog through which the Master_Admin assigns or modifies user access to a file or project.
- **JWT**: JSON Web Token used for stateless authentication. Access tokens are short-lived; refresh tokens are stored in HttpOnly cookies.
- **StorageService**: The backend service responsible for persisting files to disk (local) or cloud (R2).

---

## Requirements

---

### Requirement 1: User Authentication

**User Story:** As a User or Master_Admin, I want to log in with my credentials, so that I can securely access the system.

#### Acceptance Criteria

1. ✅ WHEN a user submits a valid email and password, THE System SHALL return a short-lived JWT access token and set an HttpOnly refresh token cookie.
2. ✅ WHEN a user submits an invalid email or password, THE System SHALL return an HTTP 401 response with error code `UNAUTHORIZED`.
3. ✅ WHEN a valid refresh token cookie is present, THE System SHALL issue a new access token without requiring re-login.
4. ✅ WHEN a refresh token is invalid or expired, THE System SHALL clear the cookie and return an HTTP 401 response.
5. ✅ WHILE a user is unauthenticated, THE System SHALL redirect all protected route requests to the login page.
6. ✅ THE System SHALL distinguish Master_Admin accounts from regular User accounts using the `isMasterAdmin` flag in the JWT payload.

---

### Requirement 2: User Management (Admin)

**User Story:** As a Master_Admin, I want to create, view, and delete user accounts and assign them to projects, so that I can control who has access to the system.

#### Acceptance Criteria

1. 🔲 THE System SHALL expose a `POST /v1/admin/users` endpoint that allows the Master_Admin to create a new User with name, email, and password.
2. 🔲 THE System SHALL expose a `GET /v1/admin/users` endpoint that returns a paginated list of all Users.
3. 🔲 THE System SHALL expose a `DELETE /v1/admin/users/:id` endpoint that allows the Master_Admin to delete a User.
4. 🔲 WHEN a User is deleted, THE System SHALL remove all ProjectMember records associated with that User.
5. 🔲 IF a non-Master_Admin calls any `/v1/admin/users` endpoint, THEN THE System SHALL return an HTTP 403 response with error code `FORBIDDEN`.
6. 🔲 THE System SHALL render a User Management page at `/admin/users` that lists all users with their name, email, and assigned projects.
7. 🔲 THE System SHALL provide a "Create User" form on the User Management page with fields for name, email, and password.
8. 🔲 THE System SHALL provide a "Delete User" action on the User Management page with a confirmation dialog before deletion.
9. 🔲 WHEN a User is successfully created or deleted, THE System SHALL display a toast notification confirming the action.

---

### Requirement 3: Project Management

**User Story:** As a Master_Admin, I want to create and manage projects, so that I can organise files and users into case-based workspaces.

#### Acceptance Criteria

1. 🔲 THE System SHALL expose a `POST /v1/projects` endpoint that allows the Master_Admin to create a Project with a name and case number.
2. ✅ THE System SHALL expose a `GET /v1/projects` endpoint that returns all Projects for the Master_Admin and only assigned Projects for a regular User.
3. ✅ THE System SHALL expose a `GET /v1/projects/:id` endpoint that returns project details including files and the requesting user's permissions.
4. 🔲 THE System SHALL expose a `POST /v1/projects/:id/members` endpoint that allows the Master_Admin to add a User to a Project with a specified role.
5. 🔲 THE System SHALL expose a `DELETE /v1/projects/:id/members/:userId` endpoint that allows the Master_Admin to remove a User from a Project.
6. 🔲 THE System SHALL render a "Create Project" dialog accessible from the Admin sidebar "New" button.
7. 🔲 THE "Create Project" dialog SHALL include fields for project name and case number, and a submit button.
8. 🔲 WHEN a Project is successfully created, THE System SHALL navigate the Master_Admin to the new project's file view.
9. 🔲 WHEN a User is added to a Project, THE System SHALL immediately reflect the new project in that User's project list without requiring a page reload.

---

### Requirement 4: File Upload

**User Story:** As a User or Master_Admin, I want to upload files into a project, so that documents are stored securely and linked to the correct case.

#### Acceptance Criteria

1. ✅ THE System SHALL expose a `POST /v1/projects/:id/files/upload` endpoint that accepts a multipart file upload.
2. ✅ WHEN a file is uploaded, THE System SHALL store the file on disk and persist its metadata (name, MIME type, size, storageKey, projectId, ownerId) in the database.
3. ✅ WHEN a file is uploaded, THE System SHALL record a `FILE_UPLOADED` entry in the AuditLog.
4. ✅ IF the uploaded file's MIME type is not in the allowed list (PDF, Word, Excel, images, CSV, plain text), THEN THE System SHALL reject the upload with HTTP 400 and error code `INVALID_FILE_TYPE`.
5. ✅ IF the uploaded file exceeds 50 MB, THEN THE System SHALL reject the upload with HTTP 400.
6. ✅ IF the requesting User does not have upload permission for the project, THEN THE System SHALL reject the upload with HTTP 403 and error code `FORBIDDEN`.
7. ✅ THE System SHALL render an Upload Modal with a drag-and-drop zone and file browser button.
8. ✅ WHEN an upload completes successfully, THE System SHALL refresh the file list in the current project view without a full page reload.
9. 🔲 WHILE an upload is in progress, THE System SHALL display a progress indicator and disable the upload button.

---

### Requirement 5: File Operations (View, Download, Delete, Rename)

**User Story:** As a User or Master_Admin, I want to view, download, delete, and rename files, so that I can manage documents within a project.

#### Acceptance Criteria

1. ✅ THE System SHALL expose a `GET /v1/projects/:id/files/:fileId/download` endpoint that streams the file to the client.
2. ✅ WHEN a file download is requested, THE System SHALL record a `FILE_ACCESSED` entry in the AuditLog.
3. ✅ IF the requesting User does not have view permission for the project, THEN THE System SHALL return HTTP 403.
4. ✅ THE System SHALL expose a `DELETE /v1/projects/:id/files/:fileId` endpoint.
5. ✅ WHEN a file is deleted, THE System SHALL remove the file from disk and delete its database record.
6. ✅ WHEN a file is deleted, THE System SHALL record a `FILE_DELETED` entry in the AuditLog.
7. ✅ IF the requesting User is not the Master_Admin and is not the file owner, THEN THE System SHALL return HTTP 403 on delete.
8. 🔲 THE System SHALL expose a `PATCH /v1/projects/:id/files/:fileId` endpoint that allows the file owner or Master_Admin to rename a file.
9. 🔲 WHEN a file is renamed, THE System SHALL update the `name` field in the database and record a `FILE_RENAMED` entry in the AuditLog.
10. 🔲 THE System SHALL render a Rename dialog when the "Rename" option is selected from the file context menu.
11. 🔲 WHEN a rename is confirmed, THE System SHALL update the file name in the UI without a full page reload.
12. ✅ THE System SHALL render file context menus with actions (Open, Download, Rename, Share, File information, Move to bin) visible only when the User has the corresponding permission.

---

### Requirement 6: Bin / Trash System

**User Story:** As a User or Master_Admin, I want deleted files to go to a Bin before permanent removal, so that accidental deletions can be recovered.

#### Acceptance Criteria

1. 🔲 THE System SHALL add a `deletedAt` nullable timestamp field to the File model in the database schema.
2. 🔲 WHEN a file is "deleted" via the UI, THE System SHALL set `deletedAt` to the current timestamp rather than removing the database record (soft delete).
3. 🔲 THE System SHALL expose a `GET /v1/admin/trash` endpoint that returns all soft-deleted files accessible to the requesting user.
4. 🔲 THE System SHALL expose a `POST /v1/projects/:id/files/:fileId/restore` endpoint that clears `deletedAt` and restores the file to its project.
5. 🔲 THE System SHALL expose a `DELETE /v1/projects/:id/files/:fileId/permanent` endpoint that permanently deletes the file from disk and database.
6. 🔲 WHILE a file has a non-null `deletedAt`, THE System SHALL exclude it from all project file listings and search results.
7. 🔲 THE System SHALL render a Recycle Bin page at `/admin/trash` listing all soft-deleted files with restore and permanent-delete actions.
8. 🔲 IF a non-Master_Admin attempts to access the Recycle Bin page, THEN THE System SHALL redirect them to their project list.

---

### Requirement 7: Permission System

**User Story:** As a Master_Admin, I want to assign granular permissions to users per project, so that each user can only perform the actions appropriate to their role.

#### Acceptance Criteria

1. ✅ THE System SHALL derive file permissions from the ProjectMember role: `manager` → view, upload, download, delete, share; `editor` → view, upload, download; `viewer` → view, download only.
2. ✅ THE System SHALL grant the Master_Admin all permissions on all projects and files regardless of ProjectMember records.
3. ✅ THE System SHALL grant the file owner delete and share permissions on their own files regardless of their project role.
4. ✅ WHEN a project detail is fetched, THE System SHALL include a `permissions` object in the response reflecting the requesting user's effective permissions.
5. 🔲 THE System SHALL expose a `PATCH /v1/projects/:id/members/:userId` endpoint that allows the Master_Admin to change a ProjectMember's role.
6. 🔲 WHEN a ProjectMember's role is changed, THE System SHALL immediately reflect the updated permissions in subsequent API responses for that user.
7. 🔲 THE System SHALL hide or disable UI actions (upload button, delete option, share option) when the current user lacks the corresponding permission.
8. 🔲 THE System SHALL enforce all permission checks on the backend regardless of frontend UI state.

---

### Requirement 8: Sharing System

**User Story:** As a Master_Admin or file owner, I want to share files and projects with specific users and assign them roles, so that the right people have access to the right documents.

#### Acceptance Criteria

1. 🔲 THE System SHALL expose a `POST /v1/projects/:id/files/:fileId/share` endpoint that accepts a list of user IDs and a role, and creates or updates FilePermission records.
2. 🔲 WHEN a file is shared with a User, THE System SHALL immediately make the file visible in that User's "Shared with me" view without requiring a page reload.
3. 🔲 THE System SHALL render a Share Modal accessible from the file context menu "Share" option.
4. 🔲 THE Share Modal SHALL fetch and display the real list of users who currently have access to the file from the backend.
5. 🔲 THE Share Modal SHALL allow the Master_Admin to search for users by name or email and add them with a selected role (Viewer, Editor, Manager).
6. 🔲 THE Share Modal SHALL allow the Master_Admin to change an existing user's role via a dropdown.
7. 🔲 THE Share Modal SHALL allow the Master_Admin to remove a user's access via a "Remove access" option.
8. 🔲 WHEN sharing changes are saved, THE System SHALL call the backend API and display a success or error toast notification.
9. 🔲 IF a User without share permission attempts to open the Share Modal, THEN THE System SHALL display an "Access Denied" toast and not open the modal.

---

### Requirement 9: Search

**User Story:** As a User or Master_Admin, I want to search for files by name, so that I can quickly locate documents across my accessible projects.

#### Acceptance Criteria

1. ✅ THE System SHALL expose a `GET /v1/search?q=<query>` endpoint that returns files matching the query string.
2. ✅ WHEN a search is performed, THE System SHALL only return files in projects the requesting User is a member of (or all projects for Master_Admin).
3. ✅ IF the search query is fewer than 2 characters, THEN THE System SHALL return HTTP 400 with error code `BAD_REQUEST`.
4. ✅ THE System SHALL return search results ordered by `updatedAt` descending, limited to 20 results.
5. 🔲 THE System SHALL render a search results view that displays matching files with their project name, owner, size, and last-modified date.
6. 🔲 WHILE a search is in progress, THE System SHALL display a loading indicator in the search bar.
7. 🔲 WHEN search results are returned, THE System SHALL display the result count and allow the user to navigate to the file's parent project.
8. 🔲 WHILE a file has a non-null `deletedAt`, THE System SHALL exclude it from all search results.

---

### Requirement 10: Recent Documents

**User Story:** As a User or Master_Admin, I want to see recently accessed or uploaded files, so that I can quickly return to documents I was working on.

#### Acceptance Criteria

1. 🔲 THE System SHALL expose a `GET /v1/recent` endpoint that returns the 20 most recently created or accessed files for the requesting User, filtered by their permissions.
2. 🔲 THE System SHALL render a Recent Documents page at `/app/recent` and `/admin/recent` that lists files returned by the recent endpoint.
3. 🔲 WHEN a file is uploaded or downloaded, THE System SHALL update the recent activity record for that User.

---

### Requirement 11: Audit Logging

**User Story:** As a Master_Admin, I want to view a complete audit trail of all file and user actions, so that I can ensure compliance and investigate incidents.

#### Acceptance Criteria

1. ✅ THE System SHALL record an AuditLog entry for every file upload, download, and deletion, including the userId, projectId, fileId, and a metadata JSON object.
2. 🔲 THE System SHALL record an AuditLog entry for every user creation, deletion, and role change.
3. 🔲 THE System SHALL record an AuditLog entry for every login and logout event.
4. 🔲 THE System SHALL expose a `GET /v1/admin/audit` endpoint that returns paginated AuditLog entries, filterable by userId, projectId, and action type.
5. 🔲 IF a non-Master_Admin calls the `/v1/admin/audit` endpoint, THEN THE System SHALL return HTTP 403.
6. 🔲 THE System SHALL render a Security Audit Logs page at `/admin/audit` that displays the audit log table with filters for user, project, action, and date range.

---

### Requirement 12: Role-Based UI Visibility

**User Story:** As a User, I want the interface to only show me actions I am permitted to perform, so that I am not confused by options that will be denied.

#### Acceptance Criteria

1. ✅ THE System SHALL render the Admin sidebar (with User Management, Global Roles, Audit Logs, Recycle Bin) only when the authenticated user is a Master_Admin.
2. ✅ THE System SHALL render the User sidebar (My Cases, Shared with me, Recent Documents) for non-admin users.
3. 🔲 THE System SHALL hide the "Upload File" button on a project page when the current User's role is `viewer`.
4. 🔲 THE System SHALL hide the "Delete" option in the file context menu when the current User lacks delete permission for that file.
5. 🔲 THE System SHALL hide the "Share" option in the file context menu when the current User lacks share permission for that file.
6. 🔲 THE System SHALL hide the "Rename" option in the file context menu when the current User is not the file owner and is not the Master_Admin.
7. 🔲 THE System SHALL render the "New" button in the Admin sidebar as a dropdown with "New folder" (create project) and "File upload" options.
8. 🔲 WHEN the "New folder" option is selected outside of a project context, THE System SHALL open the Create Project dialog.

---

### Requirement 13: Error Handling

**User Story:** As a User or Master_Admin, I want the system to handle errors gracefully and inform me of what went wrong, so that I can take corrective action.

#### Acceptance Criteria

1. ✅ IF a file upload fails due to a network error, THEN THE System SHALL display a destructive toast notification with a descriptive message.
2. ✅ IF a file download fails, THEN THE System SHALL display a destructive toast notification.
3. ✅ IF a file deletion fails, THEN THE System SHALL display a destructive toast notification.
4. ✅ IF a user attempts an action they are not permitted to perform, THEN THE System SHALL display an "Access Denied" toast notification.
5. ✅ IF a project fails to load, THEN THE System SHALL render an error boundary with a descriptive message.
6. 🔲 IF a user creation fails due to a duplicate email, THEN THE System SHALL display a toast notification with the message "A user with this email already exists."
7. 🔲 IF a project creation fails, THEN THE System SHALL display a toast notification with the specific error message returned by the backend.
8. 🔲 IF a share operation fails, THEN THE System SHALL display a toast notification and leave the Share Modal open so the user can retry.

---

### Requirement 14: Security

**User Story:** As a banking institution, I want all data access to be strictly controlled and audited, so that sensitive documents are never exposed to unauthorised parties.

#### Acceptance Criteria

1. ✅ THE System SHALL require a valid JWT access token on every API endpoint except `POST /v1/auth/login` and `POST /v1/auth/refresh`.
2. ✅ THE System SHALL store refresh tokens in HttpOnly cookies to prevent JavaScript access.
3. ✅ THE System SHALL validate file type and size on the backend regardless of frontend validation.
4. ✅ THE System SHALL enforce project membership checks on the backend before returning any project or file data.
5. 🔲 THE System SHALL hash all user passwords using bcrypt with a minimum cost factor of 10 before storing them in the database.
6. 🔲 THE System SHALL validate that the `projectId` in the URL matches the file's actual `projectId` in the database before serving any file operation.
7. 🔲 THE System SHALL rate-limit the `POST /v1/auth/login` endpoint to a maximum of 10 requests per minute per IP address.
8. 🔲 THE System SHALL set `Secure`, `HttpOnly`, and `SameSite=Strict` flags on all authentication cookies in production.

---

### Requirement 15: Data Integrity

**User Story:** As a system operator, I want the database and file storage to remain consistent, so that no orphaned records or missing files occur.

#### Acceptance Criteria

1. ✅ WHEN a file is deleted from the database, THE System SHALL also delete the corresponding file from disk storage.
2. ✅ IF a database write fails during file upload, THEN THE System SHALL delete the already-written disk file to prevent orphaned storage.
3. ✅ WHEN a Project is deleted, THE System SHALL cascade-delete all associated ProjectMember and File records (enforced by Prisma `onDelete: Cascade`).
4. ✅ WHEN a User is deleted, THE System SHALL cascade-delete all associated ProjectMember and File records.
5. 🔲 THE System SHALL enforce a unique constraint on `(projectId, userId)` in the ProjectMember table to prevent duplicate membership records.
6. 🔲 WHEN a soft-deleted file is permanently deleted, THE System SHALL remove the file from disk storage and delete the database record.
