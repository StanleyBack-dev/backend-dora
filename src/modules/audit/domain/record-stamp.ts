// Who created a record and who changed it last, kept in the record's own
// table (created_by / created_at / updated_by / updated_at) instead of a
// separate, ever-growing log.

/** The tables that carry stamps, by the name the API and the UI use. */
export const STAMPED_TABLES = {
  user: { table: "tb_users", key: "idtb_users" },
  membership: { table: "tb_memberships", key: "idtb_memberships" },
  condominium: { table: "tb_condominiums", key: "idtb_condominiums" },
  unit: { table: "tb_units", key: "idtb_units" },
  space: { table: "tb_spaces", key: "idtb_spaces" },
  booking: { table: "tb_bookings", key: "idtb_bookings" },
  space_block: { table: "tb_space_blocks", key: "idtb_space_blocks" },
  broadcast: { table: "tb_broadcasts", key: "idtb_broadcasts" },
  enrollment_invite: {
    table: "tb_enrollment_invites",
    key: "idtb_enrollment_invites",
  },
  enrollment_request: {
    table: "tb_enrollment_requests",
    key: "idtb_enrollment_requests",
  },
  support_request: {
    table: "tb_support_requests",
    key: "idtb_support_requests",
  },
} as const;

export type StampedEntity = keyof typeof STAMPED_TABLES;

export const isStampedEntity = (value: string): value is StampedEntity =>
  Object.hasOwn(STAMPED_TABLES, value);

export type StampInput = {
  /** Who did it (null: the system). */
  actorId: string | null;
  entity: StampedEntity;
  entityId: string;
  /** The record was just created: also fills created_by. */
  created?: boolean;
};

export type RecordStamp = {
  createdAt: Date;
  createdById: string | null;
  createdByName: string | null;
  updatedAt: Date;
  updatedById: string | null;
  updatedByName: string | null;
};
