import { registerEnumType } from "@nestjs/graphql";
import { EventStatus } from "@/modules/events/domain/event";

registerEnumType(EventStatus, {
  name: "EventStatus",
  description: "Rascunho (só gestores), publicado ou cancelado.",
});

/** Which events to list. */
export enum EventWhen {
  UPCOMING = "UPCOMING",
  PAST = "PAST",
}

registerEnumType(EventWhen, {
  name: "EventWhen",
  description: "Próximos (ainda não terminaram) ou passados.",
});
