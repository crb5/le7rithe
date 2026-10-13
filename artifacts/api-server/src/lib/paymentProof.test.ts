import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  createPaymentProofUploadId,
  isPaymentProofOwnedByUser,
  isPaymentProofObjectPath,
  loadPaymentProofResponse,
  maxPaymentProofBytes,
  paymentProofResponse,
  stripPaymentProofImageMetadata,
  validatePaymentProofMetadata,
  type PaymentProofStorage,
} from "./paymentProof";

const proofPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const uploadId = "11111111-1111-4111-8111-111111111111";
const objectPath = `/objects/uploads/${uploadId}.${"a".repeat(43)}`;

async function readResponse(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

function assertPrivateImageResponse(response: Response): void {
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-disposition"), "inline");
  assert.equal(response.url, "");
}

describe("payment proof response boundary", () => {
  it("serves the local fallback as a private image response", async () => {
    const response = paymentProofResponse({
      data: proofPng,
      contentType: "image/png",
    });

    assertPrivateImageResponse(response);
    assert.equal(response.headers.get("content-length"), String(proofPng.length));
    assert.deepEqual(await readResponse(response), proofPng);
  });

  it("serves private object storage as a private image response", async () => {
    let requestedPath = "";
    const storage: PaymentProofStorage<{ private: boolean }> = {
      getObjectEntityFile: async (requestedObjectPath) => {
        requestedPath = requestedObjectPath;
        return { private: true };
      },
      downloadObject: async (file) => {
        assert.deepEqual(file, { private: true });
        return new Response(proofPng, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
          },
        });
      },
    };

    const response = await loadPaymentProofResponse({
      objectPath,
      storage,
    });

    assert.equal(requestedPath, objectPath);
    assertPrivateImageResponse(response);
    assert.deepEqual(await readResponse(response), proofPng);
  });

  it("accepts only internal payment-proof object paths", () => {
    assert.equal(isPaymentProofObjectPath(objectPath), true);
    assert.equal(
      isPaymentProofObjectPath("https://storage.googleapis.com/private/uploads/receipt.png"),
      false,
    );
    assert.equal(isPaymentProofObjectPath("/objects/listing-images/11111111-1111-4111-8111-111111111111"), false);
  });

  it("binds an upload path to the seller who requested it", () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "payment-proof-test-secret";
    try {
      const sellerProofPath = `/objects/uploads/${createPaymentProofUploadId(
        "seller-one",
        uploadId,
      )}`;
      assert.equal(isPaymentProofOwnedByUser(sellerProofPath, "seller-one"), true);
      assert.equal(isPaymentProofOwnedByUser(sellerProofPath, "seller-two"), false);
    } finally {
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
  });
});

describe("payment proof upload metadata boundary", () => {
  it("removes EXIF metadata while preserving the supported image format", async () => {
    const withExif = await sharp({
      create: {
        width: 3,
        height: 2,
        channels: 3,
        background: { r: 20, g: 90, b: 140 },
      },
    })
      .jpeg()
      .withExif({ IFD0: { Artist: "Synthetic privacy test" } })
      .toBuffer();

    const sanitized = await stripPaymentProofImageMetadata(withExif, "image/jpeg");
    const metadata = await sharp(sanitized).metadata();

    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.exif, undefined);
  });

  it("rejects unsupported media types", () => {
    assert.equal(
      validatePaymentProofMetadata({
        name: "receipt.gif",
        size: proofPng.length,
        contentType: "image/gif",
      }),
      false,
    );
  });

  it("rejects empty names", () => {
    assert.equal(
      validatePaymentProofMetadata({
        name: "   ",
        size: proofPng.length,
        contentType: "image/png",
      }),
      false,
    );
  });

  it("rejects files larger than the upload limit", () => {
    assert.equal(
      validatePaymentProofMetadata({
        name: "receipt.png",
        size: maxPaymentProofBytes + 1,
        contentType: "image/png",
      }),
      false,
    );
  });

  it("accepts supported non-empty files within the upload limit", () => {
    assert.equal(
      validatePaymentProofMetadata({
        name: "receipt.webp",
        size: proofPng.length,
        contentType: "image/webp",
      }),
      true,
    );
  });
});
