const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = '97d9e53c-ca84-40bd-981c-57e11cb7fcee'; // the user id from check-user
  const rows = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN mime_type LIKE 'image/%' THEN 'photo'
        WHEN mime_type LIKE 'video/%' THEN 'video'
        ELSE 'document'
      END AS kind,
      COALESCE(SUM(size_bytes), 0) AS bytes
    FROM files
    WHERE user_id = ${userId} AND status = 'active'
    GROUP BY kind
  `;
  console.log('Breakdown Query rows:', rows);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
