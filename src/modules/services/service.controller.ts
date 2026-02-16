import { FastifyRequest, FastifyReply } from "fastify";
import sanitizeHtml from "sanitize-html";

// ── Helpers ──────────────────────────────────────────────────────────
function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function sanitize(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "span"]),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            "*": ["class"],
            img: ["src", "alt", "width", "height"],
        },
    });
}

// ── List Published Services (Public) ─────────────────────────────────
export async function listServicesHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const services = await request.server.prisma.service.findMany({
        where: { published: true },
        orderBy: { sortOrder: "asc" },
    });
    return reply.send({ status: "success", data: services });
}

// ── List All Services (Admin) ────────────────────────────────────────
export async function listAllServicesHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const services = await request.server.prisma.service.findMany({
        orderBy: { sortOrder: "asc" },
    });
    return reply.send({ status: "success", data: services });
}

// ── Get Service by Slug (Public) ─────────────────────────────────────
export async function getServiceBySlugHandler(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
) {
    const { slug } = request.params;
    const service = await request.server.prisma.service.findUnique({
        where: { slug },
    });

    if (!service) {
        return reply.status(404).send({ status: "error", message: "Service not found" });
    }

    return reply.send({ status: "success", data: service });
}

// ── Create Service (Admin) ───────────────────────────────────────────
export async function createServiceHandler(
    request: FastifyRequest<{
        Body: {
            title: string;
            subtitle?: string;
            description: string;
            icon?: string;
            color?: string;
            coverImage?: string;
            published?: boolean;
            sortOrder?: number;
            benefits?: string[];
            technologies?: string[];
            deliverables?: string[];
            faq?: { q: string; a: string }[];
            limitedOffer?: {
                badge?: string;
                title?: string;
                subtitle?: string;
                price?: number;
                currency?: string;
                appTypes?: { name: string; icon?: string; example?: string }[];
                ctaText?: string;
                active?: boolean;
            };
            heroHeadline?: string;
            heroSubheadline?: string;
            heroCtaText?: string;
            heroCtaPrice?: string;
            heroUrgencyText?: string;
            metaTitle?: string;
            metaDescription?: string;
            metaKeywords?: string[];
            canonicalUrl?: string;
            ogImage?: string;
            structuredData?: string;
            price?: number;
            currency?: string;
            pricingType?: string;
            whatsappUrl?: string;
            stats?: { value: string; label: string }[];
            comparison?: { struggles: string[]; solutions: string[] };
            hasDetailPage?: boolean;
            featured?: boolean;
            demoImages?: string[];
        };
    }>,
    reply: FastifyReply
) {
    const body = request.body;
    const slug = slugify(body.title);

    // Check slug uniqueness
    const existing = await request.server.prisma.service.findUnique({ where: { slug } });
    if (existing) {
        return reply.status(409).send({ status: "error", message: "A service with this title already exists" });
    }

    try {
        const service = await request.server.prisma.service.create({
            data: {
                title: sanitize(body.title),
                slug,
                subtitle: body.subtitle ? sanitize(body.subtitle) : null,
                description: sanitize(body.description),
                icon: body.icon || null,
                color: body.color || "blue",
                coverImage: body.coverImage || null,
                published: body.published ?? false,
                sortOrder: body.sortOrder ?? 0,
                benefits: body.benefits || undefined,
                technologies: body.technologies || undefined,
                deliverables: body.deliverables || undefined,
                faq: body.faq || undefined,
                limitedOffer: body.limitedOffer || undefined,
                heroHeadline: body.heroHeadline ? sanitize(body.heroHeadline) : null,
                heroSubheadline: body.heroSubheadline ? sanitize(body.heroSubheadline) : null,
                heroCtaText: body.heroCtaText || null,
                heroCtaPrice: body.heroCtaPrice || null,
                heroUrgencyText: body.heroUrgencyText || null,
                metaTitle: body.metaTitle || null,
                metaDescription: body.metaDescription || null,
                metaKeywords: body.metaKeywords || [],
                canonicalUrl: body.canonicalUrl || null,
                ogImage: body.ogImage || null,
                structuredData: body.structuredData || null,
                price: body.price ?? null,
                currency: body.currency || "INR",
                pricingType: body.pricingType || "FIXED",
                whatsappUrl: body.whatsappUrl || null,
                stats: body.stats || undefined,
                comparison: body.comparison || undefined,
                hasDetailPage: body.hasDetailPage ?? false,
                featured: body.featured ?? false,
                demoImages: body.demoImages || [],
            },
        });

        return reply.status(201).send({ status: "success", data: service });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ status: "error", message: "Failed to create service" });
    }
}

// ── Update Service (Admin) ───────────────────────────────────────────
export async function updateServiceHandler(
    request: FastifyRequest<{
        Params: { id: string };
        Body: Record<string, unknown>;
    }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const body = request.body as Record<string, unknown>;

    // Build update data, sanitising text fields
    const data: Record<string, unknown> = {};
    const textFields = [
        "title", "subtitle", "description", "heroHeadline", "heroSubheadline",
    ];
    const passFields = [
        "icon", "color", "coverImage", "published", "sortOrder",
        "heroCtaText", "heroCtaPrice", "heroUrgencyText",
        "metaTitle", "metaDescription", "metaKeywords",
        "canonicalUrl", "ogImage", "structuredData",
        "price", "currency", "pricingType", "whatsappUrl",
        "hasDetailPage", "featured", "demoImages",
    ];
    const jsonFields = [
        "benefits", "technologies", "deliverables", "faq",
        "limitedOffer", "stats", "comparison",
    ];

    for (const key of textFields) {
        if (key in body) {
            data[key] = typeof body[key] === "string" ? sanitize(body[key] as string) : body[key];
        }
    }
    for (const key of passFields) {
        if (key in body) data[key] = body[key];
    }
    for (const key of jsonFields) {
        if (key in body) data[key] = body[key];
    }

    // Regenerate slug if title changed
    if (data.title && typeof data.title === "string") {
        data.slug = slugify(data.title);
    }

    try {
        const service = await request.server.prisma.service.update({
            where: { id },
            data,
        });
        return reply.send({ status: "success", data: service });
    } catch (error) {
        request.log.error(error);
        return reply.status(404).send({ status: "error", message: "Service not found" });
    }
}

// ── Delete Service (Admin) ───────────────────────────────────────────
export async function deleteServiceHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;

    try {
        await request.server.prisma.service.delete({ where: { id } });
        return reply.send({ status: "success", message: "Service deleted" });
    } catch (error) {
        request.log.error(error);
        return reply.status(404).send({ status: "error", message: "Service not found" });
    }
}
