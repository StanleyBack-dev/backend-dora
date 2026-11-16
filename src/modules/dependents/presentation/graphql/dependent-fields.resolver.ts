import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { DependentType } from "@/modules/dependents/presentation/graphql/dto/outputs/dependent.output";
import { documentFileName } from "@/shared/application/document-file";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// The document as a short-lived link. Every query that returns a dependent
// already checked the caller (its resident, or the managers).
@Resolver(() => DependentType)
export class DependentFieldsResolver {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @ResolveField(() => String, {
    description: "Link temporário do documento enviado.",
  })
  documentUrl(@Parent() dependent: DependentType): Promise<string> {
    return this.storage.signedReadUrl(dependent.documentKey, {
      downloadName: documentFileName(
        `documento-${dependent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        dependent.documentContentType,
      ),
    });
  }
}
