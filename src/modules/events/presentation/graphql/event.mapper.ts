import type { EventView } from "@/modules/events/application/ports/event-repository.port";
import type { EventType } from "@/modules/events/presentation/graphql/dto/outputs/event.output";

/** An event as the API shows it, with the places still free. */
export const toEventType = (event: EventView): EventType => ({
  ...event,
  placesLeft: Math.max(0, event.capacity - event.heldPlaces),
  outsidePlacesLeft: Math.max(
    0,
    Math.min(
      event.externalGuestLimit - event.heldOutside,
      event.capacity - event.heldPlaces,
    ),
  ),
});
