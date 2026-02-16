import { FastifyInstance } from "fastify";
import { uploadFileHandler } from "./upload.controller";

export async function uploadRoutes(server: FastifyInstance) {
    server.post("/", { onRequest: [server.authenticate] }, uploadFileHandler);
}
