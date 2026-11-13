// Capabilities checked by the API. Pages in the frontend map to these too, so
// one list drives the menu, route guards and buttons. Each new module (e.g.
// bookings) adds its own permissions here.
export enum Permission {
  /** Manager's overview (counts across modules). */
  DASHBOARD_READ = "DASHBOARD_READ",
  NOTIFICATIONS_BROADCAST = "NOTIFICATIONS_BROADCAST",
  USERS_MANAGE = "USERS_MANAGE",
  PERMISSIONS_MANAGE = "PERMISSIONS_MANAGE",
  AUDIT_READ = "AUDIT_READ",
  /** Answer and close the app's support requests. */
  SUPPORT_MANAGE = "SUPPORT_MANAGE",
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);
