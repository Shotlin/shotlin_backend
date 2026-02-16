import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { submitContactHandler, getContactsHandler, getChatHistoryHandler, getVisitorChatHistoryHandler, replyContactHandler, getConversationsHandler } from "./contact.controller";
import { contactSchema } from "../../shared/schemas";
import { requireAdmin } from "../../shared/rbac";

import { z } from "zod";

export async function contactRoutes(app: FastifyInstance) {
    // Protected Route: Get All Messages
    app.get("/", { onRequest: [app.authenticate, requireAdmin()] }, getContactsHandler);

    // Chat Routes
    app.get("/conversations", { onRequest: [app.authenticate, requireAdmin()] }, getConversationsHandler);
    app.get("/chat", { onRequest: [app.authenticate, requireAdmin()] }, getChatHistoryHandler);
    app.post("/reply", { onRequest: [app.authenticate, requireAdmin()] }, replyContactHandler);

    // Public Route: Visitor Chat History (secured by UUID validation + rate limiting)
    app.get("/chat/visitor", {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, getVisitorChatHistoryHandler);

    app.withTypeProvider<ZodTypeProvider>().post(
        "/",
        {
            schema: {
                body: contactSchema,
                response: {
                    201: z.object({
                        status: z.string(),
                        message: z.string(),
                        data: z.object({ id: z.string() }).optional(),
                    }),
                },
            },
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        },
        submitContactHandler
    );
}
