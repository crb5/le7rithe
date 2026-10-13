export type MoorsylVerificationErrorKind =
  | "invalid_phone"
  | "rate_limited"
  | "denied"
  | "configuration"
  | "provider";

export class MoorsylVerificationError extends Error {
  constructor(readonly kind: MoorsylVerificationErrorKind) {
    super(kind);
    this.name = "MoorsylVerificationError";
  }
}

const verifyApiBaseUrl = "https://api.moorsyl.com/api/verify";
const requestTimeoutMs = 10_000;
const maxLoggedResponseBodyLength = 4_000;

export type MoorsylResponseLog = {
  operation: "send" | "check";
  httpStatus: number;
  responseBody: string;
};

export type MoorsylResponseLogger = (entry: MoorsylResponseLog) => void;

const sensitiveResponseKey = /api.?key|authorization|verification.?id|phone|recipient|(?:^|[_-])(?:to|otp|code)(?:$|[_-])|token|secret|password/i;

const redactProviderText = (text: string): string => text
  .replace(/\+?222(?:[\s().-]?\d){8}/g, "[REDACTED_PHONE]")
  .replace(/\b\d{6}\b/g, "[REDACTED_CODE]");

const redactProviderValue = (value: unknown, key?: string): unknown => {
  if (key && sensitiveResponseKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactProviderText(value);
  if (Array.isArray(value)) return value.map((item) => redactProviderValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        redactProviderValue(nestedValue, nestedKey),
      ]),
    );
  }
  return value;
};

const responseBodyForLogs = (rawBody: string): string => {
  let responseBody: string;
  try {
    responseBody = JSON.stringify(redactProviderValue(JSON.parse(rawBody)));
  } catch {
    responseBody = redactProviderText(rawBody);
  }
  return responseBody.length > maxLoggedResponseBodyLength
    ? `${responseBody.slice(0, maxLoggedResponseBodyLength)}…[truncated]`
    : responseBody;
};

const logMoorsylResponse: MoorsylResponseLogger = (entry) => {
  const line = `[Moorsyl Verify] ${JSON.stringify(entry)}`;
  if (entry.httpStatus >= 400) console.error(line);
  else console.info(line);
};

const apiKey = (): string => {
  const key = process.env.MOORSYL_PUBLISHABLE_KEY?.trim();
  if (!key) throw new MoorsylVerificationError("configuration");
  return key;
};

const postJson = async (
  path: "send" | "check",
  body: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<Response> => {
  try {
    return await fetchImpl(`${verifyApiBaseUrl}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    if (error instanceof MoorsylVerificationError) throw error;
    throw new MoorsylVerificationError("provider");
  }
};

const readJson = async (
  response: Response,
): Promise<{ body: Record<string, unknown>; rawBody: string }> => {
  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch {
    rawBody = "[unreadable response body]";
  }
  try {
    const body: unknown = JSON.parse(rawBody);
    return {
      body: body && typeof body === "object" && !Array.isArray(body)
        ? body as Record<string, unknown>
        : {},
      rawBody,
    };
  } catch {
    return { body: {}, rawBody };
  }
};

const throwProviderError = (status: number, path: "send" | "check"): never => {
  if (status === 429) throw new MoorsylVerificationError("rate_limited");
  if (status === 401 || status === 403) throw new MoorsylVerificationError("configuration");
  if (path === "send" && status === 400) throw new MoorsylVerificationError("invalid_phone");
  if (path === "check" && (status === 400 || status === 404)) {
    throw new MoorsylVerificationError("denied");
  }
  throw new MoorsylVerificationError("provider");
};

export const sendMoorsylVerification = async (
  phone: string,
  fetchImpl: typeof fetch = fetch,
  responseLogger: MoorsylResponseLogger = logMoorsylResponse,
): Promise<string> => {
  const response = await postJson("send", { to: phone }, fetchImpl);
  const { body, rawBody } = await readJson(response);
  responseLogger({
    operation: "send",
    httpStatus: response.status,
    responseBody: responseBodyForLogs(rawBody),
  });
  if (!response.ok) throwProviderError(response.status, "send");

  if (typeof body.verificationId !== "string" || !body.verificationId.trim()) {
    throw new MoorsylVerificationError("provider");
  }
  return body.verificationId;
};

export const checkMoorsylVerification = async (
  verificationId: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
  responseLogger: MoorsylResponseLogger = logMoorsylResponse,
): Promise<boolean> => {
  const response = await postJson("check", { verificationId, code }, fetchImpl);
  const { body, rawBody } = await readJson(response);
  responseLogger({
    operation: "check",
    httpStatus: response.status,
    responseBody: responseBodyForLogs(rawBody),
  });
  if (!response.ok) throwProviderError(response.status, "check");

  if (body.status === "approved") return true;
  if (body.status === "denied") return false;
  throw new MoorsylVerificationError("provider");
};
