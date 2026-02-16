import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireSuperAdmin, requireAnyRole } from "../../shared/rbac";
import {
    listUsersHandler,
    createUserHandler,
    updateRoleHandler,
    resetPasswordHandler,
    deactivateUserHandler,
    activateUserHandler,
    deleteUserHandler,
    changeOwnPasswordHandler,
    createUserSchema,
    updateRoleSchema,
    resetPasswordSchema,
    changeOwnPasswordSchema,
} from "./users.controller";

export async function userRoutes(app: FastifyInstance) {
    // ─── Self-service: Change own password (ANY authenticated user) ───
    app.withTypeProvider<ZodTypeProvider>().patch(
        "/me/password",
        {
            schema: { body: changeOwnPasswordSchema },
            onRequest: [app.authenticate, requireAnyRole()],
        },
        // @ts-ignore — Zod type provider handler compatibility
        changeOwnPasswordHandler
    );

    // ─── SUPERADMIN-only routes ───

    // List all users
    app.get(
        "/",
        { onRequest: [app.authenticate, requireSuperAdmin()] },
        listUsersHandler
    );

    // Create new user
    app.withTypeProvider<ZodTypeProvider>().post(
        "/",
        {
            schema: { body: createUserSchema },
            onRequest: [app.authenticate, requireSuperAdmin()],
        },
        // @ts-ignore — Zod type provider handler compatibility
        createUserHandler
    );

    // Change user role
    app.withTypeProvider<ZodTypeProvider>().patch(
        "/:id/role",
        {
            schema: { body: updateRoleSchema },
            onRequest: [app.authenticate, requireSuperAdmin()],
        },
        // @ts-ignore — Zod type provider handler compatibility
        updateRoleHandler
    );

    // Reset user password
    app.withTypeProvider<ZodTypeProvider>().patch(
        "/:id/password",
        {
            schema: { body: resetPasswordSchema },
            onRequest: [app.authenticate, requireSuperAdmin()],
        },
        // @ts-ignore — Zod type provider handler compatibility
        resetPasswordHandler
    );

    // Deactivate user
    app.patch(
        "/:id/deactivate",
        { onRequest: [app.authenticate, requireSuperAdmin()] },
        // @ts-ignore — Fastify Params type inference
        deactivateUserHandler
    );

    // Activate user
    app.patch(
        "/:id/activate",
        { onRequest: [app.authenticate, requireSuperAdmin()] },
        // @ts-ignore — Fastify Params type inference
        activateUserHandler
    );

    // Delete user permanently
    app.delete(
        "/:id",
        { onRequest: [app.authenticate, requireSuperAdmin()] },
        // @ts-ignore — Fastify Params type inference
        deleteUserHandler
    );
}
