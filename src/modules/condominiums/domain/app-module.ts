// Optional parts of Dora a condominium contracts on top of the base plan
// (bookings, residents, announcements…). The platform administrator turns
// each one on per condominium; while off, its menu and API are closed.

export enum AppModule {
  /** Condominium events: tickets (free or paid by PIX) and entry by QR. */
  EVENTS = "EVENTS",
}

export const ALL_APP_MODULES: readonly AppModule[] = Object.values(AppModule);
