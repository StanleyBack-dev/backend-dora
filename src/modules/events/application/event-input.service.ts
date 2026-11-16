import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  EVENT_VIOLATION_MESSAGES,
  normalizeEvent,
  type EventData,
  type EventInput,
} from "@/modules/events/domain/event";
import { SpaceLookupService } from "@/modules/spaces/application/space-lookup.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The form of an event, checked the same way on create and on edit: the
// domain rules, then the space (only one of this condominium).
@Injectable()
export class EventInputService {
  constructor(
    private readonly spaces: SpaceLookupService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async validate(condominiumId: string, input: EventInput): Promise<EventData> {
    const data = normalizeEvent(input, this.clock.now());
    if (typeof data === "string") {
      throw AppException.from(APP_ERRORS.events.invalid, {
        reason: EVENT_VIOLATION_MESSAGES[data],
      });
    }
    if (
      data.spaceId &&
      !(await this.spaces.find(condominiumId, data.spaceId))
    ) {
      throw AppException.from(APP_ERRORS.events.spaceNotFound, undefined);
    }
    return data;
  }
}
