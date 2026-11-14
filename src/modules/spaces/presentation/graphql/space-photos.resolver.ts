import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import {
  SpacePhotoLinksService,
  type SpacePhotoLink,
} from "@/modules/spaces/application/space-photo-links.service";
import { SpacePhotoType } from "@/modules/spaces/presentation/graphql/dto/outputs/space-photo.output";
import { SpaceType } from "@/modules/spaces/presentation/graphql/dto/outputs/space.output";

// Photo links are signed on demand (they expire), never stored.
@Resolver(() => SpaceType)
export class SpacePhotosResolver {
  constructor(private readonly links: SpacePhotoLinksService) {}

  @ResolveField(() => [SpacePhotoType], { description: "Até 3 fotos." })
  photos(@Parent() space: SpaceType): Promise<SpacePhotoLink[]> {
    return this.links.links(space.photoRefs);
  }
}
