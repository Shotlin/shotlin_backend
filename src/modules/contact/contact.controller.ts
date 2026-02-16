import { FastifyReply, FastifyRequest } from "fastify";
import { ContactInput } from "../../shared/schemas";
import { BotService } from "../bot/bot.service";

export async function submitContactHandler(
    request: FastifyRequest<{ Body: ContactInput }>,
    reply: FastifyReply
) {
    const { firstName, lastName, email, subject, message, visitorId, sender } = request.body as {
        firstName: string;
        lastName: string;
        email: string;
        subject?: string;
        message: string;
        visitorId?: string;
        sender?: string;
    };

    try {
        const newMessage = await request.server.prisma.contactMessage.create({
            data: {
                firstName,
                lastName,
                email,
                subject,
                message,
                visitorId,
                sender: sender || "USER",
                status: "UNREAD",
            },
        });

        // --- Smart Bot Auto-Reply (BEFORE sending response) ---
        let botReply = null;
        if (visitorId && (!sender || sender === "USER")) {
            const botResponse = await BotService.analyze(message, request.server.prisma);
            if (botResponse) {
                // Encode quick replies into message for frontend parsing
                let fullMessage = botResponse.message;
                if (botResponse.quickReplies && botResponse.quickReplies.length > 0) {
                    fullMessage += `\n[QUICK_REPLIES]${JSON.stringify(botResponse.quickReplies)}`;
                }

                botReply = await request.server.prisma.contactMessage.create({
                    data: {
                        firstName: "Shotlin",
                        lastName: "Bot",
                        email: "bot@shotlin.com",
                        subject: "Auto Reply",
                        message: fullMessage,
                        visitorId: visitorId,
                        sender: "ADMIN",
                        status: "READ",
                    },
                });
            }
        }

        return reply.status(201).send({
            status: "success",
            message: "Message received",
            data: newMessage,
            botReply: botReply, // Include bot reply so frontend can show it instantly
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: "Failed to save message" });
    }
}

export async function getContactsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const messages = await request.server.prisma.contactMessage.findMany({
            where: { visitorId: null }, // Filter out chat messages
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        return reply.send({ status: 'success', data: messages });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Internal Server Error" });
    }
}

export async function getChatHistoryHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const { visitorId } = request.query as { visitorId: string };

    if (!visitorId) {
        return reply.status(400).send({ message: "Visitor ID is required" });
    }

    try {
        const messages = await request.server.prisma.contactMessage.findMany({
            where: { visitorId },
            orderBy: { createdAt: 'asc' },
            take: -50, // Take last 50 messages
        });
        return reply.send({ status: 'success', data: messages });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch chat history" });
    }
}

// ── Public Visitor Chat History (No Auth) ─────────────────────────────
// Secured by: UUID format validation (prevents enumeration), rate limiting on route
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getVisitorChatHistoryHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const { visitorId } = request.query as { visitorId?: string };

    if (!visitorId || !UUID_REGEX.test(visitorId)) {
        return reply.status(400).send({ message: "Valid visitor ID is required" });
    }

    try {
        const messages = await request.server.prisma.contactMessage.findMany({
            where: { visitorId },
            orderBy: { createdAt: 'asc' },
            take: -50,
        });
        return reply.send({ status: 'success', data: messages });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch chat history" });
    }
}


export async function replyContactHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const { visitorId, message } = request.body as { visitorId: string, message: string };

    // Input validation
    if (!visitorId || typeof visitorId !== 'string' || visitorId.trim().length === 0) {
        return reply.status(400).send({ message: "visitorId is required" });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return reply.status(400).send({ message: "message is required" });
    }
    if (message.length > 5000) {
        return reply.status(400).send({ message: "message exceeds maximum length (5000 characters)" });
    }

    try {
        const newMessage = await request.server.prisma.contactMessage.create({
            data: {
                firstName: "Admin",
                lastName: "User",
                email: "admin@shotlin.com",
                subject: "Reply",
                message: message.trim(),
                visitorId: visitorId.trim(),
                sender: "ADMIN",
                status: "READ",
            },
        });

        return reply.status(201).send({ status: 'success', data: newMessage });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to send reply" });
    }
}

export async function getConversationsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const messages = await request.server.prisma.contactMessage.findMany({
            where: {
                visitorId: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            take: 500
        });

        const conversationMap = new Map();

        for (const msg of messages) {
            if (!conversationMap.has(msg.visitorId)) {
                conversationMap.set(msg.visitorId, {
                    visitorId: msg.visitorId,
                    lastMessage: msg.message,
                    lastActive: msg.createdAt,
                    // Prioritize USER name, otherwise use Visitor as placeholder
                    name: msg.sender === 'USER' ? `${msg.firstName} ${msg.lastName}` : "Visitor",
                    unreadCount: msg.status === 'UNREAD' && msg.sender === 'USER' ? 1 : 0
                });
            } else {
                const conv = conversationMap.get(msg.visitorId);
                // If we find a USER message, verify/update the name to ensure it's not "Visitor" or Bot's name
                if (msg.sender === 'USER') {
                    conv.name = `${msg.firstName} ${msg.lastName}`;
                    if (msg.status === 'UNREAD') {
                        conv.unreadCount += 1;
                    }
                }
            }
        }

        const conversations = Array.from(conversationMap.values());

        return reply.send({ status: 'success', data: conversations });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch conversations" });
    }
}
