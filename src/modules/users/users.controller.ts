import { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ROLES, Role } from "../../shared/rbac";

// ─── Zod Schemas ───

const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(1, "Name is required"),
    role: z.enum(["ADMIN", "TEAM_MEMBER"]).default("TEAM_MEMBER"),
});

const updateRoleSchema = z.object({
    role: z.enum(["ADMIN", "TEAM_MEMBER"]),
});

const resetPasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
});

const changeOwnPasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export {
    createUserSchema,
    updateRoleSchema,
    resetPasswordSchema,
    changeOwnPasswordSchema,
};

// ─── Handlers ───

/** GET /users — List all users (SUPERADMIN only) */
export async function listUsersHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const users = await request.server.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return reply.send({ status: "success", users });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch users" });
    }
}

/** POST /users — Create new user (SUPERADMIN only) */
export async function createUserHandler(
    request: FastifyRequest<{ Body: z.infer<typeof createUserSchema> }>,
    reply: FastifyReply
) {
    const { email, password, name, role } = request.body;

    try {
        // Check duplicate
        const existing = await request.server.prisma.user.findUnique({
            where: { email },
        });

        if (existing) {
            return reply.code(409).send({ message: "User with this email already exists" });
        }

        // Role is already validated by Zod schema (ADMIN or TEAM_MEMBER only)

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await request.server.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
            },
        });

        return reply.code(201).send({
            status: "success",
            message: "User created",
            user: { id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive },
        });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to create user" });
    }
}

/** PATCH /users/:id/role — Change user role (SUPERADMIN only) */
export async function updateRoleHandler(
    request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof updateRoleSchema> }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const { role } = request.body;
    const currentUser = request.user as { id: string; role: string };

    // Cannot change own role
    if (currentUser.id === id) {
        return reply.code(400).send({ message: "You cannot change your own role" });
    }

    try {
        const targetUser = await request.server.prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return reply.code(404).send({ message: "User not found" });
        }

        // Cannot modify another SUPERADMIN
        if (targetUser.role === "SUPERADMIN") {
            return reply.code(403).send({ message: "Cannot modify SUPERADMIN role" });
        }

        const updated = await request.server.prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, email: true, name: true, role: true, isActive: true },
        });

        return reply.send({ status: "success", message: `Role updated to ${role}`, user: updated });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to update role" });
    }
}

/** PATCH /users/:id/password — Reset any user's password (SUPERADMIN only) */
export async function resetPasswordHandler(
    request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof resetPasswordSchema> }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const { password } = request.body;

    try {
        const targetUser = await request.server.prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return reply.code(404).send({ message: "User not found" });
        }

        // Cannot reset another SUPERADMIN's password
        const currentUser = request.user as { id: string; role: string };
        if (targetUser.role === "SUPERADMIN" && currentUser.id !== id) {
            return reply.code(403).send({ message: "Cannot reset another SUPERADMIN's password" });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        await request.server.prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });

        return reply.send({ status: "success", message: "Password reset successfully" });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to reset password" });
    }
}

/** PATCH /users/:id/deactivate — Deactivate user (SUPERADMIN only) */
export async function deactivateUserHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const currentUser = request.user as { id: string };

    // Cannot deactivate self
    if (currentUser.id === id) {
        return reply.code(400).send({ message: "You cannot deactivate your own account" });
    }

    try {
        const targetUser = await request.server.prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return reply.code(404).send({ message: "User not found" });
        }

        if (targetUser.role === "SUPERADMIN") {
            return reply.code(403).send({ message: "Cannot deactivate a SUPERADMIN account" });
        }

        await request.server.prisma.user.update({
            where: { id },
            data: { isActive: false },
        });

        return reply.send({ status: "success", message: "User deactivated" });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to deactivate user" });
    }
}

/** PATCH /users/:id/activate — Reactivate user (SUPERADMIN only) */
export async function activateUserHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;

    try {
        const targetUser = await request.server.prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return reply.code(404).send({ message: "User not found" });
        }

        await request.server.prisma.user.update({
            where: { id },
            data: { isActive: true },
        });

        return reply.send({ status: "success", message: "User activated" });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to activate user" });
    }
}

/** DELETE /users/:id — Delete user permanently (SUPERADMIN only) */
export async function deleteUserHandler(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
) {
    const { id } = request.params;
    const currentUser = request.user as { id: string };

    // Cannot delete self
    if (currentUser.id === id) {
        return reply.code(400).send({ message: "You cannot delete your own account" });
    }

    try {
        const targetUser = await request.server.prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return reply.code(404).send({ message: "User not found" });
        }

        if (targetUser.role === "SUPERADMIN") {
            return reply.code(403).send({ message: "Cannot delete a SUPERADMIN account" });
        }

        await request.server.prisma.user.delete({ where: { id } });

        return reply.send({ status: "success", message: "User deleted permanently" });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to delete user" });
    }
}

/** PATCH /users/me/password — Change own password (ANY authenticated user) */
export async function changeOwnPasswordHandler(
    request: FastifyRequest<{ Body: z.infer<typeof changeOwnPasswordSchema> }>,
    reply: FastifyReply
) {
    const { currentPassword, newPassword } = request.body;
    const jwtUser = request.user as { id: string };

    try {
        const user = await request.server.prisma.user.findUnique({
            where: { id: jwtUser.id },
        });

        if (!user) {
            return reply.code(404).send({ message: "User not found" });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return reply.code(401).send({ message: "Current password is incorrect" });
        }

        // Prevent reusing same password
        const isSame = await bcrypt.compare(newPassword, user.password);
        if (isSame) {
            return reply.code(400).send({ message: "New password must be different from current password" });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await request.server.prisma.user.update({
            where: { id: jwtUser.id },
            data: { password: hashedPassword },
        });

        return reply.send({ status: "success", message: "Password changed successfully" });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ message: "Failed to change password" });
    }
}
