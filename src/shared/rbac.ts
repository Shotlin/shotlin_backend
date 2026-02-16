import { FastifyRequest, FastifyReply } from "fastify";

// Valid roles in hierarchy order (highest privilege first)
export const ROLES = ["SUPERADMIN", "ADMIN", "TEAM_MEMBER"] as const;
export type Role = (typeof ROLES)[number];

/**
 * RBAC Middleware — checks that the authenticated user has one of the allowed roles.
 * Also verifies the user is still active in the database (prevents deactivated users
 * from using old JWTs).
 *
 * Usage: { onRequest: [server.authenticate, requireRole("SUPERADMIN")] }
 */
export function requireRole(...allowedRoles: Role[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const jwtUser = request.user as { id: string; email: string; role: string };

        // 1. Check role from JWT
        if (!allowedRoles.includes(jwtUser.role as Role)) {
            return reply.code(403).send({ message: "Forbidden: insufficient permissions" });
        }

        // 2. Verify user is still active in DB (prevents deactivated users with valid JWTs)
        try {
            const dbUser = await request.server.prisma.user.findUnique({
                where: { id: jwtUser.id },
                select: { isActive: true, role: true },
            });

            if (!dbUser) {
                return reply.code(401).send({ message: "User not found" });
            }

            if (!dbUser.isActive) {
                return reply.code(403).send({ message: "Account has been deactivated" });
            }

            // Verify role hasn't changed since JWT was issued (e.g. demoted)
            if (!allowedRoles.includes(dbUser.role as Role)) {
                return reply.code(403).send({ message: "Forbidden: role has changed, please re-login" });
            }
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ message: "Internal Server Error" });
        }
    };
}

/** Shorthand: SUPERADMIN only */
export const requireSuperAdmin = () => requireRole("SUPERADMIN");

/** Shorthand: SUPERADMIN or ADMIN */
export const requireAdmin = () => requireRole("SUPERADMIN", "ADMIN");

/** Shorthand: Any authenticated + active role */
export const requireAnyRole = () => requireRole("SUPERADMIN", "ADMIN", "TEAM_MEMBER");
