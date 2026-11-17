import { Inject, Injectable } from "@nestjs/common";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import {
  PLATFORM_DIRECTORY_READER,
  type PlatformDirectoryReaderPort,
  type PlatformPerson,
} from "@/modules/platform-directory/application/ports/platform-directory-reader.port";
import { normalizePeopleFilter } from "@/modules/platform-directory/domain/people-filter";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// Everyone with an account on Dora (the platform's directory): found by
// name, e-mail or user name, by role or condominium, with where each one
// has access.
@Injectable()
export class ListPlatformPeopleUseCase {
  constructor(
    @Inject(PLATFORM_DIRECTORY_READER)
    private readonly directory: PlatformDirectoryReaderPort,
  ) {}

  execute(
    input: {
      search?: string | null;
      role?: UserGroup | null;
      condominiumId?: string | null;
    },
    page: PageRequest,
  ): Promise<Paginated<PlatformPerson>> {
    return this.directory.people(normalizePeopleFilter(input), page);
  }
}
