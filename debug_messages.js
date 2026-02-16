
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const messages = await prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
    });

    console.log('--- Last 20 Messages ---');
    messages.forEach(msg => {
        console.log(`[${msg.createdAt}] ID: ${msg.id}`);
        console.log(`  Name: ${msg.firstName} ${msg.lastName}`);
        console.log(`  VisitorID: ${msg.visitorId}`); // Crucial check
        console.log(`  Message: ${msg.message.substring(0, 50)}...`);
        console.log('---');
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
