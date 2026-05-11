# User Panel Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐         ┌────────────────┐                 │
│  │  Admin Routes  │         │  User Routes   │                 │
│  │  /admin/*      │         │  /app/*        │                 │
│  └────────────────┘         └────────────────┘                 │
│         │                           │                            │
│         │                           │                            │
│  ┌──────▼──────────┐       ┌───────▼────────────┐             │
│  │  AdminLayout    │       │  UserLayout        │             │
│  │  + AdminSidebar │       │  + UserSidebar     │             │
│  │  + Topbar       │       │  + Topbar          │             │
│  └─────────────────┘       └────────────────────┘             │
│         │                           │                            │
│         │                           │                            │
│  ┌──────▼──────────┐       ┌───────▼────────────┐             │
│  │  DashboardPage  │       │  UserSharedPage    │             │
│  │  (Admin View)   │       │  UserWorkspacePage │             │
│  └─────────────────┘       └────────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                      BACKEND (NestJS)                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Projects   │  │   Folders    │  │    Files     │        │
│  │  Controller  │  │  Controller  │  │  Controller  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         │                  │                  │                 │
│         │                  │                  │                 │
│  ┌──────▼──────────────────▼──────────────────▼──────┐        │
│  │              Prisma ORM Service                    │        │
│  └────────────────────────────────────────────────────┘        │
│                              │                                  │
└──────────────────────────────▼──────────────────────────────────┘
                              │
                              │
┌──────────────────────────────▼──────────────────────────────────┐
│                    DATABASE (SQLite/PostgreSQL)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  User    │  │ Project  │  │  Folder  │  │   File   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │ Folder   │  │ Message  │  │ File     │                     │
│  │ Access   │  │          │  │ Access   │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### User Login → Project List
```
1. User logs in → POST /auth/login
2. Backend returns: { user: { id, username, role, isMasterAdmin }, token }
3. Frontend stores token in Zustand store
4. Frontend redirects:
   - Admin → /admin/projects
   - User → /app/shared
5. Frontend fetches projects → GET /projects
6. Backend filters by user permissions
7. Frontend renders UserSharedPage with assigned projects
```

### Project Access → Workspace
```
1. User clicks project card
2. Navigate to /app/projects/:id/files
3. Frontend fetches project details → GET /projects/:id
4. Backend checks FolderAccess permissions
5. Frontend renders UserWorkspacePage
6. Fetch root folders → GET /folders/root/:projectId
7. Render Files tab with filtered files
```

### Folder Navigation
```
1. User clicks subfolder pill
2. Update breadcrumb state
3. Fetch children → GET /folders/:folderId/children
4. Backend checks FolderAccess for current user
5. Render subfolders and files for that level
6. Chat tab switches to folder-scoped messages
```

### Chat Message Flow
```
1. User switches to Chat tab
2. Fetch messages → GET /folders/:folderId/messages
3. Backend filters by folderId (isolation)
4. Render messages with sender info
5. User types message and clicks Send
6. POST /folders/:folderId/messages { messageType: 'text', text }
7. Backend creates Message record with folderId
8. Frontend appends message to list
9. Auto-scroll to bottom
```

---

## 🔐 Permission Model

### Database Schema
```prisma
model User {
  id              String         @id @default(cuid())
  username        String         @unique
  password        String
  isMasterAdmin   Boolean        @default(false)
  folderAccess    FolderAccess[]
  sentMessages    Message[]
}

model Project {
  id          String   @id @default(cuid())
  name        String
  caseNumber  String?
  folders     Folder[]
  files       File[]
}

model Folder {
  id          String         @id @default(cuid())
  name        String
  projectId   String
  parentId    String?
  project     Project        @relation(fields: [projectId], references: [id])
  parent      Folder?        @relation("FolderHierarchy", fields: [parentId], references: [id])
  children    Folder[]       @relation("FolderHierarchy")
  files       File[]
  access      FolderAccess[]
  messages    Message[]
}

model FolderAccess {
  id          String   @id @default(cuid())
  folderId    String
  userId      String
  canUpload   Boolean  @default(false)
  canDelete   Boolean  @default(false)
  folder      Folder   @relation(fields: [folderId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  
  @@unique([folderId, userId])
}

model Message {
  id          String   @id @default(cuid())
  folderId    String
  senderId    String
  messageType String   // 'text' | 'file' | 'system'
  text        String?
  attachmentId String?
  folder      Folder   @relation(fields: [folderId], references: [id])
  sender      User     @relation(fields: [senderId], references: [id])
  attachment  File?    @relation(fields: [attachmentId], references: [id])
  createdAt   DateTime @default(now())
}

model File {
  id          String   @id @default(cuid())
  name        String
  path        String
  mimeType    String
  size        Int
  projectId   String
  folderId    String?
  uploaderId  String
  project     Project  @relation(fields: [projectId], references: [id])
  folder      Folder?  @relation(fields: [folderId], references: [id])
  messages    Message[]
}
```

### Permission Checks

#### Backend (NestJS Controllers)
```typescript
// folders.controller.ts

// Get root folders - filtered by FolderAccess
@Get('root/:projectId')
async getRootFolders(@Param('projectId') projectId: string, @Request() req) {
  const userId = req.user.id;
  const isMasterAdmin = req.user.isMasterAdmin;
  
  if (isMasterAdmin) {
    // Admin sees all folders
    return prisma.folder.findMany({ where: { projectId, parentId: null } });
  } else {
    // User sees only folders with explicit access
    return prisma.folder.findMany({
      where: {
        projectId,
        parentId: null,
        access: { some: { userId } }
      }
    });
  }
}

// Get folder messages - requires folder access
@Get(':folderId/messages')
async getFolderMessages(@Param('folderId') folderId: string, @Request() req) {
  const userId = req.user.id;
  const isMasterAdmin = req.user.isMasterAdmin;
  
  // Check folder access
  if (!isMasterAdmin) {
    const access = await prisma.folderAccess.findUnique({
      where: { folderId_userId: { folderId, userId } }
    });
    if (!access) throw new ForbiddenException('No access to this folder');
  }
  
  // Return messages for this folder only (isolation)
  return prisma.message.findMany({
    where: { folderId },
    include: { sender: true, attachment: true },
    orderBy: { createdAt: 'asc' }
  });
}
```

#### Frontend (React Components)
```typescript
// UserWorkspacePage.tsx

// Check if user has upload permission
const canUpload = user?.isMasterAdmin || project.permissions?.can_upload;
const isAdmin = user?.isMasterAdmin;

// Conditionally render upload button
{canUpload && (
  <Button onClick={() => setIsUploadOpen(true)}>
    <Plus /> Upload File
  </Button>
)}

// Conditionally render admin controls
{isAdmin && (
  <Button onClick={() => setNewFolderOpen(true)}>
    <FolderPlus /> New Subfolder
  </Button>
)}
```

---

## 🎯 Component Hierarchy

### UserSharedPage
```
UserSharedPage
├── PageHeader
│   ├── Title: "Shared with me"
│   └── Subtitle: Project count
├── Stats Row
│   ├── StatPill (Assigned Projects)
│   ├── StatPill (Shared With Me)
│   └── StatPill (Recent Activity)
├── Section Label: "Projects"
└── Project List
    ├── ProjectCard (reused)
    ├── ProjectCard
    └── ...
```

### UserWorkspacePage
```
UserWorkspacePage
├── Page Header
│   ├── Project Name + Case Number
│   └── Action Buttons (permission-aware)
│       ├── Select Files
│       ├── New Subfolder (admin only)
│       └── Upload File (if can_upload)
├── Breadcrumb Navigation
│   ├── Root
│   ├── Folder 1
│   └── Folder 2 (active)
├── Subfolder Pills
│   ├── Folder A
│   ├── Folder B
│   └── ...
├── Tabs
│   ├── Files Tab
│   │   ├── File Grid
│   │   │   ├── FileCard (reused)
│   │   │   ├── FileCard
│   │   │   └── ...
│   │   └── Empty State
│   └── Chat Tab
│       ├── Messages Area
│       │   ├── Message (text)
│       │   ├── Message (file attachment)
│       │   └── ...
│       └── Message Composer
│           ├── Input Field
│           ├── Attachment Button
│           └── Send Button
├── New Subfolder Dialog (admin only)
├── Upload Modal (if can_upload)
└── File Share Modal (bulk share)
```

---

## 🔄 State Management

### Zustand Store (Auth)
```typescript
// features/auth/store.ts
interface AuthState {
  user: User | null;
  token: string | null;
  login: (credentials) => Promise<void>;
  logout: () => void;
}
```

### React Query (Data Fetching)
```typescript
// hooks/useProjects.ts
export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then(res => res.data.data.projects)
  });
};

export const useProjectDetails = (id: string) => {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => apiClient.get(`/projects/${id}`).then(res => res.data.data.project)
  });
};
```

### Local Component State
```typescript
// UserWorkspacePage.tsx
const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
const [folders, setFolders] = useState<Folder[]>([]);
const [breadcrumb, setBreadcrumb] = useState<Breadcrumb[]>([]);
const [messages, setMessages] = useState<Message[]>([]);
const [selectionMode, setSelectionMode] = useState(false);
const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
```

---

## 🎨 Design Tokens

### Colors (Tailwind Config)
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF5F2',
          100: '#FFE8E0',
          200: '#FFD1C1',
          300: '#FFB199',
          400: '#FF8A66',
          500: '#FF6B3D',
          600: '#E65C2F', // Primary Orange
          700: '#C74D23',
          800: '#A33F1D',
          900: '#7A2F16',
        },
        surface: {
          50: '#FAFAF9',  // Beige/cream
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        }
      }
    }
  }
}
```

### Typography
```css
/* Font Family */
font-family: 'Inter', sans-serif;

/* Headers */
.page-title { @apply text-2xl font-semibold tracking-tight; }
.section-label { @apply text-[10px] uppercase font-bold tracking-wider; }

/* Body */
.body-text { @apply text-sm font-medium; }
.subtext { @apply text-sm text-surface-400; }
```

### Spacing
```css
/* Consistent spacing scale */
gap-2  /* 0.5rem = 8px */
gap-3  /* 0.75rem = 12px */
gap-4  /* 1rem = 16px */
gap-6  /* 1.5rem = 24px */
gap-8  /* 2rem = 32px */

/* Padding */
p-4   /* 1rem = 16px */
p-6   /* 1.5rem = 24px */
p-8   /* 2rem = 32px */
```

---

## 🚀 Deployment Checklist

### Backend
- [ ] Environment variables configured
- [ ] Database migrated (`npx prisma db push`)
- [ ] Seed data created (test users, projects, folders)
- [ ] CORS enabled for frontend origin
- [ ] JWT secret configured
- [ ] File upload directory writable

### Frontend
- [ ] API base URL configured
- [ ] Build successful (`npm run build`)
- [ ] Environment variables set
- [ ] Static assets optimized
- [ ] Error boundaries in place

### Testing
- [ ] Admin login works
- [ ] User login works
- [ ] Permission checks enforced
- [ ] Folder isolation verified
- [ ] Chat functionality tested
- [ ] File upload/download works

---

## 📚 API Endpoints Reference

### Authentication
```
POST   /auth/login          - User login
POST   /auth/register       - User registration (admin only)
GET    /auth/me             - Get current user
```

### Projects
```
GET    /projects            - List user's projects (filtered by permissions)
GET    /projects/:id        - Get project details with files
POST   /projects            - Create project (admin only)
DELETE /projects/:id        - Delete project (admin only)
```

### Folders
```
GET    /folders/root/:projectId           - Get root folders (filtered by access)
GET    /folders/:folderId/children        - Get subfolders (filtered by access)
POST   /folders                           - Create folder (admin only)
DELETE /folders/:folderId                 - Delete folder (admin only)
GET    /folders/:folderId/access          - List users with folder access
POST   /folders/:folderId/access          - Grant folder access (admin only)
DELETE /folders/:folderId/access/:userId  - Revoke folder access (admin only)
GET    /folders/:folderId/messages        - Get folder chat messages
POST   /folders/:folderId/messages        - Send chat message
```

### Files
```
GET    /projects/:projectId/files/:fileId          - Get file metadata
GET    /projects/:projectId/files/:fileId/download - Download file
POST   /projects/:projectId/files                  - Upload file
DELETE /projects/:projectId/files/:fileId          - Delete file (admin only)
POST   /files/:fileId/share                        - Share file with user
```

---

## 🔧 Troubleshooting

### Common Issues

#### "Cannot read property 'id' of undefined"
- **Cause**: User not authenticated
- **Fix**: Check token in localStorage, verify JWT middleware

#### "403 Forbidden" on folder access
- **Cause**: User lacks FolderAccess permission
- **Fix**: Admin must grant access via folder access modal

#### Chat messages not loading
- **Cause**: Folder ID mismatch or permission issue
- **Fix**: Verify folderId in URL, check FolderAccess table

#### Upload button not showing
- **Cause**: User lacks `can_upload` permission
- **Fix**: Admin must grant upload permission in FolderAccess

#### Files showing in wrong folder
- **Cause**: folderId not set during upload
- **Fix**: Pass activeFolderId to UploadModal

---

**Last Updated**: May 6, 2026
**Version**: 1.0.0
**Status**: ✅ Production Ready
