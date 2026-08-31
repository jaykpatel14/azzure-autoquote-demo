import { prisma } from "../lib/prisma";

async function main() {
  const latest = await prisma.aiAnalysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      createdAt: true,
      renderingStatus: true,
      renderingError: true,
      renderingModel: true,
      renderingStorageKey: true,
      renderingDataUrl: true,
      sourceImageStorageKey: true,
      imageDataUrl: true,
      output: true
    }
  });

  console.log("LATEST ANALYSES:", JSON.stringify(latest.map(l => ({
    id: l.id,
    createdAt: l.createdAt,
    renderingStatus: l.renderingStatus,
    renderingError: l.renderingError,
    renderingModel: l.renderingModel,
    renderingStorageKey: l.renderingStorageKey,
    hasRenderingDataUrl: Boolean(l.renderingDataUrl),
    hasImageDataUrl: Boolean(l.imageDataUrl)
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
