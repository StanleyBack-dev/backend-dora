import { Injectable } from "@nestjs/common";
import { CondominiumPixLookupService } from "@/modules/condominiums/application/condominium-pix-lookup.service";
import type { CondominiumEvent } from "@/modules/events/domain/event";
import { EventPixSource } from "@/modules/events/domain/event-tickets";
import type { PixReceiver } from "@/shared/domain/pix";

// Which PIX receives an event's tickets: the event's own (CUSTOM) or the
// condominium's. Null when there is none to charge with.
@Injectable()
export class EventPaymentService {
  constructor(private readonly condominiumPix: CondominiumPixLookupService) {}

  async pixFor(
    event: Pick<CondominiumEvent, "condominiumId" | "pixSource" | "customPix">,
  ): Promise<PixReceiver | null> {
    if (event.pixSource === EventPixSource.CUSTOM) return event.customPix;
    if (event.pixSource === EventPixSource.CONDOMINIUM) {
      return this.condominiumPix.find(event.condominiumId);
    }
    return null;
  }
}
