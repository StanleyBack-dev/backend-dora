import type { SpaceData } from "@/modules/spaces/application/ports/space-repository.port";
import type { Space } from "@/modules/spaces/domain/space";
import type { Weekday } from "@/modules/spaces/domain/space-rules";
import type { SpaceInput } from "@/modules/spaces/presentation/graphql/dto/inputs/space.input";
import type { SpaceType } from "@/modules/spaces/presentation/graphql/dto/outputs/space.output";

/** A space as the API returns it. */
export const toSpaceType = (space: Space): SpaceType => ({
  id: space.id,
  name: space.name,
  kind: space.kind,
  description: space.description,
  capacity: space.capacity,
  usageRules: space.usageRules,
  active: space.active,
  rules: {
    ...space.rules,
    openingHours: space.rules.openingHours.map((day) => ({ ...day })),
  },
  photoRefs: space.photos,
  createdAt: space.createdAt,
  updatedAt: space.updatedAt,
});

/** The form as the use cases take it (the domain validates the values). */
export const toSpaceData = (input: SpaceInput): SpaceData => ({
  name: input.name,
  kind: input.kind,
  description: input.description ?? null,
  capacity: input.capacity ?? null,
  usageRules: input.usageRules ?? null,
  rules: {
    openingHours: input.rules.openingHours.map((day) => ({
      weekday: day.weekday as Weekday,
      opensAt: day.opensAt,
      closesAt: day.closesAt,
    })),
    slotMinutes: input.rules.slotMinutes,
    minAdvanceHours: input.rules.minAdvanceHours,
    maxAdvanceDays: input.rules.maxAdvanceDays,
    unitLimit: input.rules.unitLimit
      ? {
          count: input.rules.unitLimit.count,
          period: input.rules.unitLimit.period,
        }
      : null,
    requiresApproval: input.rules.requiresApproval,
    cancelUntilHours: input.rules.cancelUntilHours,
  },
});
