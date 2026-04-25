const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test connection
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful!');
    
    // Check tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('\n📊 Database tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Count records
    const userCount = await prisma.user.count();
    const projectCount = await prisma.project.count();
    const fileCount = await prisma.file.count();
    
    console.log('\n📈 Record counts:');
    console.log(`  Users: ${userCount}`);
    console.log(`  Projects: ${projectCount}`);
    console.log(`  Files: ${fileCount}`);
    
    console.log('\n✅ Database is ready for file uploads!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
