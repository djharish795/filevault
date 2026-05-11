# Chat Troubleshooting Guide

## 🔍 Issue: Chat Not Showing Messages

### Root Cause Analysis

The chat feature was not working because:

1. **Chat Tab was enabled at root level** - The original code tried to use the project ID as a folder ID when at root
2. **Backend expects folder IDs** - Chat messages are scoped to folders, not projects
3. **Silent failures** - Errors were not being logged properly

### ✅ Fixes Applied

1. **Disabled chat at root level**
   - Chat tab is now disabled when `activeFolderId` is `null`
   - Shows helpful message: "Chat is available inside subfolders"

2. **Added comprehensive logging**
   - Console logs for message loading
   - Console logs for message sending
   - Error details logged to console

3. **Better error handling**
   - Empty message array set even on errors
   - 404 errors handled gracefully (no messages yet)
   - User-friendly error toasts

---

## 🧪 Testing Steps

### Prerequisites

1. **Backend running**: `cd backend && npm run start:dev`
2. **Frontend running**: `cd frontend && npm run dev`
3. **Database migrated**: `cd backend && npx prisma db push`
4. **Test data created**:
   - At least 1 admin user
   - At least 2 regular users
   - At least 1 project
   - At least 2 subfolders in the project

### Step 1: Create Test Folders

```bash
# Login as admin
# Navigate to a project
# Click "New Subfolder" button
# Create folders: "Legal Docs", "Financial Reports"
```

### Step 2: Grant Folder Access

```bash
# As admin, navigate into "Legal Docs" folder
# Click "Share Access" button in app bar (Flutter app)
# OR use backend API directly:

POST http://localhost:3000/api/v1/folders/:folderId/access
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "userId": "<user_id>"
}
```

### Step 3: Test Chat as Admin

1. Login as admin
2. Navigate to project
3. Click into "Legal Docs" subfolder
4. **Verify**: Chat tab is enabled (not disabled)
5. Click "Chat" tab
6. **Verify**: Empty state shows "No messages yet"
7. Type a message: "Hello from admin"
8. Click "Send"
9. **Verify**: Message appears immediately
10. **Check console**: Should see:
    ```
    📤 Sending message to folder <folderId>: Hello from admin
    ✅ Message sent successfully: { id, text, ... }
    ```

### Step 4: Test Chat as Regular User

1. Logout admin
2. Login as regular user (who has access to "Legal Docs")
3. Navigate to "Shared with me"
4. Click the project
5. **Verify**: Only "Legal Docs" folder visible (not "Financial Reports")
6. Click into "Legal Docs"
7. **Verify**: Chat tab is enabled
8. Click "Chat" tab
9. **Verify**: Admin's message "Hello from admin" is visible
10. Type a message: "Hello from user"
11. Click "Send"
12. **Verify**: Message appears immediately
13. **Verify**: Both messages visible in chat

### Step 5: Test Folder Isolation

1. As admin, navigate to "Financial Reports" folder
2. Click "Chat" tab
3. **Verify**: Empty state (no messages from "Legal Docs")
4. Send a message: "Financial discussion"
5. Navigate back to "Legal Docs"
6. **Verify**: "Financial discussion" message NOT visible
7. **Verify**: Only "Legal Docs" messages visible

### Step 6: Test Root Level Behavior

1. Navigate to project root (click "Root" in breadcrumb)
2. **Verify**: Chat tab is disabled (grayed out)
3. Try to click Chat tab
4. **Verify**: Nothing happens (tab is disabled)
5. **Verify**: Files tab still works normally

---

## 🐛 Common Issues & Solutions

### Issue 1: "403 Forbidden" when loading messages

**Cause**: User doesn't have `FolderAccess` permission

**Solution**:
```sql
-- Check folder access
SELECT * FROM "FolderAccess" WHERE "folderId" = '<folder_id>';

-- Grant access (as admin via API)
POST /api/v1/folders/<folder_id>/access
{ "userId": "<user_id>" }
```

### Issue 2: Messages not appearing after send

**Cause**: Backend error or network issue

**Solution**:
1. Open browser console
2. Look for error logs starting with `❌`
3. Check backend logs for errors
4. Verify folder ID is correct (not project ID)

### Issue 3: Chat tab always disabled

**Cause**: `activeFolderId` is always `null`

**Solution**:
1. Verify you're inside a subfolder (not at root)
2. Check breadcrumb shows folder name
3. Check console for folder navigation logs
4. Verify folders are being fetched correctly

### Issue 4: Old messages not loading

**Cause**: API endpoint returning error

**Solution**:
1. Check console for `📨 Loading messages for folder: <id>`
2. Check network tab for `/folders/<id>/messages` request
3. Verify response status (should be 200 or 404)
4. Check backend logs for errors

### Issue 5: User sees messages from wrong folder

**Cause**: `folderId` not updating when navigating

**Solution**:
1. Check `useEffect` dependency array includes `folderId`
2. Verify `activeFolderId` state updates on navigation
3. Check console logs show correct folder ID

---

## 📊 Expected API Calls

### Loading Messages
```
Request:
GET /api/v1/folders/<folder_id>/messages
Authorization: Bearer <token>

Response (success):
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_123",
        "folderId": "folder_456",
        "senderId": "user_789",
        "senderName": "John Doe",
        "messageType": "text",
        "text": "Hello world",
        "attachment": null,
        "createdAt": "2026-05-06T10:30:00.000Z"
      }
    ]
  }
}

Response (no messages):
{
  "success": true,
  "data": {
    "messages": []
  }
}

Response (no access):
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "No access to this folder"
  }
}
```

### Sending Message
```
Request:
POST /api/v1/folders/<folder_id>/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "messageType": "text",
  "text": "Hello world"
}

Response (success):
{
  "success": true,
  "data": {
    "message": {
      "id": "msg_123",
      "folderId": "folder_456",
      "senderId": "user_789",
      "senderName": "John Doe",
      "messageType": "text",
      "text": "Hello world",
      "attachment": null,
      "createdAt": "2026-05-06T10:30:00.000Z"
    }
  }
}
```

---

## 🔧 Debug Checklist

### Frontend Checks
- [ ] Browser console open
- [ ] Network tab open
- [ ] No JavaScript errors
- [ ] API calls showing in network tab
- [ ] Correct folder ID in API calls
- [ ] Token present in Authorization header

### Backend Checks
- [ ] Backend server running on port 3000
- [ ] Database connection working
- [ ] `Message` table exists
- [ ] `FolderAccess` table exists
- [ ] JWT authentication working
- [ ] CORS enabled for frontend origin

### Database Checks
```sql
-- Check if Message table exists
SELECT * FROM "Message" LIMIT 1;

-- Check if FolderAccess table exists
SELECT * FROM "FolderAccess" LIMIT 1;

-- Check folder access for a user
SELECT f.name, fa.* 
FROM "FolderAccess" fa
JOIN "Folder" f ON f.id = fa."folderId"
WHERE fa."userId" = '<user_id>';

-- Check messages in a folder
SELECT m.*, u.name as sender_name
FROM "Message" m
JOIN "User" u ON u.id = m."senderId"
WHERE m."folderId" = '<folder_id>'
ORDER BY m."createdAt" ASC;
```

---

## 🎯 Key Concepts

### Folder-Scoped Chat
- Each folder has its own isolated chat
- Messages are stored with `folderId` in database
- Backend filters messages by `folderId`
- Users can only access chats in folders they have permission for

### Permission Model
- Admin (`isMasterAdmin: true`) can access all folders
- Regular users need explicit `FolderAccess` record
- Access to parent folder does NOT grant access to children
- Access to child folder does NOT grant access to parent

### Chat Availability
- Chat is ONLY available inside subfolders
- Chat is DISABLED at project root level
- Each subfolder has independent chat
- Navigating between folders switches chat context

---

## 📝 Console Log Examples

### Successful Message Load
```
🚀 API Request: [GET] /folders/folder_123/messages
📨 Loading messages for folder: folder_123
✅ API Response: [GET] /folders/folder_123/messages { success: true, data: { messages: [...] } }
✅ Loaded 3 messages
```

### Successful Message Send
```
🚀 API Request: [POST] /folders/folder_123/messages { messageType: 'text', text: 'Hello' }
📤 Sending message to folder folder_123: Hello
✅ API Response: [POST] /folders/folder_123/messages { success: true, data: { message: {...} } }
✅ Message sent successfully: { id: 'msg_456', text: 'Hello', ... }
```

### Permission Denied
```
🚀 API Request: [GET] /folders/folder_123/messages
📨 Loading messages for folder: folder_123
❌ API Error: [GET] /folders/folder_123/messages { success: false, error: { code: 'FORBIDDEN', message: 'No access to this folder' } }
❌ Failed to load messages for folder folder_123: No access to this folder
```

---

## ✅ Success Criteria

- [ ] Admin can send messages in any folder
- [ ] Regular user can send messages in permitted folders
- [ ] Regular user CANNOT access unauthorized folder chats
- [ ] Messages are isolated per folder
- [ ] Chat tab disabled at root level
- [ ] Chat tab enabled inside subfolders
- [ ] Messages appear immediately after send
- [ ] Old messages load when entering folder
- [ ] No console errors
- [ ] No network errors

---

**Last Updated**: May 6, 2026
**Status**: ✅ Fixed and Ready for Testing
