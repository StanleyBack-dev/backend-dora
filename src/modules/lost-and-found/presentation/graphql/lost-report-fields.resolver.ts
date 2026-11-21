import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { LostReportType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/lost-report.output";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// The photo of a "Perdi algo" report, as a short-lived link. The queries
// that return reports already limit them to their owner or the desk.
@Resolver(() => LostReportType)
export class LostReportFieldsResolver {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Link temporário da foto do objeto (nulo: sem foto).",
  })
  photoUrl(@Parent() report: LostReportType): Promise<string | null> | null {
    return report.photoKey ? this.storage.signedReadUrl(report.photoKey) : null;
  }
}
