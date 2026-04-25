import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  // ─── Admin ────────────────────────────────────────────────────────────────────

  await prisma.user.upsert({
    where: { email: 'admin@securevault.com' },
    update: {},
    create: {
      email: 'admin@securevault.com',
      password,
      name: 'Master Admin',
      isMasterAdmin: true,
    },
  });

  // ─── 4 Test Users — NO project access assigned ────────────────────────────────
  // Admin assigns access from the Share Access UI. Nothing is pre-wired here.

  await prisma.user.upsert({
    where: { email: 'jane.officer@bank.com' },
    update: {},
    create: { email: 'jane.officer@bank.com', password, name: 'Jane Officer', isMasterAdmin: false },
  });

  await prisma.user.upsert({
    where: { email: 'james.lawyer@bank.com' },
    update: {},
    create: { email: 'james.lawyer@bank.com', password, name: 'James Lawyer', isMasterAdmin: false },
  });

  await prisma.user.upsert({
    where: { email: 'sarah.audit@bank.com' },
    update: {},
    create: { email: 'sarah.audit@bank.com', password, name: 'Sarah Auditor', isMasterAdmin: false },
  });

  await prisma.user.upsert({
    where: { email: 'raj.manager@bank.com' },
    update: {},
    create: { email: 'raj.manager@bank.com', password, name: 'Raj Manager', isMasterAdmin: false },
  });

  console.log('\n✅ Seed complete!\n');
  console.log('ADMIN');
  console.log('  admin@securevault.com  /  password123');
  console.log('\n4 TEST USERS (password: password123 each)');
  console.log('  jane.officer@bank.com   →  Jane Officer');
  console.log('  james.lawyer@bank.com   →  James Lawyer');
  console.log('  sarah.audit@bank.com    →  Sarah Auditor');
  console.log('  raj.manager@bank.com    →  Raj Manager');
  console.log('\nNo project access is pre-assigned.');
  console.log('Admin grants access from the Share Access UI.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
