// The usage fee of a booking. It is taken from the space when booking and
// kept on the booking, so a later change of price doesn't touch it; only
// bookings of a unit are charged (a manager booking for the condominium
// isn't). Cancelled and rejected bookings are never charged.

/** The fee to keep on a new booking (null: nothing to charge). */
export function feeForBooking(
  spaceFeeCents: number | null,
  unitId: string | null,
): number | null {
  return spaceFeeCents !== null && unitId !== null ? spaceFeeCents : null;
}

/** First instant of a month ("YYYY-MM") and of the next one, local dates. */
export function monthDates(month: string): { first: string; next: string } {
  const [year, number] = month.split("-").map(Number) as [number, number];
  const next =
    number === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(number + 1).padStart(2, "0")}-01`;
  return { first: `${month}-01`, next };
}

export const isMonth = (value: string): boolean =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
