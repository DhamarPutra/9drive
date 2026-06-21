const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = '97d9e53c-ca84-40bd-981c-57e11cb7fcee'; // the user id from check-user
  const accounts = await prisma.connectedAccount.findMany({ where: { userId, status: 'connected' }, include: { storageAccount: true } });
  
  console.log('Query returned accounts:', accounts.length);
  
  const summary = accounts.reduce((acc, account) => {
    const storage = account.storageAccount;
    console.log('Account storage:', storage);
    acc.totalBytes += storage?.totalBytes ?? 0n;
    acc.usedBytes += storage?.usedBytes ?? 0n;
    acc.availableBytes += storage?.availableBytes ?? 0n;
    return acc;
  }, { totalBytes: 0n, usedBytes: 0n, availableBytes: 0n });
  
  console.log('Summary calculated:', {
    totalBytes: summary.totalBytes.toString(),
    usedBytes: summary.usedBytes.toString(),
    availableBytes: summary.availableBytes.toString()
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
