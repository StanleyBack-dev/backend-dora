import { Inject, Injectable } from "@nestjs/common";
import {
  WAITLIST_REPOSITORY,
  type WaitlistRepositoryPort,
} from "@/modules/bookings/application/ports/waitlist-repository.port";

// Bookings' part of the daily housekeeping: waiting-list entries for slots
// that already started serve no one.
@Injectable()
export class BookingsMaintenanceService {
  constructor(
    @Inject(WAITLIST_REPOSITORY)
    private readonly waitlist: WaitlistRepositoryPort,
  ) {}

  purge(now: Date): Promise<number> {
    return this.waitlist.purgeStartedBefore(now);
  }
}
