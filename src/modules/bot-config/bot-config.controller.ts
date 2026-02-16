import { FastifyRequest, FastifyReply } from 'fastify';
import { clearBotCache, BotService } from '../bot/bot.service';

// --- LIST ALL INTENTS ---
export async function listIntentsHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        let intents = await request.server.prisma.botIntent.findMany({
            orderBy: { priority: 'desc' },
        });

        // --- AUTO-SEED DEFAULTS IF EMPTY ---
        if (intents.length === 0) {
            const defaults = BotService.getDefaults();
            await request.server.prisma.botIntent.createMany({
                data: defaults,
                skipDuplicates: true,
            });

            // Re-fetch after seeding
            intents = await request.server.prisma.botIntent.findMany({
                orderBy: { priority: 'desc' },
            });

            clearBotCache();
        }

        return reply.send({ status: 'success', data: intents });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to fetch intents' });
    }
}

// --- CREATE INTENT ---
export async function createIntentHandler(
    request: FastifyRequest<{
        Body: {
            name: string;
            patterns: string[];
            response: string;
            quickReplies: string[];
            priority?: number;
            enabled?: boolean;
        };
    }>,
    reply: FastifyReply
) {
    try {
        const { name, patterns, response, quickReplies, priority, enabled } = request.body;

        const intent = await request.server.prisma.botIntent.create({
            data: {
                name,
                patterns,
                response,
                quickReplies,
                priority: priority ?? 50,
                enabled: enabled ?? true,
            },
        });

        clearBotCache();
        return reply.status(201).send({ status: 'success', data: intent });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return reply.status(409).send({ message: `Intent "${request.body.name}" already exists` });
        }
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to create intent' });
    }
}

// --- UPDATE INTENT ---
export async function updateIntentHandler(
    request: FastifyRequest<{
        Params: { id: string };
        Body: {
            name?: string;
            patterns?: string[];
            response?: string;
            quickReplies?: string[];
            priority?: number;
            enabled?: boolean;
        };
    }>,
    reply: FastifyReply
) {
    try {
        const { id } = request.params;
        const data = request.body;

        const intent = await request.server.prisma.botIntent.update({
            where: { id },
            data,
        });

        clearBotCache();
        return reply.send({ status: 'success', data: intent });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return reply.status(404).send({ message: 'Intent not found' });
        }
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to update intent' });
    }
}

// --- DELETE INTENT ---
export async function deleteIntentHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    try {
        const { id } = request.params;

        await request.server.prisma.botIntent.delete({
            where: { id },
        });

        clearBotCache();
        return reply.send({ status: 'success', message: 'Intent deleted' });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return reply.status(404).send({ message: 'Intent not found' });
        }
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to delete intent' });
    }
}
