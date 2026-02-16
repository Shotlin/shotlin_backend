
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true, role: true }
    });
    console.log('--- Admin Users ---');
    users.forEach(u => console.log(`${u.email} (${u.role})`));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
