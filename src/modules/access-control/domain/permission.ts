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
  /** Bookable spaces (courts, party room…) and their booking rules. */
  SPACES_MANAGE = "SPACES_MANAGE",
  /** Book spaces (residents; a manager may turn it off per member). */
  BOOKINGS_CREATE = "BOOKINGS_CREATE",
  /** Approve, reject and cancel any booking; block spaces; usage fees. */
  BOOKINGS_MANAGE = "BOOKINGS_MANAGE",
  /** The day's guests at the gate: list and check in (Portaria). */
  GUESTS_CHECKIN = "GUESTS_CHECKIN",
  /**
   * Residents' directory, read only: name, photo, unit, phone and approved
   * dependents (no e-mail, documents or birth dates). Gate and managers.
   */
  RESIDENTS_READ = "RESIDENTS_READ",
  /** Parcels: register, hand over (with signature), return; gate and administration (module contracted apart). */
  PARCELS_MANAGE = "PARCELS_MANAGE",
  /** Create, publish and cancel events (module contracted apart). */
  EVENTS_MANAGE = "EVENTS_MANAGE",
  /** The condominium's PIX and the review of payment receipts (e.g. event tickets). */
  PAYMENTS_MANAGE = "PAYMENTS_MANAGE",
  AUDIT_READ = "AUDIT_READ",
  /** Answer and close the app's support requests (platform). */
  SUPPORT_MANAGE = "SUPPORT_MANAGE",
  /** Record contributions to the project and edit its supporters (platform). */
  SUPPORTERS_MANAGE = "SUPPORTERS_MANAGE",
  /** Create, edit and suspend condominiums (platform). */
  CONDOMINIUMS_MANAGE = "CONDOMINIUMS_MANAGE",
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);
