import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
    listBlogPostsHandler,
    listAllBlogPostsHandler,
    getBlogPostBySlugHandler,
    createBlogPostHandler,
    updateBlogPostHandler,
    deleteBlogPostHandler,
} from "./blog.controller";
import { requireAdmin } from "../../shared/rbac";

export async function blogRoutes(app: FastifyInstance) {
    // ── Public Routes ────────────────────────────────────────────────

    // List published posts (paginated, filterable)
    app.get("/", listBlogPostsHandler);

    // Get single post by slug
    app.get("/:slug", getBlogPostBySlugHandler);

    // ── Authenticated Routes ─────────────────────────────────────────

    // Admin: list all posts (including drafts)
    app.get(
        "/admin/all",
        { onRequest: [app.authenticate, requireAdmin()] },
        // @ts-ignore
        listAllBlogPostsHandler
    );

    // Create blog post
    app.withTypeProvider<ZodTypeProvider>().post(
        "/",
        {
            schema: {
                body: z.object({
                    title: z.string().min(1, "Title is required").max(200),
                    content: z.string().min(1, "Content is required"),
                    excerpt: z.string().max(500).optional(),
                    coverImage: z.string().url().optional().or(z.literal("")),
                    published: z.boolean().optional(),
                    metaTitle: z.string().max(70).optional(),
                    metaDescription: z.string().max(320).optional(),
                    metaKeywords: z.array(z.string()).optional(),
                    canonicalUrl: z.string().url().optional().or(z.literal("")),
                    ogImage: z.string().url().optional().or(z.literal("")),
                    structuredData: z.string().optional(),
                    category: z.string().max(50).optional(),
                    tags: z.array(z.string()).optional(),
                    featured: z.boolean().optional(),
                    publishedAt: z.string().optional(),
                }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        createBlogPostHandler
    );

    // Update blog post
    app.withTypeProvider<ZodTypeProvider>().put(
        "/:id",
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                body: z.object({
                    title: z.string().min(1).max(200).optional(),
                    slug: z.string().max(200).optional(),
                    content: z.string().optional(),
                    excerpt: z.string().max(500).optional(),
                    coverImage: z.string().optional().nullable(),
                    published: z.boolean().optional(),
                    metaTitle: z.string().max(70).optional().nullable(),
                    metaDescription: z.string().max(320).optional().nullable(),
                    metaKeywords: z.array(z.string()).optional(),
                    canonicalUrl: z.string().optional().nullable(),
                    ogImage: z.string().optional().nullable(),
                    structuredData: z.string().optional().nullable(),
                    category: z.string().max(50).optional().nullable(),
                    tags: z.array(z.string()).optional(),
                    featured: z.boolean().optional(),
                    publishedAt: z.string().optional().nullable(),
                }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        updateBlogPostHandler
    );

    // Delete blog post
    app.withTypeProvider<ZodTypeProvider>().delete(
        "/:id",
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
            },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        deleteBlogPostHandler
    );
}
