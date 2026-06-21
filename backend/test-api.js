const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = 'effands@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found!');
    return;
  }

  // Get or create a session
  let session = await prisma.userSession.findFirst({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }
  });

  if (!session) {
    session = await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'dummy',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
  }

  // Generate valid JWT token
  const token = jwt.sign(
    { sub: user.id, sid: session.id },
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
