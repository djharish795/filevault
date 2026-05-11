-- Setup Test Data for Chat Feature Testing
-- Run this after: npx prisma db push

-- ============================================================================
-- STEP 1: Create Test Users
-- ============================================================================

-- Admin user (password: admin123)
INSERT INTO "User" (id, email, password, name, "isMasterAdmin", "createdAt")
VALUES (
  'admin-001',
  'admin@example.com',
  '$2b$10$YourHashedPasswordHere', -- Replace with actual bcrypt hash
  'Admin User',
  true,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Regular user 1 (password: user123)
INSERT INTO "User" (id, email, password, name, "isMasterAdmin", "createdAt")
VALUES (
  'user-001',
  'user1@example.com',
  '$2b$10$YourHashedPasswordHere', -- Replace with actual bcrypt hash
  'John Doe',
  false,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Regular user 2 (password: user123)
INSERT INTO "User" (id, email, password, name, "isMasterAdmin", "createdAt")
VALUES (
  'user-002',
  'user2@example.com',
  '$2b$10$YourHashedPasswordHere', -- Replace with actual bcrypt hash
  'Jane Smith',
  false,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- STEP 2: Create Test Project
-- ============================================================================

INSERT INTO "Project" (id, name, "caseNumber", "createdAt", "updatedAt")
VALUES (
  'project-001',
  'Aparna Ventures Legal Case',
  'CASE-2026-001',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 3: Add Project Members
-- ============================================================================

-- Admin is member
INSERT INTO "ProjectMember" (id, "projectId", "userId")
VALUES (
  'pm-001',
  'project-001',
  'admin-001'
) ON CONFLICT ("projectId", "userId") DO NOTHING;

-- User 1 is member
INSERT INTO "ProjectMember" (id, "projectId", "userId")
VALUES (
  'pm-002',
  'project-001',
  'user-001'
) ON CONFLICT ("projectId", "userId") DO NOTHING;

-- User 2 is member
INSERT INTO "ProjectMember" (id, "projectId", "userId")
VALUES (
  'pm-003',
  'project-001',
  'user-002'
) ON CONFLICT ("projectId", "userId") DO NOTHING;

-- ============================================================================
-- STEP 4: Create Test Folders
-- ============================================================================

-- Root folder 1: Legal Documents
INSERT INTO "Folder" (id, name, "projectId", "parentId", "createdAt")
VALUES (
  'folder-legal',
  'Legal Documents',
  'project-001',
  NULL,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Root folder 2: Financial Reports
INSERT INTO "Folder" (id, name, "projectId", "parentId", "createdAt")
VALUES (
  'folder-finance',
  'Financial Reports',
  'project-001',
  NULL,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Subfolder under Legal: Contracts
INSERT INTO "Folder" (id, name, "projectId", "parentId", "createdAt")
VALUES (
  'folder-contracts',
  'Contracts',
  'project-001',
  'folder-legal',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Subfolder under Legal: Court Filings
INSERT INTO "Folder" (id, name, "projectId", "parentId", "createdAt")
VALUES (
  'folder-court',
  'Court Filings',
  'project-001',
  'folder-legal',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 5: Grant Folder Access
-- ============================================================================

-- User 1 has access to Legal Documents
INSERT INTO "FolderAccess" (id, "folderId", "userId", "grantedAt")
VALUES (
  'fa-001',
  'folder-legal',
  'user-001',
  NOW()
) ON CONFLICT ("folderId", "userId") DO NOTHING;

-- User 1 has access to Contracts
INSERT INTO "FolderAccess" (id, "folderId", "userId", "grantedAt")
VALUES (
  'fa-002',
  'folder-contracts',
  'user-001',
  NOW()
) ON CONFLICT ("folderId", "userId") DO NOTHING;

-- User 2 has access to Financial Reports ONLY
INSERT INTO "FolderAccess" (id, "folderId", "userId", "grantedAt")
VALUES (
  'fa-003',
  'folder-finance',
  'user-002',
  NOW()
) ON CONFLICT ("folderId", "userId") DO NOTHING;

-- ============================================================================
-- STEP 6: Create Test Messages
-- ============================================================================

-- Message 1: Admin in Legal Documents
INSERT INTO "Message" (id, "folderId", "senderId", "messageType", text, "fileId", "createdAt")
VALUES (
  'msg-001',
  'folder-legal',
  'admin-001',
  'text',
  'Welcome to the Legal Documents folder. Please review the contracts.',
  NULL,
  NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- Message 2: User 1 in Legal Documents
INSERT INTO "Message" (id, "folderId", "senderId", "messageType", text, "fileId", "createdAt")
VALUES (
  'msg-002',
  'folder-legal',
  'user-001',
  'text',
  'Thanks! I will review them today.',
  NULL,
  NOW() - INTERVAL '1 hour'
) ON CONFLICT (id) DO NOTHING;

-- Message 3: Admin in Contracts subfolder
INSERT INTO "Message" (id, "folderId", "senderId", "messageType", text, "fileId", "createdAt")
VALUES (
  'msg-003',
  'folder-contracts',
  'admin-001',
  'text',
  'This folder contains all vendor contracts.',
  NULL,
  NOW() - INTERVAL '30 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Message 4: Admin in Financial Reports (User 2 should see this)
INSERT INTO "Message" (id, "folderId", "senderId", "messageType", text, "fileId", "createdAt")
VALUES (
  'msg-004',
  'folder-finance',
  'admin-001',
  'text',
  'Q1 financial reports are ready for review.',
  NULL,
  NOW() - INTERVAL '15 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check users
SELECT id, email, name, "isMasterAdmin" FROM "User";

-- Check project members
SELECT pm.*, u.name as user_name, p.name as project_name
FROM "ProjectMember" pm
JOIN "User" u ON u.id = pm."userId"
JOIN "Project" p ON p.id = pm."projectId";

-- Check folders
SELECT id, name, "projectId", "parentId" FROM "Folder" ORDER BY "parentId" NULLS FIRST;

-- Check folder access
SELECT fa.*, u.name as user_name, f.name as folder_name
FROM "FolderAccess" fa
JOIN "User" u ON u.id = fa."userId"
JOIN "Folder" f ON f.id = fa."folderId"
ORDER BY u.name, f.name;

-- Check messages
SELECT m.*, u.name as sender_name, f.name as folder_name
FROM "Message" m
JOIN "User" u ON u.id = m."senderId"
JOIN "Folder" f ON f.id = m."folderId"
ORDER BY m."createdAt" ASC;

-- ============================================================================
-- EXPECTED TEST RESULTS
-- ============================================================================

/*
ADMIN USER (admin@example.com):
- Can see ALL folders: Legal Documents, Financial Reports, Contracts, Court Filings
- Can see ALL messages in all folders
- Can send messages in any folder

USER 1 (user1@example.com):
- Can see: Legal Documents, Contracts
- CANNOT see: Financial Reports, Court Filings
- Can see messages in: Legal Documents (2 messages), Contracts (1 message)
- Can send messages in: Legal Documents, Contracts

USER 2 (user2@example.com):
- Can see: Financial Reports ONLY
- CANNOT see: Legal Documents, Contracts, Court Filings
- Can see messages in: Financial Reports (1 message)
- Can send messages in: Financial Reports
*/

-- ============================================================================
-- CLEANUP (if needed)
-- ============================================================================

/*
-- Delete test data
DELETE FROM "Message" WHERE id LIKE 'msg-%';
DELETE FROM "FolderAccess" WHERE id LIKE 'fa-%';
DELETE FROM "Folder" WHERE id LIKE 'folder-%';
DELETE FROM "ProjectMember" WHERE id LIKE 'pm-%';
DELETE FROM "Project" WHERE id = 'project-001';
DELETE FROM "User" WHERE id LIKE 'user-%' OR id LIKE 'admin-%';
*/
