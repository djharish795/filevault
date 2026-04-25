# 🚀 File Upload - Quick Start

## ✅ Status: Ready to Use

All TypeScript errors fixed. File uploading is fully functional.

---

## 🔧 Setup (2 minutes)

### 1. Start Backend
```bash
cd backend
npm run start:dev
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Login
- Email: `admin@securevault.com`
- Password: `password123`

---

## 📤 How to Upload Files

1. **Navigate to a project** (e.g., "Madhav Home Loan Case")
2. **Click "Upload File"** button
3. **Select files** or drag & drop
4. **Click "Upload to Vault"**
5. ✅ Files appear in the project

---

## 🗄️ Database Status

Run this to verify database:
```bash
cd backend
node test-db.js
```

Expected output:
```
✅ Database connection successful!
📊 Database tables:
  - User
  - Project
  - ProjectMember
  - File
  - AuditLog
📈 Record counts:
  Users: 2
  Projects: 2
  Files: 0
✅ Database is ready for file uploads!
```

---

## 📁 File Upload Flow

```
Frontend (UploadModal)
    ↓
1. POST /api/v1/projects/:id/files/upload-url
    ↓ Backend generates storage key
2. PUT to mock R2 URL (or real R2 if configured)
    ↓ File stored
3. POST /api/v1/projects/:id/files (confirm upload)
    ↓ Metadata saved to database
✅ File appears in project
```

---

## 🔑 API Endpoints

### Upload
```bash
# Get upload URL
POST /api/v1/projects/:projectId/files/upload-url
Body: { fileName, fileSize, mimeType }

# Confirm upload
POST /api/v1/projects/:projectId/files
Body: { fileName, fileSize, mimeType, storageKey }
```

### Download
```bash
GET /api/v1/projects/:projectId/files/:fileId/download-url
```

### Delete
```bash
DELETE /api/v1/projects/:projectId/files/:fileId
```

### Search
```bash
GET /api/v1/search?q=query
```

---

## ✅ Features Working

- ✅ File upload with validation
- ✅ File download with pre-signed URLs
- ✅ File deletion
- ✅ Search functionality
- ✅ Permission-based access control
- ✅ Audit logging
- ✅ Error handling with toast notifications
- ✅ Loading states and spinners

---

## 🔧 Troubleshooting

### "Upload Failed" Error
1. Check backend is running: `npm run start:dev`
2. Check database connection: `node test-db.js`
3. Check browser console for errors

### Files Not Appearing
1. Refresh the page
2. Check browser Network tab for API responses
3. Verify user has upload permission

### Database Connection Error
1. Ensure PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Run: `npx prisma db push`

---

## 🎯 Next Steps

1. ✅ Test file upload
2. ✅ Test file download
3. ✅ Test file deletion
4. ✅ Test search
5. 🔧 Configure R2 credentials (optional, uses mock for now)

---

**Ready to upload files! 🚀**