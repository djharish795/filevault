const mongoose = require('mongoose');

const uri = 'mongodb+srv://File-vault-db:Naprocs2026@cluster0.wsbg6hx.mongodb.net/filevault?retryWrites=true&w=majority&appName=Cluster0';

async function test() {
  console.log('Testing direct connection to shard 00-00...');
  try {
    await mongoose.connect(uri);
    console.log('✅ Success! Connected directly to shard.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Failed direct connection:', err.message);

    console.log('\nTesting shard 00-01...');
    const uri2 = uri.replace('00-00', '00-01');
    try {
      await mongoose.connect(uri2);
      console.log('✅ Success! Connected directly to shard 01.');
      await mongoose.disconnect();
    } catch (err2) {
      console.error('❌ Failed direct connection to 01:', err2.message);
    }
  }
}

test();
