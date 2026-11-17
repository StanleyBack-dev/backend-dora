import { Module } from "@nestjs/common";
import { PLATFORM_DIRECTORY_READER } from "@/modules/platform-directory/application/ports/platform-directory-reader.port";
import { ListCondominiumMembersUseCase } from "@/modules/platform-directory/application/use-cases/list-condominium-members.use-case";
import { ListPlatformPeopleUseCase } from "@/modules/platform-directory/application/use-cases/list-platform-people.use-case";
import { PlatformDirectorySqlReader } from "@/modules/platform-directory/infrastructure/persistence/platform-directory-sql.reader";
import { PlatformDirectoryResolver } from "@/modules/platform-directory/presentation/graphql/platform-directory.resolver";

// The platform directory: everyone with an account and the people of each
// condominium, read-only, for the platform administrator.
@Module({
  providers: [
    ListPlatformPeopleUseCase,
    ListCondominiumMembersUseCase,
    PlatformDirectoryResolver,
    {
      provide: PLATFORM_DIRECTORY_READER,
      useClass: PlatformDirectorySqlReader,
    },
  ],
})
export class PlatformDirectoryModule {}
