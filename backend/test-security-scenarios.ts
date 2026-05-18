import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as dns from 'dns';
import * as assert from 'assert';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://File-vault-db:Naprocs2026@cluster0.wsbg6hx.mongodb.net/filevault?retryWrites=true&w=majority&appName=Cluster0';

// Import Mongoose Schemas directly for lightweight testing
const FolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  path: { type: [mongoose.Schema.Types.ObjectId], ref: 'Folder', default: [] },
}, { timestamps: true });

const FileSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storageKey: { type: String, required: true },
}, { timestamps: true });

const FolderAccessSchema = new mongoose.Schema({
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const FileAccessSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const ProjectMemberSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  isMasterAdmin: { type: Boolean, default: false },
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const Folder = mongoose.models.Folder || mongoose.model('Folder', FolderSchema);
const FileModel = mongoose.models.File || mongoose.model('File', FileSchema);
const FolderAccess = mongoose.models.FolderAccess || mongoose.model('FolderAccess', FolderAccessSchema);
const FileAccess = mongoose.models.FileAccess || mongoose.model('FileAccess', FileAccessSchema);
const ProjectMember = mongoose.models.ProjectMember || mongoose.model('ProjectMember', ProjectMemberSchema);

// Central Permission Engine Ported for testing simulation
async function getAccessibleFolderIds(projectId: string, userId: string): Promise<Set<string>> {
  const projId = new mongoose.Types.ObjectId(projectId);
  const uId = new mongoose.Types.ObjectId(userId);

  const folderAccesses = await FolderAccess.find({ userId: uId });
  const ownedFiles = await FileModel.find({ projectId: projId, ownerId: uId }).select('folderId');
  const sharedFileAccesses = await FileAccess.find({ userId: uId }).populate({
    path: 'fileId',
    match: { projectId: projId },
    select: 'folderId',
  });

  const baseIds = new Set<string>();
  folderAccesses.forEach((fa: any) => {
    if (fa.folderId) baseIds.add(fa.folderId.toString());
  });
  ownedFiles.forEach((f: any) => {
    if (f.folderId) baseIds.add(f.folderId.toString());
  });
  sharedFileAccesses.forEach((sfa: any) => {
    if (sfa.fileId && sfa.fileId.folderId) {
      baseIds.add(sfa.fileId.folderId.toString());
    }
  });

  const foldersWithPaths = await Folder.find({
    _id: { $in: Array.from(baseIds).map(id => new mongoose.Types.ObjectId(id)) }
  }).select('_id parentId path');

  const visibleIds = new Set<string>();
  baseIds.forEach(id => visibleIds.add(id));

  for (const f of foldersWithPaths) {
    if (f.path && f.path.length > 0) {
      f.path.forEach((ancestorId) => {
        visibleIds.add(ancestorId.toString());
      });
    } else if (f.parentId) {
      const allFolders = await Folder.find({ projectId: projId }).select('_id parentId');
      const parentMap = new Map<string, string>();
      allFolders.forEach((fol) => {
        if (fol.parentId) parentMap.set(fol._id.toString(), fol.parentId.toString());
      });
      let curr: string | undefined = f.parentId.toString();
      while (curr && !visibleIds.has(curr)) {
        visibleIds.add(curr);
        curr = parentMap.get(curr);
      }
    }
  }

  return visibleIds;
}

async function getAccessibleFileIds(projectId: string, userId: string): Promise<Set<string>> {
  const projId = new mongoose.Types.ObjectId(projectId);
  const uId = new mongoose.Types.ObjectId(userId);

  const sharedFileAccesses = await FileAccess.find({ userId: uId });
  const ownedFiles = await FileModel.find({ projectId: projId, ownerId: uId }).select('_id');
  const folderAccesses = await FolderAccess.find({ userId: uId });
  
  const sharedFolderIds = folderAccesses.map((fa: any) => fa.folderId);
  const folderFiles = await FileModel.find({
    projectId: projId,
    folderId: { $in: sharedFolderIds },
  }).select('_id');

  const fileIds = new Set<string>();
  sharedFileAccesses.forEach((fa: any) => {
    if (fa.fileId) fileIds.add(fa.fileId.toString());
  });
  ownedFiles.forEach((f: any) => {
    fileIds.add(f._id.toString());
  });
  folderFiles.forEach((f: any) => {
    fileIds.add(f._id.toString());
  });

  return fileIds;
}

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected. Starting security integration tests...');

  // Setup test environment
  const testProjectId = new mongoose.Types.ObjectId().toString();
  const testUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();

  // Create standard breadcrumb path A -> B -> X -> W
  const folderA = await Folder.create({ name: 'Folder A', projectId: testProjectId, parentId: null, path: [] });
  const folderB = await Folder.create({ name: 'Folder B', projectId: testProjectId, parentId: folderA._id, path: [folderA._id] });
  const folderX = await Folder.create({ name: 'Folder X', projectId: testProjectId, parentId: folderB._id, path: [folderA._id, folderB._id] });
  const folderW = await Folder.create({ name: 'Folder W', projectId: testProjectId, parentId: folderX._id, path: [folderA._id, folderB._id, folderX._id] });

  // Create siblings at each level
  const siblingB = await Folder.create({ name: 'Sibling of B', projectId: testProjectId, parentId: folderA._id, path: [folderA._id] });
  const siblingX = await Folder.create({ name: 'Sibling of X', projectId: testProjectId, parentId: folderB._id, path: [folderA._id, folderB._id] });
  const folder2off = await Folder.create({ name: 'Folder 2off', projectId: testProjectId, parentId: null, path: [] });

  // Create files
  const fileInW = await FileModel.create({
    projectId: testProjectId,
    folderId: folderW._id,
    ownerId: adminUserId,
    name: 'Secret Document.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    storageKey: 'secret_key_1',
  });

  const fileInA = await FileModel.create({
    projectId: testProjectId,
    folderId: folderA._id,
    ownerId: adminUserId,
    name: 'Public Guide.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    storageKey: 'public_key_1',
  });

  // Verify Project Member Setup
  await ProjectMember.create({ projectId: testProjectId, userId: testUserId });

  console.log('\n--- Running Scenarios ---');

  // Scenario 1: Share nested folder only (W). Verify siblings are hidden.
  await FolderAccess.create({ folderId: folderW._id, userId: testUserId });
  let visibleFolders = await getAccessibleFolderIds(testProjectId, testUserId);
  
  assert.ok(visibleFolders.has(folderW._id.toString()), 'W should be visible');
  assert.ok(visibleFolders.has(folderX._id.toString()), 'X should be visible (parent of W)');
  assert.ok(visibleFolders.has(folderB._id.toString()), 'B should be visible (ancestor of W)');
  assert.ok(visibleFolders.has(folderA._id.toString()), 'A should be visible (root ancestor of W)');
  assert.strictEqual(visibleFolders.has(siblingB._id.toString()), false, 'Sibling of B must remain hidden');
  assert.strictEqual(visibleFolders.has(siblingX._id.toString()), false, 'Sibling of X must remain hidden');
  assert.strictEqual(visibleFolders.has(folder2off._id.toString()), false, 'Folder 2off must remain hidden');
  console.log('✅ Scenario 1 Passed: Sibling folders successfully hidden under nested sharing.');

  // Scenario 2: Upload file into unrelated folder. Verify hidden.
  const fileIn2off = await FileModel.create({
    projectId: testProjectId,
    folderId: folder2off._id,
    ownerId: adminUserId,
    name: 'Confidential Audit.xlsx',
    mimeType: 'application/octet-stream',
    size: 4096,
    storageKey: 'unrelated_key_1',
  });
  let visibleFiles = await getAccessibleFileIds(testProjectId, testUserId);
  assert.strictEqual(visibleFiles.has(fileIn2off._id.toString()), false, 'Unrelated file must be hidden');
  console.log('✅ Scenario 2 Passed: File uploaded into unauthorized folder remains hidden.');

  // Scenario 3: Refresh app simulation. Verify visibility remains unchanged.
  const visibleFoldersRefresh = await getAccessibleFolderIds(testProjectId, testUserId);
  assert.deepStrictEqual(visibleFolders, visibleFoldersRefresh, 'Visibility must be identical after refresh');
  console.log('✅ Scenario 3 Passed: App refresh simulation returns stable permissions.');

  // Scenario 4: Create sibling folder after share. Verify hidden.
  const siblingW = await Folder.create({ name: 'Sibling of W', projectId: testProjectId, parentId: folderX._id, path: [folderA._id, folderB._id, folderX._id] });
  visibleFolders = await getAccessibleFolderIds(testProjectId, testUserId);
  assert.strictEqual(visibleFolders.has(siblingW._id.toString()), false, 'New sibling folder must remain hidden');
  console.log('✅ Scenario 4 Passed: Newly created sibling folder remains hidden.');

  // Scenario 5: Grant explicit access later. Verify visible only then.
  assert.strictEqual(visibleFolders.has(folder2off._id.toString()), false, 'Folder 2off must be hidden initially');
  await FolderAccess.create({ folderId: folder2off._id, userId: testUserId });
  visibleFolders = await getAccessibleFolderIds(testProjectId, testUserId);
  assert.ok(visibleFolders.has(folder2off._id.toString()), 'Folder 2off must be visible after explicit grant');
  console.log('✅ Scenario 5 Passed: Explicit access granted later successfully updates permissions.');

  // Scenario 6: Deep nested path. Verify only breadcrumb path visible.
  visibleFolders = await getAccessibleFolderIds(testProjectId, testUserId);
  assert.ok(visibleFolders.has(folderA._id.toString()), 'Root A should be visible');
  assert.ok(visibleFolders.has(folderB._id.toString()), 'Path B should be visible');
  assert.ok(visibleFolders.has(folderX._id.toString()), 'Path X should be visible');
  assert.ok(visibleFolders.has(folderW._id.toString()), 'Target W should be visible');
  assert.strictEqual(visibleFolders.has(siblingX._id.toString()), false, 'Sibling of X must be hidden');
  console.log('✅ Scenario 6 Passed: Only the straight breadcrumb ancestry line is visible.');

  // Scenario 7: File-only share. Verify folder visibility behaves correctly.
  const otherUserId = new mongoose.Types.ObjectId().toString();
  await FileAccess.create({ fileId: fileInA._id, userId: otherUserId });
  const otherVisibleFolders = await getAccessibleFolderIds(testProjectId, otherUserId);
  assert.ok(otherVisibleFolders.has(folderA._id.toString()), 'Folder A must become visible to serve navigation to the shared file');
  console.log('✅ Scenario 7 Passed: Direct file share correctly resolves parent folder path.');

  // Scenario 8: Folder-only share. Verify file visibility correct.
  const thirdUserId = new mongoose.Types.ObjectId().toString();
  await FolderAccess.create({ folderId: folderW._id, userId: thirdUserId });
  const thirdVisibleFiles = await getAccessibleFileIds(testProjectId, thirdUserId);
  assert.ok(thirdVisibleFiles.has(fileInW._id.toString()), 'File inside accessible folder W should be visible');
  console.log('✅ Scenario 8 Passed: Folder access successfully grants visibility of child files.');

  console.log('\n🌟 ALL 8 INTEGRATION SECURITY SCENARIOS PASSED SUCCESSFULLY! 🌟\n');

  // Clean up test data
  console.log('Cleaning up test data...');
  await Folder.deleteMany({ projectId: testProjectId });
  await FileModel.deleteMany({ projectId: testProjectId });
  await FolderAccess.deleteMany({ folderId: { $in: [folderA._id, folderB._id, folderX._id, folderW._id, siblingB._id, siblingX._id, folder2off._id, siblingW._id] } });
  await FileAccess.deleteMany({ fileId: { $in: [fileInW._id, fileInA._id, fileIn2off._id] } });
  await ProjectMember.deleteMany({ projectId: testProjectId });
  console.log('Cleanup finished.');

  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
