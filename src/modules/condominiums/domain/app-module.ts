// Optional parts of Dora a condominium contracts on top of the base plan
// (bookings, residents, announcements…). The platform administrator turns
// each one on per condominium; while off, its menu and API are closed.

export enum AppModule {
  /** Spaces booked by residents: bookings, approvals, guests and fees. */
  BOOKINGS = "BOOKINGS",
  /** Condominium events: tickets (free or paid by PIX) and entry by QR. */
  EVENTS = "EVENTS",
  /** Parcels received at the gate, picked up with a signature on the screen. */
  PARCELS = "PARCELS",
  /** Lost and found: items kept by the gate, claimed and returned signed. */
  LOST_AND_FOUND = "LOST_AND_FOUND",
}

export const ALL_APP_MODULES: readonly AppModule[] = Object.values(AppModule);
