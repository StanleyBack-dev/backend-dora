// Capabilities checked by the API. Pages in the frontend map to these too, so
// one list drives the menu, route guards and buttons. Each new module (e.g.
// bookings) adds its own permissions here.
//
// Inside a condominium they come from the member's role there (plus that
// membership's overrides); the platform administrator (ADMIN_MASTER) has all.
export enum Permission {
  /** Manager's overview of the condominium. */
  DASHBOARD_READ = "DASHBOARD_READ",
  NOTIFICATIONS_BROADCAST = "NOTIFICATIONS_BROADCAST",
  /** Members of the condominium: accounts, sign-ups and invites. */
  USERS_MANAGE = "USERS_MANAGE",
  PERMISSIONS_MANAGE = "PERMISSIONS_MANAGE",
  /** Blocks and units of the condominium. */
  UNITS_MANAGE = "UNITS_MANAGE",
  AUDIT_READ = "AUDIT_READ",
  /** Answer and close the app's support requests (platform). */
  SUPPORT_MANAGE = "SUPPORT_MANAGE",
  /** Create, edit and suspend condominiums (platform). */
  CONDOMINIUMS_MANAGE = "CONDOMINIUMS_MANAGE",
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);
