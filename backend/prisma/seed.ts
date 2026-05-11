import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('naprocs2026', 10);

  // ─── Admin ────────────────────────────────────────────────────────────────────

  await prisma.user.upsert({
    where: { email: 'siva@filevault.com' },
    update: {},
    create: {
      email: 'siva@filevault.com',
      password,
      name: 'Master Admin',
      isMasterAdmin: true,
    },
  });

  console.log('\n✅ Seed complete!\n');
  console.log('ADMIN');
  console.log('  siva@filevault.com  /  naprocs2026\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
