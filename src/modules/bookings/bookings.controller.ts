import { FastifyRequest, FastifyReply } from "fastify";

// POST /api/v1/bookings — public
export async function createBookingHandler(
    request: FastifyRequest<{
        Body: {
            name: string;
            email: string;
            countryCode: string;
            phone: string;
            service: string;
            brief: string;
            agreedTerms: boolean;
        };
    }>,
    reply: FastifyReply
) {
    const { name, email, countryCode, phone, service, brief, agreedTerms } = request.body;

    if (!agreedTerms) {
        return reply.status(400).send({ status: "error", message: "You must agree to the Terms of Service and Privacy Policy." });
    }

    try {
        const booking = await request.server.prisma.booking.create({
            data: { name, email, countryCode, phone, service, brief, agreedTerms },
        });

        return reply.status(201).send({
            status: "success",
            message: "Booking created successfully",
            data: { id: booking.id },
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ status: "error", message: "Failed to create booking" });
    }
}

// GET /api/v1/bookings — protected
export async function getAllBookingsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const bookings = await request.server.prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
    });

    return reply.send({ status: "success", data: bookings });
}

// PATCH /api/v1/bookings/:id/status — protected
export async function updateBookingStatusHandler(
    request: FastifyRequest<{
        Params: { id: string };
        Body: { status: string };
    }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const { status } = request.body;

    // Validate status whitelist
    const allowedStatuses = ["NEW", "CONTACTED", "CLOSED"];
    if (!allowedStatuses.includes(status)) {
        return reply.status(400).send({
            status: "error",
            message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
        });
    }

    try {
        const updated = await request.server.prisma.booking.update({
            where: { id },
            data: { status },
        });

        return reply.send({
            status: "success",
            message: "Booking status updated",
            data: updated,
        });
    } catch (error) {
        request.log.error(error);
        return reply.status(404).send({ status: "error", message: "Booking not found" });
    }
}
