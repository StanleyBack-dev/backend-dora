import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";

// Some booking operations change with who asks (a manager may cancel any
// booking at any time, see who holds a slot…): one place reads that.
@Injectable()
export class BookingAccessService {
  constructor(private readonly permissions: PermissionsService) {}

  async canManage(actor: AuthenticatedUser): Promise<boolean> {
    return (await this.permissions.effectiveFor(actor)).has(
      Permission.BOOKINGS_MANAGE,
    );
  }
}
