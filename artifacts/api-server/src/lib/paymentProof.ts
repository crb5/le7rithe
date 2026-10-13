import { createHmac, timingSafeEqual } from "node:crypto";
import sharp from "sharp";

export const maxPaymentProofBytes = 1_800_000;
const maxPaymentProofPixels = 40_000_000;
export const paymentProofContentTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export class InvalidPaymentProofImageError extends Error {
  constructor(message = "Invalid payment proof image") {
    super(message);
    this.name = "InvalidPaymentProofImageError";
  }
}

export async function stripPaymentProofImageMetadata(
  input: Buffer,
  contentType: string,
): Promise<Buffer> {
  if (!paymentProofContentTypes.has(contentType) || !input.length || input.length > maxPaymentProofBytes) {
    throw new InvalidPaymentProofImageError();
  }

  try {
    const options = { limitInputPixels: maxPaymentProofPixels, failOn: "warning" as const };
    const metadata = await sharp(input, options).metadata();
    const expectedFormat = contentType === "image/jpeg"
      ? "jpeg"
      : contentType === "image/png"
        ? "png"
        : "webp";
    if (metadata.format !== expectedFormat || (metadata.pages ?? 1) > 1) {
      throw new InvalidPaymentProofImageError();
    }

    // Re-encoding applies orientation while dropping EXIF, GPS, and other metadata.
    const output = await sharp(input, options).rotate().toFormat(expectedFormat).toBuffer();
    if (output.length > maxPaymentProofBytes) {
      throw new InvalidPaymentProofImageError("Processed payment proof exceeds the upload limit");
    }
    return output;
  } catch (error) {
    if (error instanceof InvalidPaymentProofImageError) throw error;
    throw new InvalidPaymentProofImageError();
  }
}

export const validatePaymentProofMetadata = (body: unknown): boolean => {
  if (!body || typeof body !== "object") return false;
  const input = body as Record<string, unknown>;
  return (
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    typeof input.size === "number" &&
    Number.isInteger(input.size) &&
    input.size > 0 &&
    input.size <= maxPaymentProofBytes &&
    typeof input.contentType === "string" &&
    paymentProofContentTypes.has(input.contentType)
  );
};

export type PaymentProofBlob = {
  data: Buffer;
  contentType: string;
};

export type PaymentProofStorage<TFile> = {
  getObjectEntityFile: (objectPath: string) => Promise<TFile>;
  downloadObject: (file: TFile) => Promise<Response>;
};

const paymentProofUploadIdPattern =
  "([0-9a-f-]{36})\\.([A-Za-z0-9_-]{43})";
const legacyPaymentProofUploadIdPattern = "[0-9a-f-]{36}";
const paymentProofObjectPath = new RegExp(
  `^/objects/uploads/(?:${legacyPaymentProofUploadIdPattern}|${paymentProofUploadIdPattern})$`,
  "i",
);
const paymentProofUploadObjectName = new RegExp(
  `^uploads/(?:${legacyPaymentProofUploadIdPattern}|${paymentProofUploadIdPattern})$`,
  "i",
);
const signedPaymentProofObjectPath = new RegExp(
  `^/objects/uploads/${paymentProofUploadIdPattern}$`,
  "i",
);

const paymentProofSigningSecret = (): string => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured for payment proof uploads");
  }
  return secret;
};

const signatureFor = (userId: string, uploadId: string): string =>
  createHmac("sha256", paymentProofSigningSecret())
    .update(`${userId}:${uploadId}`)
    .digest("base64url");

export const createPaymentProofUploadId = (
  userId: string,
  uploadId: string,
): string => `${uploadId}.${signatureFor(userId, uploadId)}`;

export const isPaymentProofOwnedByUser = (
  objectPath: string,
  userId: string,
): boolean => {
  const match = objectPath.match(signedPaymentProofObjectPath);
  const uploadId = match?.[1];
  const signature = match?.[2];
  if (!uploadId || !signature) return false;
  const expected = signatureFor(userId, uploadId);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

export const isPaymentProofObjectPath = (value: unknown): value is string =>
  typeof value === "string" && paymentProofObjectPath.test(value);

export const isPaymentProofUploadObjectName = (value: unknown): value is string =>
  typeof value === "string" && paymentProofUploadObjectName.test(value);

export const paymentProofResponse = (proof: PaymentProofBlob): Response =>
  new Response(proof.data, {
    headers: {
      "Content-Type": proof.contentType,
      "Content-Length": String(proof.data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });

export async function loadPaymentProofResponse<TFile>({
  objectPath,
  storage,
}: {
  objectPath: string;
  storage: PaymentProofStorage<TFile>;
}): Promise<Response> {
  const objectFile = await storage.getObjectEntityFile(objectPath);
  return storage.downloadObject(objectFile);
}