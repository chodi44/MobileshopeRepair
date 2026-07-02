import { createAPIFileRoute } from "@tanstack/react-start/api";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const APIRoute = createAPIFileRoute("/api/upload-photo")({
  POST: async ({ request }) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const customerId = formData.get("customerId") as string | null;

      if (!file || !customerId) {
        return new Response(JSON.stringify({ error: "Missing file or customerId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Cloudinary
      const result = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: `repair-shop/customers/${customerId}`,
                resource_type: "image",
                transformation: [
                  { width: 800, height: 800, crop: "limit", quality: "auto:good" },
                ],
              },
              (error, result) => {
                if (error || !result) return reject(error ?? new Error("Upload failed"));
                resolve(result as { secure_url: string; public_id: string });
              },
            )
            .end(buffer);
        },
      );

      return new Response(
        JSON.stringify({ url: result.secure_url, publicId: result.public_id }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (err) {
      console.error("[upload-photo]", err);
      return new Response(JSON.stringify({ error: "Upload failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
