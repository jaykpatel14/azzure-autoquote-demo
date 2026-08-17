import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

type QuotePdfStorageInput = {
  key: string;
  buffer: Buffer;
  contentType?: string;
};

const s3Clients = new Map<string, S3Client>();

export function getQuotePdfBucketName() {
  return process.env.S3_BUCKET?.trim() || null;
}

function getAwsRegion() {
  return process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || "us-east-1";
}

function getS3Client() {
  const region = getAwsRegion();
  const cached = s3Clients.get(region);
  if (cached) {
    return cached;
  }

  const client = new S3Client({ region });
  s3Clients.set(region, client);
  return client;
}

export function buildQuotePdfStorageKey(companyId: string, quoteNumber: string) {
  const safeQuoteNumber = quoteNumber.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `quotes/${companyId}/${safeQuoteNumber}.pdf`;
}

function getFileExtensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function buildAnalysisImageStorageKey(companyId: string, analysisId: string, mimeType: string) {
  const safeAnalysisId = analysisId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `analysis/${companyId}/${safeAnalysisId}.${getFileExtensionForMimeType(mimeType)}`;
}

export function buildQuoteRenderingStorageKey(companyId: string, quoteId: string) {
  const safeQuoteId = quoteId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `renderings/${companyId}/${safeQuoteId}.jpg`;
}

export async function storeQuotePdfInS3({ key, buffer, contentType = "application/pdf" }: QuotePdfStorageInput) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) {
    return null;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

  return { bucket, key };
}

export async function loadQuotePdfFromS3(key: string) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) {
    return null;
  }

  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  const body = response.Body;
  if (!body || typeof body !== "object" || !("transformToByteArray" in body)) {
    return null;
  }

  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteQuotePdfFromS3(key: string) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) return null;

  await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return { bucket, key };
}

async function streamToBuffer(body: Readable | { transformToByteArray: () => Promise<Uint8Array> } | undefined) {
  if (!body || typeof body !== "object") {
    return null;
  }

  if ("transformToByteArray" in body) {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function storeAnalysisImageInS3({
  key,
  buffer,
  contentType
}: QuotePdfStorageInput) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) {
    return null;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

  return { bucket, key };
}

export async function storeQuoteRenderingInS3(input: QuotePdfStorageInput) {
  return storeAnalysisImageInS3(input);
}

export async function loadQuoteRenderingDataUrlFromS3(key: string) {
  return loadAnalysisImageDataUrlFromS3({ key, mimeType: "image/jpeg" });
}

export async function loadAnalysisImageFromS3(key: string) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) {
    return null;
  }

  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  return streamToBuffer(response.Body as never);
}

export async function loadAnalysisImageDataUrlFromS3(params: {
  key: string;
  mimeType: string;
}) {
  const buffer = await loadAnalysisImageFromS3(params.key);
  if (!buffer) {
    return null;
  }

  return `data:${params.mimeType};base64,${buffer.toString("base64")}`;
}
