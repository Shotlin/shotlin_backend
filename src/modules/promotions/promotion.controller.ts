import { FastifyRequest, FastifyReply } from "fastify";

// ── List Active Promotion (Public) ─────────────────────────────────
export async function getActivePromotionHandler(
    request: FastifyRequest<{ Querystring: { page?: string } }>,
    reply: FastifyReply
) {
    const page = (request.query as any).page || "home";
    const now = new Date();

    const promo = await request.server.prisma.promotion.findFirst({
        where: {
            active: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            showOnPages: { has: page },
        },
        orderBy: { priority: "desc" },
    });

    if (!promo) {
        return reply.code(204).send();
    }

    return reply.send({ status: "success", data: promo });
}

// ── List All Promotions (Admin) ────────────────────────────────────
export async function listPromotionsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const promos = await request.server.prisma.promotion.findMany({
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return reply.send({ status: "success", data: promos });
}

// ── Create Promotion (Admin) ───────────────────────────────────────
export async function createPromotionHandler(
    request: FastifyRequest<{
        Body: {
            title: string;
            message: string;
            serviceId?: string;
            serviceSlug?: string;
            serviceTitle?: string;
            whatsappUrl?: string;
            ctaText?: string;
            badge?: string;
            active?: boolean;
            priority?: number;
            startDate?: string;
            endDate?: string;
            showOnPages?: string[];
        };
    }>,
    reply: FastifyReply
) {
    const body = request.body;

    const promo = await request.server.prisma.promotion.create({
        data: {
            title: body.title,
            message: body.message,
            serviceId: body.serviceId || null,
            serviceSlug: body.serviceSlug || null,
            serviceTitle: body.serviceTitle || null,
            whatsappUrl: body.whatsappUrl || null,
            ctaText: body.ctaText || "Get Offer",
            badge: body.badge || null,
            active: body.active ?? true,
            priority: body.priority ?? 0,
            startDate: body.startDate ? new Date(body.startDate) : new Date(),
            endDate: body.endDate ? new Date(body.endDate) : null,
            showOnPages: body.showOnPages || ["home", "services"],
        },
    });

    return reply.code(201).send({ status: "success", data: promo });
}

// ── Update Promotion (Admin) ───────────────────────────────────────
export async function updatePromotionHandler(
    request: FastifyRequest<{
        Params: { id: string };
        Body: Record<string, unknown>;
    }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const body = request.body as any;

    // Build update payload — only include fields that are present
    const data: Record<string, unknown> = {};
    const fields = [
        "title", "message", "serviceId", "serviceSlug", "serviceTitle",
        "whatsappUrl", "ctaText", "badge", "active", "priority", "showOnPages",
    ];
    for (const f of fields) {
        if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.startDate !== undefined) {
        data.startDate = body.startDate ? new Date(body.startDate as string) : new Date();
    }
    if (body.endDate !== undefined) {
        data.endDate = body.endDate ? new Date(body.endDate as string) : null;
    }

    try {
        const promo = await request.server.prisma.promotion.update({
            where: { id },
            data,
        });
        return reply.send({ status: "success", data: promo });
    } catch {
        return reply.code(404).send({ status: "error", message: "Promotion not found" });
    }
}

// ── Delete Promotion (Admin) ───────────────────────────────────────
export async function deletePromotionHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    try {
        await request.server.prisma.promotion.delete({ where: { id } });
        return reply.send({ status: "success", message: "Promotion deleted" });
    } catch {
        return reply.code(404).send({ status: "error", message: "Promotion not found" });
    }
}

// ── Track Impression (Public) ──────────────────────────────────────
export async function trackImpressionHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    try {
        await request.server.prisma.promotion.update({
            where: { id },
            data: { impressions: { increment: 1 } },
        });
        return reply.send({ status: "success" });
    } catch {
        return reply.code(404).send({ status: "error", message: "Promotion not found" });
    }
}

// ── Track Click (Public) ───────────────────────────────────────────
export async function trackClickHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    try {
        await request.server.prisma.promotion.update({
            where: { id },
            data: { clicks: { increment: 1 } },
        });
        return reply.send({ status: "success" });
    } catch {
        return reply.code(404).send({ status: "error", message: "Promotion not found" });
    }
}
