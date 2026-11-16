import type { EventView } from "@/modules/events/application/ports/event-repository.port";
import { salesClosesAt } from "@/modules/events/domain/event";
import type { EventType } from "@/modules/events/presentation/graphql/dto/outputs/event.output";

/** An event as the API shows it, with the places still free and when sales close. */
export const toEventType = (event: EventView): EventType => ({
  ...event,
  salesClosesAt: salesClosesAt(event),
  placesLeft: Math.max(0, event.capacity - event.heldPlaces),
  outsidePlacesLeft: Math.max(
    0,
    Math.min(
      event.externalGuestLimit - event.heldOutside,
      event.capacity - event.heldPlaces,
    ),
  ),
});
