import { PrismaClient } from '@prisma/client';
import { BotService } from '../src/modules/bot/bot.service';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding default bot intents (upsert)...');

    const defaults = BotService.getDefaults();
    let created = 0;
    let skipped = 0;

    for (const intent of defaults) {
        const result = await prisma.botIntent.upsert({
            where: { name: intent.name },
            update: {}, // don't overwrite custom edits
            create: {
                name: intent.name,
                patterns: intent.patterns,
                response: intent.response,
                quickReplies: intent.quickReplies,
                priority: intent.priority,
                enabled: intent.enabled,
            },
        });

        const existed = result.createdAt.getTime() !== result.updatedAt.getTime() ||
            (Date.now() - result.createdAt.getTime()) > 5000;

        if (existed) {
            skipped++;
            console.log(`  ⏩ ${intent.name} (exists)`);
        } else {
            created++;
            console.log(`  ✓ ${intent.name} (created)`);
        }
    }

    console.log(`\n✅ Done: ${created} created, ${skipped} already existed.`);
}

seed()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
