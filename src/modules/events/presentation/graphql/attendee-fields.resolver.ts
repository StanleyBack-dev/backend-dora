import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { AttendeeType } from "@/modules/events/presentation/graphql/dto/outputs/attendee.output";
import { documentFileName } from "@/shared/application/document-file";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// A person's document as a short-lived link. Every query that returns an
// order already checked the caller (the buyer, or whoever reviews payments).
@Resolver(() => AttendeeType)
export class AttendeeFieldsResolver {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Link temporário do documento enviado.",
  })
  async proofUrl(@Parent() attendee: AttendeeType): Promise<string | null> {
    if (!attendee.proofKey) return null;
    return this.storage.signedReadUrl(attendee.proofKey, {
      downloadName: documentFileName(
        `documento-${attendee.id}`,
        attendee.proofContentType,
      ),
    });
  }
}
