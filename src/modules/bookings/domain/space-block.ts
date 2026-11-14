// A period a space can't be booked (maintenance, a condominium event…).

export type SpaceBlock = {
  id: string;
  condominiumId: string;
  spaceId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  createdBy: string | null;
  createdAt: Date;
};

export type BlockViolation = "range" | "past" | "too-long" | "reason";

/** At most a year in one block (a longer pause: deactivate the space). */
const MAX_BLOCK_MS = 366 * 86_400_000;

/** Validates a new block; the trimmed reason, or the first problem. */
export function checkBlock(
  input: { startsAt: Date; endsAt: Date; reason: string },
  now: Date,
): { reason: string } | BlockViolation {
  if (
    Number.isNaN(input.startsAt.getTime()) ||
    Number.isNaN(input.endsAt.getTime()) ||
    input.endsAt <= input.startsAt
  ) {
    return "range";
  }
  if (input.endsAt <= now) return "past";
  if (input.endsAt.getTime() - input.startsAt.getTime() > MAX_BLOCK_MS) {
    return "too-long";
  }
  const reason = input.reason.trim().replace(/\s+/g, " ");
  if (reason.length < 3 || reason.length > 200) return "reason";
  return { reason };
}

/** Whether two periods overlap (touching ends don't). */
export const overlaps = (
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean => a.startsAt < b.endsAt && b.startsAt < a.endsAt;
