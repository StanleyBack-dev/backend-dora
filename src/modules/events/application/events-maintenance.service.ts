import { Inject, Injectable } from "@nestjs/common";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";

// Daily housekeeping of the events module: unpaid orders past their 48 h
// become EXPIRED (they already stopped holding places at that moment).
@Injectable()
export class EventsMaintenanceService {
  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
  ) {}

  expireOrders(now: Date): Promise<number> {
    return this.orders.expire(now);
  }
}
