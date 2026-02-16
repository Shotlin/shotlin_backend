import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
    getPublicTestimonialsHandler,
    getAllTestimonialsHandler,
    createTestimonialHandler,
    updateTestimonialHandler,
    deleteTestimonialHandler,
} from "./testimonials.controller";
import { requireAdmin } from "../../shared/rbac";

export async function testimonialRoutes(app: FastifyInstance) {
    // Public: get active testimonials
    app.get("/", getPublicTestimonialsHandler);

    // Protected: get ALL testimonials (including inactive)
    app.get("/admin/all", { onRequest: [app.authenticate, requireAdmin()] }, getAllTestimonialsHandler);

    // Protected: create testimonial
    app.withTypeProvider<ZodTypeProvider>().post(
        "/",
        {
            onRequest: [app.authenticate, requireAdmin()],
            schema: {
                body: z.object({
                    name: z.string().min(1, "Name is required"),
                    role: z.string().min(1, "Role is required"),
                    company: z.string().min(1, "Company is required"),
                    avatar: z.string().optional(),
                    companyLogo: z.string().optional(),
                    quote: z.string().min(10, "Quote must be at least 10 characters"),
                    rating: z.number().min(1).max(5).optional(),
                    featured: z.boolean().optional(),
                    sortOrder: z.number().optional(),
                    active: z.boolean().optional(),
                }),
            },
        },
        // @ts-ignore
        createTestimonialHandler
    );

    // Protected: update testimonial
    app.put(
        "/:id",
        {
            onRequest: [app.authenticate, requireAdmin()],
            schema: {
                body: z.object({
                    name: z.string().min(1).optional(),
                    role: z.string().min(1).optional(),
                    company: z.string().min(1).optional(),
                    avatar: z.string().optional(),
                    companyLogo: z.string().optional(),
                    quote: z.string().min(10).optional(),
                    rating: z.number().min(1).max(5).optional(),
                    featured: z.boolean().optional(),
                    sortOrder: z.number().optional(),
                    active: z.boolean().optional(),
                }),
            },
        },
        // @ts-ignore
        updateTestimonialHandler
    );

    // Protected: delete testimonial
    app.delete(
        "/:id",
        { onRequest: [app.authenticate, requireAdmin()] },
        // @ts-ignore
        deleteTestimonialHandler
    );
}
