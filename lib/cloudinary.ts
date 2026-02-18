import { v2 as cloudinary } from "cloudinary";
import { getEnv } from "@/lib/env";

function configureCloudinary() {
  const env = getEnv();
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
  return env;
}

export function createSignedMediaUrl(
  assetId: string,
  resourceType: "image" | "video",
  expiresInSeconds = 15 * 60
) {
  configureCloudinary();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return cloudinary.url(assetId, {
    resource_type: resourceType,
    type: "authenticated",
    secure: true,
    sign_url: true,
    expires_at: expiresAt,
    transformation: resourceType === "video" ? [{ quality: "auto", fetch_format: "auto" }] : []
  });
}

export function createBlurredVideoPreviewUrl(assetId: string, options?: { durationSeconds?: number }) {
  const env = getEnv();
  const duration = Math.min(Math.max(options?.durationSeconds || 8, 3), 15);

  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/video/upload/e_blur:1800,q_25,f_auto,so_0,du_${duration}/${assetId}.mp4`;
}

export function createSignedUploadParams(params: {
  folder?: string;
  publicId?: string;
  resourceType?: "image" | "video" | "auto";
}) {
  const env = configureCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);

  const signatureParams: Record<string, string | number> = {
    timestamp,
    folder: params.folder || "alina-members",
    resource_type: params.resourceType || "auto"
  };

  if (params.publicId) {
    signatureParams.public_id = params.publicId;
  }

  const signature = cloudinary.utils.api_sign_request(signatureParams, env.CLOUDINARY_API_SECRET);

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder: signatureParams.folder,
    signature,
    resourceType: signatureParams.resource_type
  };
}

export async function deleteMediaAsset(assetId: string, resourceType: "image" | "video") {
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(assetId, {
    resource_type: resourceType,
    invalidate: true
  });

  return result;
}
