import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
    getActivePromotionHandler,
    listPromotionsHandler,
    createPromotionHandler,
    updatePromotionHandler,
    deletePromotionHandler,
    trackImpressionHandler,
    trackClickHandler,
} from "./promotion.controller";
import { requireAdmin } from "../../shared/rbac";

export async function promotionRoutes(app: FastifyInstance) {
    // ── Public Routes ────────────────────────────────────────────────

    // Get the active promotion for a given page
    app.get("/active", getActivePromotionHandler);

    // Track impression
    app.withTypeProvider<ZodTypeProvider>().post(
        "/:id/impression",
        {
            schema: {
                params: z.object({ id: z.string().uuid() }),
            },
        },
        // @ts-ignore
        trackImpressionHandler
    );

    // Track click
    app.withTypeProvider<ZodTypeProvider>().post(
        "/:id/click",
        {
            schema: {
                params: z.object({ id: z.string().uuid() }),
            },
        },
        // @ts-ignore
        trackClickHandler
    );

    // ── Authenticated Routes ─────────────────────────────────────────

    // Admin: list all promotions
    app.get(
        "/",
        { onRequest: [app.authenticate, requireAdmin()] },
        // @ts-ignore
        listPromotionsHandler
    );

    // Create promotion
    app.withTypeProvider<ZodTypeProvider>().post(
        "/",
        {
            schema: {
                body: z.object({
                    title: z.string().min(1, "Title is required").max(200),
                    message: z.string().min(1, "Message is required").max(500),
                    serviceId: z.string().uuid().optional(),
                    serviceSlug: z.string().max(200).optional(),
                    serviceTitle: z.string().max(200).optional(),
                    whatsappUrl: z.string().url().optional().or(z.literal("")),
                    ctaText: z.string().max(50).optional(),
                    badge: z.string().max(30).optional(),
                    active: z.boolean().optional(),
                    priority: z.number().int().min(0).max(100).optional(),
                    startDate: z.string().optional(),
                    endDate: z.string().optional().nullable(),
                    showOnPages: z.array(z.string()).optional(),
                }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        createPromotionHandler
    );

    // Update promotion
    app.withTypeProvider<ZodTypeProvider>().put(
        "/:id",
        {
            schema: {
                params: z.object({ id: z.string().uuid() }),
                body: z.object({
                    title: z.string().min(1).max(200).optional(),
                    message: z.string().max(500).optional(),
                    serviceId: z.string().uuid().optional().nullable(),
                    serviceSlug: z.string().max(200).optional().nullable(),
                    serviceTitle: z.string().max(200).optional().nullable(),
                    whatsappUrl: z.string().optional().nullable(),
                    ctaText: z.string().max(50).optional(),
                    badge: z.string().max(30).optional().nullable(),
                    active: z.boolean().optional(),
                    priority: z.number().int().min(0).max(100).optional(),
                    startDate: z.string().optional(),
                    endDate: z.string().optional().nullable(),
                    showOnPages: z.array(z.string()).optional(),
                }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        updatePromotionHandler
    );

    // Delete promotion
    app.withTypeProvider<ZodTypeProvider>().delete(
        "/:id",
        {
            schema: {
                params: z.object({ id: z.string().uuid() }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        deletePromotionHandler
    );
}
