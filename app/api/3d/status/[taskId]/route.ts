import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMeshyTaskStatus } from "@/lib/meshy/client";
import { downloadAndStore3DModel } from "@/lib/meshy/storage";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;

    const modelRecord = await prisma.quote3DModel.findUnique({
      where: { meshyTaskId: taskId }
    });

    if (!modelRecord) {
      return NextResponse.json({ error: "3D model task not found" }, { status: 404 });
    }

    if (modelRecord.status === "SUCCEEDED" || modelRecord.status === "FAILED") {
      return NextResponse.json({ success: true, model: modelRecord });
    }

    // Fetch latest status from Meshy AI API
    const meshyStatus = await getMeshyTaskStatus(taskId);

    if (meshyStatus.status === "SUCCEEDED" && meshyStatus.model_urls) {
      const glbUrl = meshyStatus.model_urls.glb || null;
      const usdzUrl = meshyStatus.model_urls.usdz || null;
      const objUrl = meshyStatus.model_urls.obj || null;
      const fbxUrl = meshyStatus.model_urls.fbx || null;
      const thumbnailUrl = meshyStatus.thumbnail_url || null;

      let glbStorageKey: string | null = null;
      let usdzStorageKey: string | null = null;
      let objStorageKey: string | null = null;

      // Attempt background download to S3/local storage for persistence
      if (glbUrl) {
        try {
          glbStorageKey = await downloadAndStore3DModel({
            remoteUrl: glbUrl,
            companyId: modelRecord.companyId,
            modelId: modelRecord.id,
            format: "glb"
          });
        } catch (e) {
          console.warn("[3D Model Storage] Failed to store GLB asset:", e);
        }
      }

      if (usdzUrl) {
        try {
          usdzStorageKey = await downloadAndStore3DModel({
            remoteUrl: usdzUrl,
            companyId: modelRecord.companyId,
            modelId: modelRecord.id,
            format: "usdz"
          });
        } catch (e) {
          console.warn("[3D Model Storage] Failed to store USDZ asset:", e);
        }
      }

      if (objUrl) {
        try {
          objStorageKey = await downloadAndStore3DModel({
            remoteUrl: objUrl,
            companyId: modelRecord.companyId,
            modelId: modelRecord.id,
            format: "obj"
          });
        } catch (e) {
          console.warn("[3D Model Storage] Failed to store OBJ asset:", e);
        }
      }

      const updated = await prisma.quote3DModel.update({
        where: { id: modelRecord.id },
        data: {
          status: "SUCCEEDED",
          progress: 100,
          glbUrl,
          usdzUrl,
          objUrl,
          fbxUrl,
          glbStorageKey,
          usdzStorageKey,
          objStorageKey,
          thumbnailUrl
        }
      });

      return NextResponse.json({ success: true, model: updated });
    } else if (meshyStatus.status === "FAILED" || meshyStatus.status === "EXPIRED") {
      const updated = await prisma.quote3DModel.update({
        where: { id: modelRecord.id },
        data: {
          status: "FAILED",
          errorMessage: meshyStatus.task_error?.message || "Meshy 3D generation task failed or expired."
        }
      });

      return NextResponse.json({ success: true, model: updated });
    } else {
      // In progress or pending
      const updated = await prisma.quote3DModel.update({
        where: { id: modelRecord.id },
        data: {
          status: "IN_PROGRESS",
          progress: Math.min(Math.max(meshyStatus.progress || 0, 5), 95)
        }
      });

      return NextResponse.json({ success: true, model: updated });
    }
  } catch (error: any) {
    console.error("[3D Status Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch 3D status" },
      { status: 500 }
    );
  }
}
