import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createBookingHandler, getAllBookingsHandler, updateBookingStatusHandler } from "./bookings.controller";

export async function bookingsRoutes(app: FastifyInstance) {
    // Protected: list all bookings
    app.get("/", { onRequest: [app.authenticate] }, getAllBookingsHandler);

    // Public: create a booking
    app.withTypeProvider<ZodTypeProvider>().post(
        "/",
        {
            schema: {
                body: z.object({
                    name: z.string().min(1, "Name is required"),
                    email: z.string().email("Invalid email"),
                    countryCode: z.string().min(1, "Country code is required"),
                    phone: z.string().min(4, "Phone number is required"),
                    service: z.string().min(1, "Service is required"),
                    brief: z.string().min(1, "Brief is required"),
                    agreedTerms: z.literal(true, { message: "You must agree to the Terms" }),
                }),
                response: {
                    201: z.object({
                        status: z.string(),
                        message: z.string(),
                        data: z.object({ id: z.string() }).optional(),
                    }),
                },
            },
        },
        createBookingHandler
    );

    // Protected: update booking status
    app.patch(
        "/:id/status",
        {
            schema: {
                body: z.object({
                    status: z.enum(["NEW", "CONTACTED", "CLOSED"]),
                }),
                response: {
                    200: z.object({
                        status: z.string(),
                        message: z.string(),
                        data: z.object({ id: z.string(), status: z.string() }),
                    }),
                },
            },
            onRequest: [app.authenticate],
        },
        // @ts-ignore
        updateBookingStatusHandler
    );
}
