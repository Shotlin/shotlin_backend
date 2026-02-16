import { FastifyRequest, FastifyReply } from "fastify";
import sanitizeHtml from "sanitize-html";

// ── Helpers ──────────────────────────────────────────────────────────────

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function estimateReadTime(html: string): number {
    const text = html.replace(/<[^>]*>/g, "");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

const sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img", "h1", "h2", "h3", "h4", "h5", "h6",
        "figure", "figcaption", "video", "source",
        "iframe", "pre", "code", "span", "div",
    ]),
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ["src", "alt", "title", "width", "height", "loading"],
        a: ["href", "name", "target", "rel"],
        iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
        code: ["class"],
        span: ["class", "style"],
        div: ["class", "style"],
        pre: ["class"],
    },
    allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
    disallowedTagsMode: "discard",
};

// ── GET /api/v1/blog — Public list ───────────────────────────────────

interface ListQuery {
    page?: string;
    limit?: string;
    category?: string;
    tag?: string;
    featured?: string;
    search?: string;
}

export async function listBlogPostsHandler(
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply
) {
    const {
        page = "1",
        limit = "12",
        category,
        tag,
        featured,
        search,
    } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { published: true };

    if (category) where.category = category;
    if (tag) where.tags = { has: tag };
    if (featured === "true") where.featured = true;
    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { excerpt: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
        ];
    }

    try {
        const [posts, total] = await Promise.all([
            request.server.prisma.blogPost.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    excerpt: true,
                    coverImage: true,
                    category: true,
                    tags: true,
                    readTime: true,
                    featured: true,
                    publishedAt: true,
                    createdAt: true,
                    viewCount: true,
                    author: { select: { id: true, name: true } },
                },
                orderBy: { publishedAt: "desc" },
                skip,
                take: limitNum,
            }),
            request.server.prisma.blogPost.count({ where }),
        ]);

        return reply.send({
            status: "success",
            data: posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ status: "error", message: "Failed to fetch posts" });
    }
}

// ── GET /api/v1/blog/all — Admin list (all posts incl. drafts) ───────

export async function listAllBlogPostsHandler(
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply
) {
    const {
        page = "1",
        limit = "50",
        category,
        search,
    } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (category) where.category = category;
    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { excerpt: { contains: search, mode: "insensitive" } },
        ];
    }

    try {
        const [posts, total] = await Promise.all([
            request.server.prisma.blogPost.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                skip,
                take: limitNum,
                include: { author: { select: { id: true, name: true, email: true } } },
            }),
            request.server.prisma.blogPost.count({ where }),
        ]);

        return reply.send({
            status: "success",
            data: posts,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ status: "error", message: "Failed to fetch posts" });
    }
}

// ── GET /api/v1/blog/:slug — Public single post ─────────────────────

export async function getBlogPostBySlugHandler(
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
) {
    const { slug } = request.params;

    try {
        const post = await request.server.prisma.blogPost.findUnique({
            where: { slug },
            include: { author: { select: { id: true, name: true } } },
        });

        if (!post || !post.published) {
            return reply.status(404).send({ status: "error", message: "Post not found" });
        }

        // Increment view count in background (fire and forget)
        request.server.prisma.blogPost
            .update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } })
            .catch(() => { });

        return reply.send({ status: "success", data: post });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ status: "error", message: "Failed to fetch post" });
    }
}

// ── POST /api/v1/blog — Create post (Auth required) ─────────────────

interface CreateBlogBody {
    title: string;
    content: string;
    excerpt?: string;
    coverImage?: string;
    published?: boolean;
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
    canonicalUrl?: string;
    ogImage?: string;
    structuredData?: string;
    category?: string;
    tags?: string[];
    featured?: boolean;
    publishedAt?: string;
}

export async function createBlogPostHandler(
    request: FastifyRequest<{ Body: CreateBlogBody }>,
    reply: FastifyReply
) {
    const body = request.body;
    const user = request.user as { id: string };

    // Generate unique slug
    let baseSlug = slugify(body.title);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
        const existing = await request.server.prisma.blogPost.findUnique({ where: { slug } });
        if (!existing) break;
        slug = `${baseSlug}-${counter++}`;
    }

    // Sanitize HTML content
    const sanitizedContent = sanitizeHtml(body.content, sanitizeOptions);
    const readTime = estimateReadTime(sanitizedContent);

    try {
        const post = await request.server.prisma.blogPost.create({
            data: {
                title: body.title.trim(),
                slug,
                excerpt: body.excerpt?.trim() || null,
                content: sanitizedContent,
                coverImage: body.coverImage || null,
                published: body.published ?? false,
                metaTitle: body.metaTitle?.trim() || null,
                metaDescription: body.metaDescription?.trim() || null,
                metaKeywords: body.metaKeywords || [],
                canonicalUrl: body.canonicalUrl?.trim() || null,
                ogImage: body.ogImage || null,
                structuredData: body.structuredData || null,
                category: body.category?.trim() || null,
                tags: body.tags || [],
                readTime,
                featured: body.featured ?? false,
                publishedAt: body.published ? (body.publishedAt ? new Date(body.publishedAt) : new Date()) : null,
                authorId: user.id,
            },
            include: { author: { select: { id: true, name: true } } },
        });

        return reply.status(201).send({ status: "success", data: post });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ status: "error", message: "Failed to create post" });
    }
}

// ── PUT /api/v1/blog/:id — Update post (Auth required) ──────────────

export async function updateBlogPostHandler(
    request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateBlogBody> & { slug?: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const body = request.body;

    try {
        const existing = await request.server.prisma.blogPost.findUnique({ where: { id } });
        if (!existing) {
            return reply.status(404).send({ status: "error", message: "Post not found" });
        }

        const data: any = {};

        if (body.title !== undefined) {
            data.title = body.title.trim();
            // Regenerate slug if title changed
            if (body.slug === undefined) {
                let baseSlug = slugify(body.title);
                let slug = baseSlug;
                let counter = 1;
                while (true) {
                    const dup = await request.server.prisma.blogPost.findUnique({ where: { slug } });
                    if (!dup || dup.id === id) break;
                    slug = `${baseSlug}-${counter++}`;
                }
                data.slug = slug;
            }
        }

        if (body.slug !== undefined) {
            const cleaned = slugify(body.slug);
            const dup = await request.server.prisma.blogPost.findUnique({ where: { slug: cleaned } });
            if (dup && dup.id !== id) {
                return reply.status(409).send({ status: "error", message: "Slug already in use" });
            }
            data.slug = cleaned;
        }

        if (body.content !== undefined) {
            data.content = sanitizeHtml(body.content, sanitizeOptions);
            data.readTime = estimateReadTime(data.content);
        }

        if (body.excerpt !== undefined) data.excerpt = body.excerpt.trim();
        if (body.coverImage !== undefined) data.coverImage = body.coverImage;
        if (body.published !== undefined) {
            data.published = body.published;
            if (body.published && !existing.publishedAt) {
                data.publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
            }
        }
        if (body.metaTitle !== undefined) data.metaTitle = body.metaTitle?.trim() || null;
        if (body.metaDescription !== undefined) data.metaDescription = body.metaDescription?.trim() || null;
        if (body.metaKeywords !== undefined) data.metaKeywords = body.metaKeywords;
        if (body.canonicalUrl !== undefined) data.canonicalUrl = body.canonicalUrl?.trim() || null;
        if (body.ogImage !== undefined) data.ogImage = body.ogImage;
        if (body.structuredData !== undefined) data.structuredData = body.structuredData;
        if (body.category !== undefined) data.category = body.category?.trim() || null;
        if (body.tags !== undefined) data.tags = body.tags;
        if (body.featured !== undefined) data.featured = body.featured;
        if (body.publishedAt !== undefined) data.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;

        const updated = await request.server.prisma.blogPost.update({
            where: { id },
            data,
            include: { author: { select: { id: true, name: true } } },
        });

        return reply.send({ status: "success", data: updated });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ status: "error", message: "Failed to update post" });
    }
}

// ── DELETE /api/v1/blog/:id — Delete post (Auth required) ───────────

export async function deleteBlogPostHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;

    try {
        await request.server.prisma.blogPost.delete({ where: { id } });
        return reply.send({ status: "success", message: "Post deleted" });
    } catch (error) {
        request.log.error(error);
        return reply.status(404).send({ status: "error", message: "Post not found" });
    }
}
