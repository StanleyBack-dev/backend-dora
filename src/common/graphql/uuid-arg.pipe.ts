import { ParseUUIDPipe } from "@nestjs/common";

/** Validates an ID argument as a UUID v4 (400 before reaching the resolver). */
export const UuidArg = () => new ParseUUIDPipe({ version: "4" });
