/**
 * Seed script for chat feature testing
 * Run: node seed-chat-test.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding chat test data...\n');

  // ============================================================================
  // STEP 1: Create Test Users
  // ============================================================================
  console.log('👤 Creating test users...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      isMasterAdmin: true,
    },
  });
  console.log(`  ✅ Admin: ${admin.email} (password: admin123)`);

  const user1 = await prisma.user.upsert({
    where: { email: 'user1@example.com' },
    update: {},
    create: {
      email: 'user1@example.com',
      password: userPassword,
      name: 'John Doe',
      isMasterAdmin: false,
    },
  });
  console.log(`  ✅ User 1: ${user1.email} (password: user123)`);

  const user2 = await prisma.user.upsert({
    where: { email: 'user2@example.com' },
    update: {},
    create: {
      email: 'user2@example.com',
      password: userPassword,
      name: 'Jane Smith',
      isMasterAdmin: false,
    },
  });
  console.log(`  ✅ User 2: ${user2.email} (password: user123)\n`);

  // ============================================================================
  // STEP 2: Create Test Project
  // ============================================================================
  console.log('📁 Creating test project...');

  const project = await prisma.project.upsert({
    where: { id: 'project-test-001' },
    update: {},
    create: {
      id: 'project-test-001',
      name: 'Aparna Ventures Legal Case',
      caseNumber: 'CASE-2026-001',
    },
  });
  console.log(`  ✅ Project: ${project.name} (${project.caseNumber})\n`);

  // ============================================================================
  // STEP 3: Add Project Members
  // ============================================================================
  console.log('👥 Adding project members...');

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: admin.id,
    },
  });
  console.log(`  ✅ ${admin.name} added to project`);

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: user1.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: user1.id,
    },
  });
  console.log(`  ✅ ${user1.name} added to project`);

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: user2.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: user2.id,
    },
  });
  console.log(`  ✅ ${user2.name} added to project\n`);

  // ============================================================================
  // STEP 4: Create Test Folders
  // ============================================================================
  console.log('📂 Creating test folders...');

  const legalFolder = await prisma.folder.upsert({
    where: { id: 'folder-legal-001' },
    update: {},
    create: {
      id: 'folder-legal-001',
      name: 'Legal Documents',
      projectId: project.id,
      parentId: null,
    },
  });
  console.log(`  ✅ Root folder: ${legalFolder.name}`);

  const financeFolder = await prisma.folder.upsert({
    where: { id: 'folder-finance-001' },
    update: {},
    create: {
      id: 'folder-finance-001',
      name: 'Financial Reports',
      projectId: project.id,
      parentId: null,
    },
  });
  console.log(`  ✅ Root folder: ${financeFolder.name}`);

  const contractsFolder = await prisma.folder.upsert({
    where: { id: 'folder-contracts-001' },
    update: {},
    create: {
      id: 'folder-contracts-001',
      name: 'Contracts',
      projectId: project.id,
      parentId: legalFolder.id,
    },
  });
  console.log(`  ✅ Subfolder: ${contractsFolder.name} (under ${legalFolder.name})`);

  const courtFolder = await prisma.folder.upsert({
    where: { id: 'folder-court-001' },
    update: {},
    create: {
      id: 'folder-court-001',
      name: 'Court Filings',
      projectId: project.id,
      parentId: legalFolder.id,
    },
  });
  console.log(`  ✅ Subfolder: ${courtFolder.name} (under ${legalFolder.name})\n`);

  // ============================================================================
  // STEP 5: Grant Folder Access
  // ============================================================================
  console.log('🔐 Granting folder access...');

  // User 1 → Legal Documents
  await prisma.folderAccess.upsert({
    where: {
      folderId_userId: {
        folderId: legalFolder.id,
        userId: user1.id,
      },
    },
    update: {},
    create: {
      folderId: legalFolder.id,
      userId: user1.id,
    },
  });
  console.log(`  ✅ ${user1.name} → ${legalFolder.name}`);

  // User 1 → Contracts
  await prisma.folderAccess.upsert({
    where: {
      folderId_userId: {
        folderId: contractsFolder.id,
        userId: user1.id,
      },
    },
    update: {},
    create: {
      folderId: contractsFolder.id,
      userId: user1.id,
    },
  });
  console.log(`  ✅ ${user1.name} → ${contractsFolder.name}`);

  // User 2 → Financial Reports ONLY
  await prisma.folderAccess.upsert({
    where: {
      folderId_userId: {
        folderId: financeFolder.id,
        userId: user2.id,
      },
    },
    update: {},
    create: {
      folderId: financeFolder.id,
      userId: user2.id,
    },
  });
  console.log(`  ✅ ${user2.name} → ${financeFolder.name}\n`);

  // ============================================================================
  // STEP 6: Create Test Messages
  // ============================================================================
  console.log('💬 Creating test messages...');

  const now = new Date();

  // Message 1: Admin in Legal Documents
  await prisma.message.create({
    data: {
      folderId: legalFolder.id,
      senderId: admin.id,
      messageType: 'text',
      text: 'Welcome to the Legal Documents folder. Please review the contracts.',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  });
  console.log(`  ✅ ${admin.name} → ${legalFolder.name}: "Welcome to the Legal Documents folder..."`);

  // Message 2: User 1 in Legal Documents
  await prisma.message.create({
    data: {
      folderId: legalFolder.id,
      senderId: user1.id,
      messageType: 'text',
      text: 'Thanks! I will review them today.',
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
  });
  console.log(`  ✅ ${user1.name} → ${legalFolder.name}: "Thanks! I will review them today."`);

  // Message 3: Admin in Contracts subfolder
  await prisma.message.create({
    data: {
      folderId: contractsFolder.id,
      senderId: admin.id,
      messageType: 'text',
      text: 'This folder contains all vendor contracts.',
      createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
    },
  });
  console.log(`  ✅ ${admin.name} → ${contractsFolder.name}: "This folder contains all vendor contracts."`);

  // Message 4: Admin in Financial Reports
  await prisma.message.create({
    data: {
      folderId: financeFolder.id,
      senderId: admin.id,
      messageType: 'text',
      text: 'Q1 financial reports are ready for review.',
      createdAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
    },
  });
  console.log(`  ✅ ${admin.name} → ${financeFolder.name}: "Q1 financial reports are ready for review."\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('✅ Seed completed successfully!\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 TEST ACCOUNTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Admin:  admin@example.com  / admin123');
  console.log('User 1: user1@example.com  / user123');
  console.log('User 2: user2@example.com  / user123\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📂 FOLDER STRUCTURE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Aparna Ventures Legal Case (CASE-2026-001)');
  console.log('├── Legal Documents (2 messages)');
  console.log('│   ├── Contracts (1 message)');
  console.log('│   └── Court Filings (0 messages)');
  console.log('└── Financial Reports (1 message)\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔐 ACCESS PERMISSIONS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Admin User:');
  console.log('  ✅ ALL folders (admin privilege)');
  console.log('');
  console.log('John Doe (user1@example.com):');
  console.log('  ✅ Legal Documents');
  console.log('  ✅ Contracts');
  console.log('  ❌ Court Filings');
  console.log('  ❌ Financial Reports');
  console.log('');
  console.log('Jane Smith (user2@example.com):');
  console.log('  ❌ Legal Documents');
  console.log('  ❌ Contracts');
  console.log('  ❌ Court Filings');
  console.log('  ✅ Financial Reports\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING SCENARIOS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('1. Login as admin → See all folders and all messages');
  console.log('2. Login as user1 → See Legal Documents + Contracts only');
  console.log('3. Login as user2 → See Financial Reports only');
  console.log('4. Send message in Legal Documents → Both admin and user1 see it');
  console.log('5. Send message in Financial Reports → Only admin and user2 see it');
  console.log('6. Navigate between folders → Messages stay isolated\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
