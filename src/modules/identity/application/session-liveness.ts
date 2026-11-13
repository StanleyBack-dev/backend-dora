import { type Principal } from "@/modules/identity/application/ports/principal-reader.port";

export const isLive = (principal: Principal, now: Date) =>
  principal.sessionRevokedAt === null && principal.sessionExpiresAt > now;
