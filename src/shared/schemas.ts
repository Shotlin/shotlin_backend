import { z } from "zod";

export const contactSchema = z.object({
    firstName: z.string().min(2, "First Name must be at least 2 characters"),
    lastName: z.string().min(2, "Last Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    subject: z.string().optional(),
    message: z.string().min(1, "Message cannot be empty"),
    visitorId: z.string().optional(),
    sender: z.string().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;
