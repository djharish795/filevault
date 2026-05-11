# User Panel Testing Checklist

## 🧪 Pre-Testing Setup

### Backend Requirements
- [ ] Backend server running on `http://localhost:3000`
- [ ] Database migrated with latest schema (`npx prisma db push`)
- [ ] Test users created (1 admin, 2+ regular users)
- [ ] Test projects created with folder structure
- [ ] Folder access permissions configured for test users

### Frontend Requirements
- [ ] Frontend dev server running (`npm run dev`)
- [ ] Browser console open for error monitoring
- [ ] Network tab open to monitor API calls

---

## 🔐 Authentication & Authorization

### Login Flow
- [ ] Admin can log in successfully
- [ ] Regular user can log in successfully
- [ ] Admin redirects to `/admin/projects`
- [ ] Regular user redirects to `/app/shared`

### Permission Verification
- [ ] Admin sees all projects
- [ ] Regular user sees only assigned projects
- [ ] Unauthorized project access returns 403/404

---

## 📊 UserSharedPage (`/app/shared`)

### Layout & Design
- [ ] Page title: "Shared with me"
- [ ] Subtitle shows correct project count
- [ ] Stats pills display correctly:
  - [ ] Assigned Projects count
  - [ ] Shared With Me count
  - [ ] Recent Activity shows "Today"
- [ ] Projects section label visible

### Data Loading
- [ ] Loading skeletons appear during fetch
- [ ] Projects load correctly from API
- [ ] Empty state shows when no projects assigned
- [ ] Error state shows on API failure

### Project Cards
- [ ] Each project card displays:
  - [ ] Folder icon
  - [ ] Project name
  - [ ] Case number
  - [ ] Member count
  - [ ] Last updated date
- [ ] Clicking project navigates to `/app/projects/:id/files`

---

## 📁 UserWorkspacePage (`/app/projects/:id/files`)

### Page Header
- [ ] Project name displays correctly
- [ ] Case number displays correctly
- [ ] Action buttons render based on permissions:
  - [ ] "Select Files" button (if files exist)
  - [ ] "New Subfolder" button (admin only)
  - [ ] "Upload File" button (if `can_upload` permission)

### Breadcrumb Navigation
- [ ] "Root" button always visible
- [ ] Clicking "Root" returns to project root
- [ ] Subfolder names appear in breadcrumb
- [ ] Clicking breadcrumb navigates to that level
- [ ] Active level highlighted in brand color

### Subfolder Display
- [ ] Subfolders section shows when folders exist
- [ ] Folder pills display folder icon + name
- [ ] Clicking folder navigates into it
- [ ] Folder list updates when navigating

### Files Tab

#### File Grid
- [ ] Files display in responsive grid
- [ ] File cards show:
  - [ ] File icon (based on type)
  - [ ] File name
  - [ ] Upload date
  - [ ] Uploader avatar
  - [ ] File size
- [ ] Empty state shows when no files
- [ ] Files filtered by active folder

#### Selection Mode
- [ ] "Select Files" button activates selection mode
- [ ] Checkboxes appear on file cards
- [ ] Selected count displays in header
- [ ] "Share Access" button appears when files selected
- [ ] "Delete" button appears for admin when files selected
- [ ] "Cancel" button exits selection mode

#### Bulk Operations
- [ ] Bulk share opens FileShareModal for each file
- [ ] Bulk delete prompts confirmation (admin only)
- [ ] Bulk delete removes files successfully
- [ ] Selection mode exits after operations complete

#### Upload
- [ ] "Upload File" button opens UploadModal
- [ ] Upload works for current folder
- [ ] Files appear in correct folder after upload
- [ ] Upload button hidden if no permission

#### Subfolder Creation (Admin Only)
- [ ] "New Subfolder" button opens dialog
- [ ] Dialog has folder icon + title
- [ ] Input field accepts folder name
- [ ] "Create" button disabled when empty
- [ ] "Cancel" button closes dialog
- [ ] Subfolder created at current level
- [ ] Subfolder appears in folder list
- [ ] Success toast shows after creation

### Chat Tab

#### Layout
- [ ] Tab switches to chat view
- [ ] Chat container has border and rounded corners
- [ ] Messages area scrollable
- [ ] Message composer at bottom

#### Message Display
- [ ] Messages load from API
- [ ] Loading spinner shows during fetch
- [ ] Empty state shows when no messages
- [ ] Messages display with:
  - [ ] Sender avatar (colored circle with initial)
  - [ ] Sender name (or "You" for current user)
  - [ ] Timestamp (12-hour format)
  - [ ] Message bubble (brand-600 for self, surface-100 for others)

#### Text Messages
- [ ] Text messages display correctly
- [ ] Long messages wrap properly
- [ ] Line breaks preserved
- [ ] Emoji render correctly

#### File Attachments
- [ ] File messages show attachment card
- [ ] File icon matches type (PDF, image, generic)
- [ ] File name displays
- [ ] File size displays (KB/MB format)
- [ ] Download button works
- [ ] Downloaded file has correct name

#### Sending Messages
- [ ] Input field accepts text
- [ ] "Send" button disabled when empty
- [ ] Enter key sends message (Shift+Enter for new line)
- [ ] Message appears immediately after send
- [ ] Input clears after send
- [ ] Loading state shows during send
- [ ] Error toast shows on failure
- [ ] Auto-scrolls to new message

#### Folder Isolation
- [ ] Messages only show for current folder
- [ ] Navigating to different folder shows different messages
- [ ] Messages never leak across folders
- [ ] Root folder has separate chat from subfolders

---

## 🔒 Permission Testing

### Regular User (No Upload Permission)
- [ ] "Upload File" button hidden
- [ ] Cannot create subfolders
- [ ] Cannot bulk delete files
- [ ] Can view files
- [ ] Can participate in chat
- [ ] Can select and share files

### Regular User (With Upload Permission)
- [ ] "Upload File" button visible
- [ ] Can upload files successfully
- [ ] Cannot create subfolders
- [ ] Cannot bulk delete files
- [ ] Can view files
- [ ] Can participate in chat

### Admin User
- [ ] All buttons visible
- [ ] Can create subfolders
- [ ] Can bulk delete files
- [ ] Can upload files
- [ ] Can view all projects
- [ ] Can participate in chat

### Folder Access Control
- [ ] User cannot access unauthorized folders (404/403)
- [ ] User can access folders with explicit permission
- [ ] Folder list only shows accessible folders
- [ ] Chat only accessible in permitted folders

---

## 🎨 Design System Verification

### Colors
- [ ] Primary orange (#E65C2F) used for brand elements
- [ ] White background on main content
- [ ] Soft grey borders (surface-200)
- [ ] Beige/cream surface tones (surface-50, surface-100)

### Typography
- [ ] Inter font family
- [ ] Consistent font sizes
- [ ] Proper font weights
- [ ] Correct text colors

### Components
- [ ] Buttons have rounded-full style
- [ ] Cards have rounded-xl style
- [ ] Shadows are subtle (shadow-soft)
- [ ] Hover states work correctly
- [ ] Focus states visible

---

## 📱 Responsive Design (Future)

### Desktop (1920x1080)
- [ ] Sidebar fully visible
- [ ] File grid shows 4-5 columns
- [ ] Chat interface comfortable width

### Tablet (768x1024)
- [ ] Sidebar collapses to drawer
- [ ] File grid shows 2-3 columns
- [ ] Chat interface adapts

### Mobile (375x667)
- [ ] Sidebar drawer only
- [ ] File grid shows 1 column
- [ ] Chat interface full width

---

## 🐛 Error Handling

### Network Errors
- [ ] API timeout shows error message
- [ ] 404 errors handled gracefully
- [ ] 403 errors show permission denied
- [ ] 500 errors show generic error

### User Errors
- [ ] Empty folder name shows validation
- [ ] Empty message cannot be sent
- [ ] File upload errors show toast
- [ ] Delete confirmation prevents accidents

---

## 🚀 Performance

### Load Times
- [ ] Initial page load < 2 seconds
- [ ] Project list loads < 1 second
- [ ] File list loads < 1 second
- [ ] Chat messages load < 1 second

### Interactions
- [ ] Button clicks respond immediately
- [ ] Navigation feels instant
- [ ] File selection smooth
- [ ] Chat scrolling smooth

---

## ✅ Sign-Off

### Functional Testing
- [ ] All features work as expected
- [ ] No console errors
- [ ] No network errors
- [ ] Permissions enforced correctly

### Design Testing
- [ ] Matches design system
- [ ] Consistent spacing
- [ ] Proper alignment
- [ ] Clean visual hierarchy

### Security Testing
- [ ] Folder isolation verified
- [ ] Permission checks working
- [ ] No unauthorized access
- [ ] Backend-driven permissions

---

**Tester Name**: _________________

**Date**: _________________

**Browser**: _________________

**Notes**:
