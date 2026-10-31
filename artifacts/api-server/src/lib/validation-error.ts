/**
 * Shared shape for 400 responses to a failed `safeParse`/`parse`. A raw
 * ZodError's `.message` is itself a JSON-stringified array of issue objects,
 * which leaks implementation details (internal Zod error codes, schema
 * shape, etc.) straight into the API response. This instead returns a clean,
 * generic error plus a structured list a caller could actually use.
 *
 * Deliberately duck-typed (not importing `ZodError` from "zod") since
 * `@workspace/api-zod`'s `safeParse().error` already has this shape and
 * api-server does not otherwise depend on "zod" directly.
 */
type ZodIssueLike = {
  path: (string | number)[];
  message: string;
};

type ZodErrorLike = {
  issues: ZodIssueLike[];
};

export function invalidRequestBody(error: ZodErrorLike): {
  error: string;
  details: { path: string; message: string }[];
} {
  return {
    error: "Invalid request",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
