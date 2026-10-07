import { resolveRuntimeSetting } from "@/lib/app-settings";

export const MESHY_API_BASE_URL = process.env.MESHY_API_BASE_URL || "https://api.meshy.ai/v2";

export type MeshyTaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "EXPIRED";

export type MeshyModelUrls = {
  glb?: string;
  usdz?: string;
  obj?: string;
  fbx?: string;
  mtl?: string;
};

export type MeshyImageTo3DRequest = {
  imageUrl: string;
  enablePbr?: boolean;
  surfaceMode?: "hard_surface" | "organics";
  shouldRemesh?: boolean;
  targetPolycount?: number;
};

export type MeshyImageTo3DTaskResult = {
  result: string; // Task ID
};

export type MeshyTaskStatusResult = {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  model_urls?: MeshyModelUrls;
  thumbnail_url?: string;
  task_error?: {
    message: string;
  };
};

async function getMeshyApiKey(): Promise<string> {
  const apiKey = (await resolveRuntimeSetting("MESHY_API_KEY" as any)) || process.env.MESHY_API_KEY;
  if (!apiKey || apiKey === "your-meshy-api-key") {
    throw new Error("Meshy AI API key is not configured. Please set MESHY_API_KEY in environment or admin settings.");
  }
  return apiKey;
}

/**
  * Submits an Image-to-3D task to Meshy AI API V2.
  */
export async function createMeshyImageTo3DTask(
  params: MeshyImageTo3DRequest
): Promise<{ taskId: string }> {
  const apiKey = await getMeshyApiKey();

  const body: Record<string, any> = {
    image_url: params.imageUrl,
    enable_pbr: params.enablePbr ?? true,
    surface_mode: params.surfaceMode ?? "hard_surface",
    should_remesh: params.shouldRemesh ?? true,
  };

  if (params.targetPolycount) {
    body.target_polycount = params.targetPolycount;
  }

  const response = await fetch(`${MESHY_API_BASE_URL}/image-to-3d`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Meshy AI API error (${response.status}): ${errorText}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.message) message = parsed.message;
    } catch (_) {}
    throw new Error(message);
  }

  const data = (await response.json()) as MeshyImageTo3DTaskResult;
  if (!data.result) {
    throw new Error("Meshy AI API returned no task ID.");
  }

  return { taskId: data.result };
}

/**
  * Polls task status from Meshy AI API V2.
  */
export async function getMeshyTaskStatus(taskId: string): Promise<MeshyTaskStatusResult> {
  const apiKey = await getMeshyApiKey();

  const response = await fetch(`${MESHY_API_BASE_URL}/image-to-3d/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Meshy task status (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as MeshyTaskStatusResult;
  return data;
}
