import { describe, it, expect, vi, beforeEach } from "vitest";
import { contentTypeFor3DFormat, build3DModelStorageKey } from "@/lib/meshy/storage";

describe("Meshy AI 3D Storage & Client Utilities", () => {
  it("generates correct S3 storage keys for 3D model formats", () => {
    const key = build3DModelStorageKey("comp_123", "model_456", "glb");
    expect(key).toBe("models3d/comp_123/model_456.glb");

    const usdzKey = build3DModelStorageKey("comp_123", "model_456", "usdz");
    expect(usdzKey).toBe("models3d/comp_123/model_456.usdz");

    const objKey = build3DModelStorageKey("comp_123", "model_456", "obj");
    expect(objKey).toBe("models3d/comp_123/model_456.obj");
  });

  it("returns proper MIME content-types for 3D model formats", () => {
    expect(contentTypeFor3DFormat("glb")).toBe("model/gltf-binary");
    expect(contentTypeFor3DFormat("usdz")).toBe("model/vnd.usdz+zip");
    expect(contentTypeFor3DFormat("obj")).toBe("text/plain");
    expect(contentTypeFor3DFormat("fbx")).toBe("application/octet-stream");
  });
});
