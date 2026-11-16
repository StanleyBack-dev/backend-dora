import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { EventOrderType } from "@/modules/events/presentation/graphql/dto/outputs/event-order.output";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// The receipt as a short-lived link. Every query that returns an order
// already checked the caller (the buyer, or whoever reviews payments).
@Resolver(() => EventOrderType)
export class EventOrderFieldsResolver {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Link temporário do comprovante enviado.",
  })
  async receiptUrl(@Parent() order: EventOrderType): Promise<string | null> {
    if (!order.receiptKey) return null;
    const extension =
      order.receiptContentType === "application/pdf" ? "pdf" : "webp";
    return this.storage.signedReadUrl(order.receiptKey, {
      downloadName: `comprovante-${order.code}.${extension}`,
    });
  }
}
