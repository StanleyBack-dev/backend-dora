/** Someone waiting for a taken slot of a space. */
export type WaitlistEntry = {
  condominiumId: string;
  spaceId: string;
  userId: string;
  startsAt: Date;
};

export interface WaitlistRepositoryPort {
  /** Joins the list (already on it: nothing changes). */
  join(entry: WaitlistEntry): Promise<void>;
  leave(spaceId: string, startsAt: Date, userId: string): Promise<void>;
  /** Who waits for the slot, in the order they joined. */
  waiting(spaceId: string, startsAt: Date): Promise<string[]>;
  /** The starts the person waits for in a space within [from, to). */
  startsFor(
    spaceId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Date[]>;
  /** Entries whose slot already started (maintenance). */
  purgeStartedBefore(before: Date): Promise<number>;
}

export const WAITLIST_REPOSITORY = Symbol("WAITLIST_REPOSITORY");
