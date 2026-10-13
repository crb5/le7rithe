export type AdminRouteActor = {
  role: string;
  status: string;
} | null;

export type AdminRouteAccessFailure = {
  status: 401 | 404;
  error: "Not found" | "Admin password required";
};

export function adminRouteAccessFailure(
  actor: AdminRouteActor,
  hasAdminSession: boolean,
): AdminRouteAccessFailure | null {
  if (!actor || actor.role !== "admin" || actor.status !== "active") {
    return { status: 404, error: "Not found" };
  }
  if (!hasAdminSession) {
    return { status: 401, error: "Admin password required" };
  }
  return null;
}
