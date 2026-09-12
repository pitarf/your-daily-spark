import type { EstablishmentRole } from "./auth-client";

/** Rotas administrativas que não fazem parte do espaço pessoal do profissional. */
export const ADMIN_ONLY_DASHBOARD_SEGMENTS = [
  "/dashboard/appointments",
  "/dashboard/services",
  "/dashboard/professionals",
  "/dashboard/customers",
  "/dashboard/team",
  "/dashboard/plans",
  "/dashboard/profile",
  "/dashboard/settings",
] as const;

export function canAccessDashboardPath(role: EstablishmentRole, pathname: string): boolean {
  if (role !== "professional") return true;
  return pathname === "/dashboard";
}

export function isAdminRole(role: EstablishmentRole): boolean {
  return role === "admin";
}
