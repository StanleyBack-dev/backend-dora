import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AddSpacePhotoUseCase } from "@/modules/spaces/application/use-cases/add-space-photo.use-case";
import { CreateSpaceUseCase } from "@/modules/spaces/application/use-cases/create-space.use-case";
import { DeleteSpaceUseCase } from "@/modules/spaces/application/use-cases/delete-space.use-case";
import { ListSpacesUseCase } from "@/modules/spaces/application/use-cases/list-spaces.use-case";
import { RemoveSpacePhotoUseCase } from "@/modules/spaces/application/use-cases/remove-space-photo.use-case";
import { SetSpaceActiveUseCase } from "@/modules/spaces/application/use-cases/set-space-active.use-case";
import { UpdateSpaceUseCase } from "@/modules/spaces/application/use-cases/update-space.use-case";
import { SpaceInput } from "@/modules/spaces/presentation/graphql/dto/inputs/space.input";
import { SpaceType } from "@/modules/spaces/presentation/graphql/dto/outputs/space.output";
import {
  toSpaceData,
  toSpaceType,
} from "@/modules/spaces/presentation/graphql/space.mapper";

// Spaces of the session's condominium: every member reads; managing needs
// SPACES_MANAGE.
@Resolver()
export class SpacesResolver {
  constructor(
    private readonly listSpaces: ListSpacesUseCase,
    private readonly creating: CreateSpaceUseCase,
    private readonly updating: UpdateSpaceUseCase,
    private readonly activating: SetSpaceActiveUseCase,
    private readonly deleting: DeleteSpaceUseCase,
    private readonly addingPhoto: AddSpacePhotoUseCase,
    private readonly removingPhoto: RemoveSpacePhotoUseCase,
  ) {}

  @Query(() => [SpaceType], {
    description:
      "Espaços do condomínio atual. Inativos só com includeInactive, para quem gerencia espaços.",
  })
  async spaces(
    @CurrentUser() user: AuthenticatedUser,
    @Args("includeInactive", { defaultValue: false }) includeInactive: boolean,
  ): Promise<SpaceType[]> {
    return (await this.listSpaces.list(user, includeInactive)).map(toSpaceType);
  }

  @Query(() => SpaceType)
  async space(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<SpaceType> {
    return toSpaceType(await this.listSpaces.get(user, id));
  }

  @RequirePermissions(Permission.SPACES_MANAGE)
  @Mutation(() => SpaceType)
  async createSpace(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: SpaceInput,
  ): Promise<SpaceType> {
    return toSpaceType(await this.creating.execute(actor, toSpaceData(input)));
  }

  @RequirePermissions(Permission.SPACES_MANAGE)
  @Mutation(() => SpaceType)
  async updateSpace(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: SpaceInput,
  ): Promise<SpaceType> {
    return toSpaceType(
      await this.updating.execute(actor, id, toSpaceData(input)),
    );
  }

  @RequirePermissions(Permission.SPACES_MANAGE)
  @Mutation(() => SpaceType, {
    description: "Ativa ou desativa (manutenção) o espaço.",
  })
  async setSpaceActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("active") active: boolean,
  ): Promise<SpaceType> {
    return toSpaceType(await this.activating.execute(actor, id, active));
  }

  @RequirePermissions(Permission.SPACES_MANAGE)
  @Mutation(() => SpaceType, {
    description:
      "Adiciona uma foto (até 3 por espaço): JPEG, PNG ou WebP em base64, até 1,2 MB.",
  })
  async addSpacePhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("spaceId", { type: () => ID }, UuidArg()) spaceId: string,
    @Args("photo") photo: string,
  ): Promise<SpaceType> {
    return toSpaceType(await this.addingPhoto.execute(actor, spaceId, photo));
  }

  @RequirePermissions(Permission.SPACES_MANAGE)
  @Mutation(() => SpaceType)
  async removeSpacePhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("spaceId", { type: () => ID }, UuidArg()) spaceId: string,
    @Args("photoId", { type: () => ID }, UuidArg()) photoId: string,
  ): Promise<SpaceType> {
    return toSpaceType(
      await this.removingPhoto.execute(actor, spaceId, photoId),
    );
  }

  @RequirePermissions(Permission.SPACES_MANAGE)
  @Mutation(() => Boolean, { description: "Exclui o espaço." })
  async deleteSpace(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    await this.deleting.execute(actor, id);
    return true;
  }
}
