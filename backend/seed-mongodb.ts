import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://File-vault-db:Naprocs2026@ac-bftiknf-shard-00-00.wsbg6hx.mongodb.net:27017/?ssl=true&authSource=admin&directConnection=true';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  isMasterAdmin: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const password = await bcrypt.hash('naprocs2026', 10);

  console.log('Upserting Master Admin...');
  await User.findOneAndUpdate(
    { email: 'siva@filevault.com' },
    {
      email: 'siva@filevault.com',
      password,
      name: 'Master Admin',
      isMasterAdmin: true,
    },
    { upsert: true, new: true }
  );

  console.log('\n✅ Seed complete!\n');
  console.log('ADMIN');
  console.log('  siva@filevault.com  /  naprocs2026\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
