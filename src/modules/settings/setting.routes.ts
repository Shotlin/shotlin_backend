import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { listSettingsHandler, upsertSettingsHandler } from "./setting.controller";
import { requireAdmin } from "../../shared/rbac";

// Whitelist of allowed setting keys
const settingsBodySchema = z.object({
    settings: z.array(z.object({
        key: z.string().min(1).max(100),
        value: z.string().max(2000),
    })).max(50),
});

export async function settingRoutes(app: FastifyInstance) {
    // Public — anyone can read site settings
    app.get("/", listSettingsHandler);

    // Admin only — update settings
    app.withTypeProvider<ZodTypeProvider>().put(
        "/",
        {
            schema: { body: settingsBodySchema },
            onRequest: [app.authenticate, requireAdmin()],
        },
        // @ts-ignore
        upsertSettingsHandler
    );
}
