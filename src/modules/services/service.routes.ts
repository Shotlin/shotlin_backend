import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
    listServicesHandler,
    listAllServicesHandler,
    getServiceBySlugHandler,
    createServiceHandler,
    updateServiceHandler,
    deleteServiceHandler,
} from "./service.controller";
import { requireAdmin } from "../../shared/rbac";

const faqSchema = z.object({ q: z.string(), a: z.string() });
const appTypeSchema = z.object({
    name: z.string(),
    icon: z.string().optional(),
    example: z.string().optional(),
});
const limitedOfferSchema = z.object({
    badge: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    appTypes: z.array(appTypeSchema).optional(),
    ctaText: z.string().optional(),
    active: z.boolean().optional(),
});
const statSchema = z.object({ value: z.string(), label: z.string() });
const comparisonSchema = z.object({
    struggles: z.array(z.string()),
    solutions: z.array(z.string()),
});

export async function serviceRoutes(app: FastifyInstance) {
    // ── Public Routes ────────────────────────────────────────────────

    // List published services
    app.get("/", listServicesHandler);

    // Get single service by slug
    app.get("/:slug", getServiceBySlugHandler);

    // ── Authenticated Routes ─────────────────────────────────────────

    // Admin: list all services (including unpublished)
    app.get(
        "/admin/all",
        { onRequest: [app.authenticate, requireAdmin()] },
        // @ts-ignore
        listAllServicesHandler
    );

    // Create service
    app.withTypeProvider<ZodTypeProvider>().post(
        "/",
        {
            schema: {
                body: z.object({
                    title: z.string().min(1, "Title is required").max(200),
                    subtitle: z.string().max(300).optional(),
                    description: z.string().min(1, "Description is required"),
                    icon: z.string().max(50).optional(),
                    color: z.string().max(20).optional(),
                    coverImage: z.string().url().optional().or(z.literal("")),
                    published: z.boolean().optional(),
                    sortOrder: z.number().int().optional(),
                    benefits: z.array(z.string()).optional(),
                    technologies: z.array(z.string()).optional(),
                    deliverables: z.array(z.string()).optional(),
                    faq: z.array(faqSchema).optional(),
                    limitedOffer: limitedOfferSchema.optional(),
                    heroHeadline: z.string().max(300).optional(),
                    heroSubheadline: z.string().max(500).optional(),
                    heroCtaText: z.string().max(100).optional(),
                    heroCtaPrice: z.string().max(50).optional(),
                    heroUrgencyText: z.string().max(200).optional(),
                    metaTitle: z.string().max(70).optional(),
                    metaDescription: z.string().max(320).optional(),
                    metaKeywords: z.array(z.string()).optional(),
                    canonicalUrl: z.string().url().optional().or(z.literal("")),
                    ogImage: z.string().url().optional().or(z.literal("")),
                    structuredData: z.string().optional(),
                    price: z.number().optional(),
                    currency: z.string().max(10).optional(),
                    pricingType: z.enum(["FIXED", "CUSTOM", "CONTACT"]).optional(),
                    stats: z.array(statSchema).optional(),
                    comparison: comparisonSchema.optional(),
                    hasDetailPage: z.boolean().optional(),
                    featured: z.boolean().optional(),
                    whatsappUrl: z.string().optional(),
                    demoImages: z.array(z.string()).optional(),
                }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        createServiceHandler
    );

    // Update service
    app.withTypeProvider<ZodTypeProvider>().put(
        "/:id",
        {
            schema: {
                params: z.object({ id: z.string() }),
                body: z.object({
                    title: z.string().min(1).max(200).optional(),
                    subtitle: z.string().max(300).optional().nullable(),
                    description: z.string().optional(),
                    icon: z.string().max(50).optional().nullable(),
                    color: z.string().max(20).optional(),
                    coverImage: z.string().optional().nullable(),
                    published: z.boolean().optional(),
                    sortOrder: z.number().int().optional(),
                    benefits: z.array(z.string()).optional().nullable(),
                    technologies: z.array(z.string()).optional().nullable(),
                    deliverables: z.array(z.string()).optional().nullable(),
                    faq: z.array(faqSchema).optional().nullable(),
                    limitedOffer: limitedOfferSchema.optional().nullable(),
                    heroHeadline: z.string().max(300).optional().nullable(),
                    heroSubheadline: z.string().max(500).optional().nullable(),
                    heroCtaText: z.string().max(100).optional().nullable(),
                    heroCtaPrice: z.string().max(50).optional().nullable(),
                    heroUrgencyText: z.string().max(200).optional().nullable(),
                    metaTitle: z.string().max(70).optional().nullable(),
                    metaDescription: z.string().max(320).optional().nullable(),
                    metaKeywords: z.array(z.string()).optional(),
                    canonicalUrl: z.string().optional().nullable(),
                    ogImage: z.string().optional().nullable(),
                    structuredData: z.string().optional().nullable(),
                    price: z.number().optional().nullable(),
                    currency: z.string().max(10).optional(),
                    pricingType: z.enum(["FIXED", "CUSTOM", "CONTACT"]).optional(),
                    stats: z.array(statSchema).optional().nullable(),
                    comparison: comparisonSchema.optional().nullable(),
                    hasDetailPage: z.boolean().optional(),
                    featured: z.boolean().optional(),
                    whatsappUrl: z.string().optional().nullable(),
                    demoImages: z.array(z.string()).optional(),
                }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        updateServiceHandler
    );

    // Delete service
    app.withTypeProvider<ZodTypeProvider>().delete(
        "/:id",
        {
            schema: {
                params: z.object({ id: z.string() }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        deleteServiceHandler
    );
}
