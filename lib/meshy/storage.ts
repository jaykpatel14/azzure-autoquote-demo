import { getQuotePdfBucketName, storeQuotePdfInS3, loadQuotePdfFromS3 } from "@/lib/quote-pdf-s3";

export function build3DModelStorageKey(companyId: string, modelId: string, format: "glb" | "usdz" | "obj" | "fbx") {
  const safeModelId = modelId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `models3d/${companyId}/${safeModelId}.${format}`;
}

export function contentTypeFor3DFormat(format: "glb" | "usdz" | "obj" | "fbx"): string {
  switch (format) {
    case "glb":
      return "model/gltf-binary";
    case "usdz":
      return "model/vnd.usdz+zip";
    case "obj":
      return "text/plain";
    case "fbx":
      return "application/octet-stream";
    default:
      return "application/octet-stream";
  }
}

/**
  * Downloads a remote 3D model asset from Meshy AI output URL and persists it to S3 / local storage.
  */
export async function downloadAndStore3DModel(params: {
  remoteUrl: string;
  companyId: string;
  modelId: string;
  format: "glb" | "usdz" | "obj" | "fbx";
}): Promise<string> {
  const response = await fetch(params.remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download remote 3D file from ${params.remoteUrl}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storageKey = build3DModelStorageKey(params.companyId, params.modelId, params.format);
  const contentType = contentTypeFor3DFormat(params.format);

  await storeQuotePdfInS3({
    key: storageKey,
    buffer,
    contentType,
  });

  return storageKey;
}
