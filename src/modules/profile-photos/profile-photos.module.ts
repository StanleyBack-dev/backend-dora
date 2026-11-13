import { Module } from "@nestjs/common";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OwnPhotoUseCase } from "@/modules/profile-photos/application/own-photo.use-case";
import { ProfilePhotosResolver } from "@/modules/profile-photos/presentation/graphql/profile-photos.resolver";

// Profile photos: the account lives in identity and the file in the object
// storage (provided globally by SharedModule), so this small module joins the
// two without making identity depend on storage.
@Module({
  imports: [IdentityModule],
  providers: [OwnPhotoUseCase, ProfilePhotosResolver],
})
export class ProfilePhotosModule {}
