
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Fail fast if Cloudinary credentials are missing
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("FATAL: Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) must be set in .env");
    process.exit(1);
}

// Configuration — credentials from environment only
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file to Cloudinary and returns the secure URL.
 * Optimized for performance and security.
 */
export const uploadToCloudinary = async (localFilePath: string) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: "shotlin_blog_uploads", // Organized folder
            use_filename: true,
            unique_filename: true,
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'], // Strict format check
            transformation: [
                { quality: "auto:good", fetch_format: "auto" }, // Optimization
                { width: 1200, crop: "limit" } // Prevent massive images
            ]
        });

        // File has been uploaded successfully
        return {
            url: response.secure_url,
            public_id: response.public_id,
            format: response.format,
            width: response.width,
            height: response.height
        };

    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        // Clean up checking is done in the controller
        throw error;
    }
};
