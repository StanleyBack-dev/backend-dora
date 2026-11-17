import { ParseUUIDPipe } from "@nestjs/common";

/** Validates an ID argument as a UUID v4 (400 before reaching the resolver). */
export const UuidArg = () => new ParseUUIDPipe({ version: "4" });

/** The same for an optional ID argument (null or absent passes). */
export const OptionalUuidArg = () =>
  new ParseUUIDPipe({ version: "4", optional: true });
