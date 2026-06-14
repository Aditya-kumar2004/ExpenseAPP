const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

console.log('Testing connection with DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Success! Connection established. Result:', result);
  } catch (err) {
    console.error('Error connecting to database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
