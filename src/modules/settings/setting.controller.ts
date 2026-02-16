import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── List All Settings (Public) ───────────────────────────────────────
export async function listSettingsHandler(
    _request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const rows = await prisma.siteSetting.findMany();
        const map: Record<string, string> = {};
        for (const r of rows) map[r.key] = r.value;
        return reply.send({ status: "success", data: map });
    } catch (error) {
        console.error("listSettings error:", error);
        return reply.code(500).send({ message: "Failed to fetch settings" });
    }
}

// ── Upsert Settings (Admin) ─────────────────────────────────────────
export async function upsertSettingsHandler(
    request: FastifyRequest<{ Body: { settings: { key: string; value: string }[] } }>,
    reply: FastifyReply
) {
    try {
        const { settings } = request.body;
        if (!settings || settings.length === 0) {
            return reply.code(400).send({ message: "No settings provided" });
        }

        await Promise.all(
            settings.map(({ key, value }) =>
                prisma.siteSetting.upsert({
                    where: { key },
                    update: { value: String(value) },
                    create: { key, value: String(value) },
                })
            )
        );

        return reply.send({ status: "success", message: "Settings updated" });
    } catch (error) {
        console.error("upsertSettings error:", error);
        return reply.code(500).send({ message: "Failed to update settings" });
    }
}
