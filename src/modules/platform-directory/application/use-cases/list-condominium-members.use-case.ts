import { Inject, Injectable } from "@nestjs/common";
import {
  PLATFORM_DIRECTORY_READER,
  type CondominiumMember,
  type PlatformDirectoryReaderPort,
} from "@/modules/platform-directory/application/ports/platform-directory-reader.port";

// The people of one condominium for the platform (its page in Plataforma →
// Condomínios): managers, the gate and residents, without entering it.
@Injectable()
export class ListCondominiumMembersUseCase {
  constructor(
    @Inject(PLATFORM_DIRECTORY_READER)
    private readonly directory: PlatformDirectoryReaderPort,
  ) {}

  execute(condominiumId: string): Promise<CondominiumMember[]> {
    return this.directory.membersOf(condominiumId);
  }
}
