const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = 'effands@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found!');
    return;
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, name: user.name, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  console.log('Generated Token:', token);

  // Test /storage/summary
  console.log('\n--- Testing /storage/summary ---');
  try {
    const res = await fetch('http://localhost:4000/storage/summary', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status:', res.status);
    const body = await res.json();
    console.log('Body:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.error('Fetch /storage/summary failed:', e.message);
  }

  // Test /storage/breakdown
  console.log('\n--- Testing /storage/breakdown ---');
  try {
    const res = await fetch('http://localhost:4000/storage/breakdown', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status:', res.status);
    const body = await res.json();
    console.log('Body:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.error('Fetch /storage/breakdown failed:', e.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
