# 🔧 Cloudflare R2 Setup Guide for SecureVault DMS

**Quick setup guide to complete the R2 integration**

---

## 📋 **Step 1: Install Required Dependencies**

```bash
# Navigate to backend directory
cd backend

# Install AWS SDK for R2 compatibility
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Install multer for file upload handling (if needed for future features)
npm install multer @types/multer
```

---

## 🔐 **Step 2: Create Cloudflare R2 Bucket**

### **Option A: Using Cloudflare Dashboard**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage**
3. Click **Create Bucket**
4. Name: `securevault-files` (or your preferred name)
5. **Important**: Keep bucket **PRIVATE** (default)

### **Option B: Using Wrangler CLI**
```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create R2 bucket
wrangler r2 bucket create securevault-files
```

---

## 🔑 **Step 3: Generate R2 API Credentials**

1. In Cloudflare Dashboard → **R2 Object Storage**
2. Click **Manage R2 API tokens**
3. Click **Create API token**
4. **Token name**: `SecureVault-DMS-Token`
5. **Permissions**: 
   - ✅ Object Read
   - ✅ Object Write
   - ✅ Object Delete
6. **Bucket restrictions**: Select your bucket (`securevault-files`)
7. Click **Create API token**
8. **Copy the credentials** (Access Key ID & Secret Access Key)

---

## ⚙️ **Step 4: Update Environment Configuration**

Update `backend/.env` with your actual R2 credentials:

```env
# Existing configuration
DATABASE_URL="postgresql://postgres:4728@localhost:5432/securevault_db"
JWT_SECRET="vault-super-secret-key-change-in-prod"
NODE_ENV="development"
PORT=3000

# R2 Configuration (UPDATE THESE VALUES)
R2_ENDPOINT="https://YOUR-ACCOUNT-ID.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="your-actual-access-key-id"
R2_SECRET_ACCESS_KEY="your-actual-secret-access-key"
R2_BUCKET_NAME="securevault-files"
```

### **Finding Your Account ID**
- In Cloudflare Dashboard → Right sidebar → **Account ID**
- Your endpoint will be: `https://YOUR-ACCOUNT-ID.r2.cloudflarestorage.com`

---

## 🧪 **Step 5: Test the Integration**

### **Start the Backend**
```bash
cd backend
npm run start:dev
```

### **Test Upload Flow**
1. Open frontend application
2. Navigate to a project
3. Click "Upload File"
4. Select a test file
5. Click "Upload to Vault"
6. ✅ Should see success toast notification
7. ✅ File should appear in the project file list

### **Test Download Flow**
1. Click the 3-dots menu on an uploaded file
2. Click "Download"
3. ✅ File should download to your computer

### **Verify in R2 Dashboard**
1. Go to Cloudflare Dashboard → R2 → Your bucket
2. ✅ Should see uploaded files with storage keys like:
   ```
   projects/project-id/timestamp-random-filename.ext
   ```

---

## 🔍 **Step 6: Troubleshooting**

### **Common Issues & Solutions**

#### **"Failed to generate upload URL"**
- ❌ **Cause**: Incorrect R2 credentials or endpoint
- ✅ **Fix**: Double-check `.env` values, ensure Account ID is correct

#### **"Access Denied" during upload**
- ❌ **Cause**: R2 API token lacks permissions
- ✅ **Fix**: Recreate API token with Object Read/Write/Delete permissions

#### **"Bucket not found"**
- ❌ **Cause**: Bucket name mismatch or doesn't exist
- ✅ **Fix**: Verify bucket exists and name matches `R2_BUCKET_NAME`

#### **CORS Issues**
- ❌ **Cause**: R2 bucket CORS not configured for direct uploads
- ✅ **Fix**: Add CORS policy to R2 bucket:
```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "http://localhost:5174"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### **Debug Commands**
```bash
# Check if backend can connect to R2
curl -X POST http://localhost:3000/api/v1/projects/PROJECT_ID/files/upload-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.txt","fileSize":100,"mimeType":"text/plain"}'

# Should return upload URL and storage key
```

---

## 🚀 **Step 7: Production Deployment**

### **Environment Variables for Production**
```env
# Production R2 Configuration
R2_ENDPOINT="https://YOUR-ACCOUNT-ID.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="production-access-key"
R2_SECRET_ACCESS_KEY="production-secret-key"
R2_BUCKET_NAME="securevault-files-prod"

# Update CORS for production domain
# Add your production domain to AllowedOrigins
```

### **Security Checklist**
- ✅ R2 bucket is **PRIVATE** (not public)
- ✅ API tokens have **minimal required permissions**
- ✅ Pre-signed URLs have **short expiry** (1 hour)
- ✅ File type validation is **enabled**
- ✅ File size limits are **enforced**
- ✅ All operations are **audit logged**

---

## 📊 **Step 8: Monitoring & Maintenance**

### **R2 Usage Monitoring**
- Monitor storage usage in Cloudflare Dashboard
- Set up billing alerts for unexpected usage
- Regular cleanup of old/unused files

### **Performance Monitoring**
- Monitor upload/download success rates
- Track API response times
- Monitor error rates in application logs

---

## ✅ **Completion Checklist**

- [ ] Dependencies installed (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- [ ] R2 bucket created and configured as private
- [ ] R2 API credentials generated with correct permissions
- [ ] Environment variables updated in `.env`
- [ ] Backend server restarted
- [ ] Upload flow tested successfully
- [ ] Download flow tested successfully
- [ ] Files visible in R2 dashboard
- [ ] Error handling tested (invalid files, permissions, etc.)
- [ ] Production environment configured (if deploying)

---

**🎉 Once completed, your SecureVault DMS will have full production-grade file storage with Cloudflare R2!**

**Estimated Setup Time**: 15-30 minutes  
**Difficulty**: 🟢 Easy (mostly configuration)