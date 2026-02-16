import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { loginHandler, registerHandler, logoutHandler, meHandler, registerSchema } from "./auth.controller";
import { loginSchema } from "../../shared/schemas";
import { requireSuperAdmin } from "../../shared/rbac";

export async function authRoutes(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/login",
        {
            schema: {
                body: loginSchema,
            },
        },
        loginHandler
    );

    // Protected: only SUPERADMIN can create new users
    app.withTypeProvider<ZodTypeProvider>().post(
        "/register",
        {
            schema: {
                body: registerSchema,
            },
            onRequest: [app.authenticate, requireSuperAdmin()],
        },
        // @ts-ignore — Zod type provider handler compatibility
        registerHandler
    );

    app.post("/logout", logoutHandler);

    // Protected: get current authenticated user profile
    app.get("/me", { onRequest: [app.authenticate] }, meHandler);
}
