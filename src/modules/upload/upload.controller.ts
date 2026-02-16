import { FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import util from "util";
import { pipeline } from "stream";
import path from "path";
import crypto from "crypto";
import { uploadToCloudinary } from "../../utils/cloudinary";

const pump = util.promisify(pipeline);
const unlinkAsync = util.promisify(fs.unlink);

export async function uploadFileHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    // 10MB Limit for high quality images
    const options = { limits: { fileSize: 10 * 1024 * 1024 } };
    const data = await request.file(options);

    if (!data) {
        return reply.code(400).send({ message: "No file uploaded" });
    }

    // --- SECURITY: STRICT TYPE VALIDATION ---
    const ALLOWED_MIMES = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf" // Keeping PDF just in case, though Cloudinary handles images best
    ];

    if (!ALLOWED_MIMES.includes(data.mimetype)) {
        data.file.resume(); // Consume stream
        return reply.code(400).send({
            message: "Invalid file type. Only JPG, PNG, WEBP, GIF allowed."
        });
    }

    // --- SECURITY: SANITIZE FILENAME ---
    const fileExtension = path.extname(data.filename).toLowerCase();

    // Prevent executable uploads
    if (['.exe', '.sh', '.js', '.php', '.bat'].includes(fileExtension)) {
        data.file.resume();
        return reply.code(400).send({ message: "Security Warning: File type not permitted." });
    }

    const randomName = crypto.randomUUID() + fileExtension;
    const tempDir = path.join(process.cwd(), "uploads", "temp");

    // Ensure temp dir exists
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, randomName);

    try {
        // 1. Save to backend server first (as requested)
        await pump(data.file, fs.createWriteStream(tempFilePath));

        // 2. Upload to Cloudinary
        const cloudResult = await uploadToCloudinary(tempFilePath);

        if (!cloudResult) {
            throw new Error("Cloudinary upload failed");
        }

        // 3. Return secure URL
        return reply.code(200).send({
            url: cloudResult.url, // The secure Cloudinary URL
            filename: data.filename,
            mimetype: data.mimetype,
            width: cloudResult.width,
            height: cloudResult.height
        });

    } catch (err: any) {
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
            return reply.code(413).send({ message: "File too large. Max 10MB." });
        }
        request.log.error(err);
        return reply.code(500).send({ message: "Upload failed" });
    } finally {
        // 4. Cleanup: Delete local temp file
        if (fs.existsSync(tempFilePath)) {
            try {
                await unlinkAsync(tempFilePath);
            } catch (cleanupErr) {
                request.log.error({ err: cleanupErr }, "Failed to cleanup temp file");
            }
        }
    }
}

