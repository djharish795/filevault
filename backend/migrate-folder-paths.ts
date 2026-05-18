import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as dns from 'dns';

dotenv.config();

// Bypass local DNS issues for MongoDB SRV lookups
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://File-vault-db:Naprocs2026@cluster0.wsbg6hx.mongodb.net/filevault?retryWrites=true&w=majority&appName=Cluster0';

const FolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  path: { type: [mongoose.Schema.Types.ObjectId], ref: 'Folder', default: [] },
});

const Folder = mongoose.model('Folder', FolderSchema);

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected. Starting folder path migration...');

  const allFolders = await Folder.find({});
  console.log(`Found ${allFolders.length} folders in database.`);

  const folderMap = new Map<string, any>();
  allFolders.forEach(f => folderMap.set(f._id.toString(), f));

  function getAncestryPath(folder: any): mongoose.Types.ObjectId[] {
    const path: mongoose.Types.ObjectId[] = [];
    let parentId = folder.parentId;
    while (parentId) {
      const parent = folderMap.get(parentId.toString());
      if (!parent) break;
      path.unshift(parent._id); // Root is first, immediate parent is last
      parentId = parent.parentId;
    }
    return path;
  }

  let migratedCount = 0;
  for (const folder of allFolders) {
    const path = getAncestryPath(folder);
    folder.path = path;
    await folder.save();
    migratedCount++;
    console.log(`Migrated folder "${folder.name}" with path [${path.map(id => id.toString()).join(', ')}]`);
  }

  console.log(`\n✅ Migration complete! Successfully updated ${migratedCount} folders.\n`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
