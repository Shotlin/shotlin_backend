import { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { LoginInput } from "../../shared/schemas";
import { z } from "zod";

// Register Schema
export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one digit"),
    name: z.string().optional(),
    role: z.enum(["ADMIN", "TEAM_MEMBER"]).default("TEAM_MEMBER"),
});

type RegisterInput = z.infer<typeof registerSchema>;

export async function loginHandler(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply
) {
    const { email, password } = request.body;
    const user = await request.server.prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        return reply.code(401).send({ message: "Invalid email or password" });
    }

    // Check if account is deactivated
    if (!user.isActive) {
        return reply.code(403).send({ message: "Your account has been deactivated. Please contact the administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return reply.code(401).send({ message: "Invalid email or password" });
    }

    const token = request.server.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: "1d" }
    );

    reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60, // 1 day
    });

    return reply.send({
        status: "success",
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
}

export async function registerHandler(
    request: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply
) {
    const { email, password, name, role } = request.body;

    // Check if user exists
    const existingUser = await request.server.prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        return reply.code(409).send({ message: "Registration failed. Please try a different email." });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await request.server.prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
            role: role || "TEAM_MEMBER",
        },
    });

    return reply.code(201).send({
        status: "success",
        message: "User created",
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
}

export async function logoutHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ status: "success", message: "Logged out" });
}

// GET /auth/me — Returns the current authenticated user from the JWT
export async function meHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const jwtUser = request.user as { id: string; email: string; role: string };

    try {
        const user = await request.server.prisma.user.findUnique({
            where: { id: jwtUser.id },
            select: { id: true, email: true, name: true, role: true, isActive: true },
        });

        if (!user) {
            return reply.code(404).send({ message: "User not found" });
        }

        if (!user.isActive) {
            reply.clearCookie('token', { path: '/' });
            return reply.code(403).send({ message: "Account has been deactivated" });
        }

        return reply.send({ status: "success", user });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Internal Server Error" });
    }
}
