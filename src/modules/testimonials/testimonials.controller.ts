import { FastifyRequest, FastifyReply } from "fastify";

// GET /api/v1/testimonials — Public: active testimonials
export async function getPublicTestimonialsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const testimonials = await request.server.prisma.testimonial.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return reply.send({ status: "success", data: testimonials });
}

// GET /api/v1/testimonials/admin/all — Protected: all testimonials
export async function getAllTestimonialsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const testimonials = await request.server.prisma.testimonial.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return reply.send({ status: "success", data: testimonials });
}

// POST /api/v1/testimonials — Protected: create
export async function createTestimonialHandler(
    request: FastifyRequest<{
        Body: {
            name: string;
            role: string;
            company: string;
            avatar?: string;
            companyLogo?: string;
            quote: string;
            rating?: number;
            featured?: boolean;
            sortOrder?: number;
            active?: boolean;
        };
    }>,
    reply: FastifyReply
) {
    const { name, role, company, avatar, companyLogo, quote, rating, featured, sortOrder, active } = request.body;

    const testimonial = await request.server.prisma.testimonial.create({
        data: {
            name,
            role,
            company,
            avatar: avatar || "",
            companyLogo: companyLogo || null,
            quote,
            rating: rating ?? 5,
            featured: featured ?? false,
            sortOrder: sortOrder ?? 0,
            active: active ?? true,
        },
    });

    return reply.status(201).send({
        status: "success",
        message: "Testimonial created successfully",
        data: testimonial,
    });
}

// PUT /api/v1/testimonials/:id — Protected: update
export async function updateTestimonialHandler(
    request: FastifyRequest<{
        Params: { id: string };
        Body: {
            name?: string;
            role?: string;
            company?: string;
            avatar?: string;
            companyLogo?: string;
            quote?: string;
            rating?: number;
            featured?: boolean;
            sortOrder?: number;
            active?: boolean;
        };
    }>,
    reply: FastifyReply
) {
    const { id } = request.params;

    try {
        const testimonial = await request.server.prisma.testimonial.update({
            where: { id },
            data: request.body,
        });

        return reply.send({
            status: "success",
            message: "Testimonial updated successfully",
            data: testimonial,
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(404).send({ status: "error", message: "Testimonial not found" });
    }
}

// DELETE /api/v1/testimonials/:id — Protected: delete
export async function deleteTestimonialHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;

    try {
        await request.server.prisma.testimonial.delete({ where: { id } });
        return reply.send({ status: "success", message: "Testimonial deleted" });
    } catch (error) {
        request.log.error(error);
        return reply.status(404).send({ status: "error", message: "Testimonial not found" });
    }
}
