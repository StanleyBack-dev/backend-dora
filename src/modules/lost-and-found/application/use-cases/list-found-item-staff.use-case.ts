import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";

export type FoundItemStaffOption = {
  userId: string;
  name: string;
  /** "Portaria" or "Gestão". */
  roleLabel: string;
};

// Naming a staff member as a found item's owner: the condominium's active
// gate staff and managers, by name (a short list; the field filters it).
// Only their name and role: nothing else about them.
@Injectable()
export class ListFoundItemStaffUseCase {
  constructor(
    private readonly access: LostFoundAccessService,
    private readonly users: UserLookupService,
  ) {}

  async execute(actor: AuthenticatedUser): Promise<FoundItemStaffOption[]> {
    const condominiumId = await this.access.condominiumOf(actor);
    const [gate, managers] = await Promise.all([
      this.users.activeMemberIds(condominiumId, UserGroup.CONCIERGE),
      this.users.activeMemberIds(condominiumId, UserGroup.ADMIN),
    ]);
    const roles = new Map<string, string>([
      ...gate.map((id): [string, string] => [id, "Portaria"]),
      ...managers.map((id): [string, string] => [id, "Gestão"]),
    ]);
    const people = await Promise.all(
      [...roles.keys()].map((id) => this.users.findById(id)),
    );
    return people
      .flatMap((person) =>
        person?.active
          ? [
              {
                userId: person.id,
                name: person.name,
                roleLabel: roles.get(person.id) ?? "Equipe",
              },
            ]
          : [],
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
}
