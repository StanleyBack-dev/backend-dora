import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import type {
  ClaimDecision,
  ClosedClaims,
  FoundItem,
  FoundItemClaim,
  FoundItemFilter,
  FoundItemOverview,
  FoundItemRepositoryPort,
  FoundItemReturn,
  ItemClosing,
  KeptViewer,
  NewFoundItem,
  NewFoundItemReturn,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  ClaimStatus,
  type FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";
import type { DocumentType } from "@/shared/domain/identity-document";
import {
  LocationStatus,
  type SignatureDevice,
  type SignatureDrawing,
  type SignatureLocation,
} from "@/shared/domain/signature/signature-capture";

const KEPT = FoundItemStatus.FOUND;

// Staff and owner names come from tb_users (identity), read-only; the
// count of pending claims from the claims table.
const SELECT = `
  SELECT f.idtb_found_items AS id, f.idtb_condominiums AS "condominiumId",
         f.category, f.title, f.description,
         f.private_details AS "privateDetails",
         f.found_location AS "foundLocation", f.found_at AS "foundAt",
         f.storage_location AS "storageLocation", f.photo_key AS "photoKey",
         f.photo_hidden AS "photoHidden", f.status,
         f.registered_by AS "registeredById", rb.name AS "registeredByName",
         f.keep_until AS "keepUntil",
         f.expiry_notified_at AS "expiryNotifiedAt",
         f.closed_at AS "closedAt", f.closed_by AS "closedById",
         cb.name AS "closedByName", f.close_reason AS "closeReason",
         f.returned_to AS "returnedToId", rt.name AS "returnedToName",
         r.signer_name AS "signerName",
         (SELECT count(*)::int FROM tb_found_item_claims c
           WHERE c.idtb_found_items = f.idtb_found_items
             AND c.status = '${ClaimStatus.PENDING}') AS "pendingClaims",
         (SELECT u.name FROM tb_found_item_claims c
            JOIN tb_users u ON u.idtb_users = c.idtb_users
           WHERE c.idtb_found_items = f.idtb_found_items
             AND c.status = '${ClaimStatus.ACCEPTED}'
           ORDER BY c.decided_at DESC NULLS LAST
           LIMIT 1) AS "awaitedByName",
         f.owner_unit_id AS "ownerUnitId", ou.street AS "ownerUnitStreet",
         ou.block AS "ownerUnitBlock", ou.number AS "ownerUnitNumber",
         f.owner_user_id AS "ownerUserId", ow.name AS "ownerUserName",
         f.created_at AS "createdAt"
    FROM tb_found_items f
    LEFT JOIN tb_users rb ON rb.idtb_users = f.registered_by
    LEFT JOIN tb_users cb ON cb.idtb_users = f.closed_by
    LEFT JOIN tb_users rt ON rt.idtb_users = f.returned_to
    LEFT JOIN tb_found_item_returns r ON r.idtb_found_items = f.idtb_found_items
    LEFT JOIN tb_units ou ON ou.idtb_units = f.owner_unit_id
    LEFT JOIN tb_users ow ON ow.idtb_users = f.owner_user_id`;

type ItemRow = Omit<FoundItem, "ownerUnitLabel"> & {
  ownerUnitStreet: string | null;
  ownerUnitBlock: string | null;
  ownerUnitNumber: string | null;
};

const toItem = (row: ItemRow): FoundItem => {
  const { ownerUnitStreet, ownerUnitBlock, ownerUnitNumber, ...item } = row;
  return {
    ...item,
    ownerUnitLabel:
      ownerUnitNumber !== null
        ? unitLabel({
            street: ownerUnitStreet,
            block: ownerUnitBlock ?? "",
            number: ownerUnitNumber,
          })
        : null,
  };
};

/** Most values offered in each filter list. */
const USED_VALUES_LIMIT = 300;

/** The note of the claim given to the resident the desk named. */
const OWNER_NOTE = "Indicado pela portaria no registro.";

/** Kept first, then the newest found. */
const ORDER = `ORDER BY (f.status = '${KEPT}') DESC, f.found_at DESC,
                        f.idtb_found_items`;

// A claim with its item, the resident and their unit there (identity and
// condominiums tables, read-only).
const CLAIM_SELECT = `
  SELECT c.idtb_found_item_claims AS id, c.idtb_found_items AS "itemId",
         f.title AS "itemTitle", f.status AS "itemStatus",
         f.category AS "itemCategory", f.idtb_condominiums AS "condominiumId",
         c.idtb_users AS "userId", u.name AS "userName",
         un.street AS "unitStreet", un.block AS "unitBlock",
         un.number AS "unitNumber",
         c.message, c.status, c.created_at AS "createdAt",
         c.decided_at AS "decidedAt", db.name AS "decidedByName",
         c.decision_note AS "decisionNote"
    FROM tb_found_item_claims c
    JOIN tb_found_items f ON f.idtb_found_items = c.idtb_found_items
    JOIN tb_users u ON u.idtb_users = c.idtb_users
    LEFT JOIN tb_memberships m
      ON m.idtb_users = c.idtb_users
     AND m.idtb_condominiums = f.idtb_condominiums
    LEFT JOIN tb_residents res ON res.idtb_memberships = m.idtb_memberships
    LEFT JOIN tb_units un ON un.idtb_units = res.idtb_units
    LEFT JOIN tb_users db ON db.idtb_users = c.decided_by`;

type ClaimRow = Omit<FoundItemClaim, "unitLabel"> & {
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

const toClaim = (row: ClaimRow): FoundItemClaim => {
  const { unitStreet, unitBlock, unitNumber, ...claim } = row;
  return {
    ...claim,
    unitLabel:
      unitNumber !== null
        ? unitLabel({
            street: unitStreet,
            block: unitBlock ?? "",
            number: unitNumber,
          })
        : null,
  };
};

type ReturnRow = Omit<FoundItemReturn, "location" | "drawing"> & {
  drawing: SignatureDrawing;
  locationStatus: LocationStatus;
  latitude: string | null;
  longitude: string | null;
  accuracyMeters: string | null;
};

const toLocation = (row: ReturnRow): SignatureLocation =>
  row.locationStatus === LocationStatus.GRANTED &&
  row.latitude !== null &&
  row.longitude !== null
    ? {
        status: LocationStatus.GRANTED,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        accuracyMeters:
          row.accuracyMeters !== null ? Number(row.accuracyMeters) : null,
      }
    : {
        status:
          row.locationStatus === LocationStatus.DENIED
            ? LocationStatus.DENIED
            : LocationStatus.UNAVAILABLE,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
      };

/** "%term%" for ILIKE, with the wildcards typed by the user escaped. */
const likeTerm = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

// Found items, claims and returns: raw SQL. Every change that ends an item
// is conditioned on it still being kept, so two staff members can't both
// hand it over; the open claims are closed in the same transaction.
@Injectable()
export class FoundItemSqlRepository implements FoundItemRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  create(
    item: NewFoundItem,
    notices: (item: FoundItem) => OutboxDraft[],
  ): Promise<FoundItem> {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_found_items
         (idtb_condominiums, category, title, description, private_details,
          found_location, found_at, storage_location, photo_key, photo_hidden,
          keep_until, registered_by, created_by, updated_by, owner_unit_id,
          owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $12,
               $13, $14)
       RETURNING idtb_found_items AS id`,
        [
          item.condominiumId,
          item.category,
          item.title,
          item.description,
          item.privateDetails,
          item.foundLocation,
          item.foundAt,
          item.storageLocation,
          item.photoKey,
          item.photoHidden,
          item.keepUntil,
          item.registeredBy,
          item.ownerUnitId,
          item.ownerUserId,
        ],
      );
      // Someone the desk knows it belongs to (a resident or a staff
      // member): their claim, accepted.
      if (item.ownerUserId) {
        await manager.query(
          `INSERT INTO tb_found_item_claims
           (idtb_found_items, idtb_users, status, decided_at, decided_by,
            decision_note)
         VALUES ($1, $2, '${ClaimStatus.ACCEPTED}', now(), $3, $4)`,
          [row.id, item.ownerUserId, item.registeredBy, OWNER_NOTE],
        );
      }
      // From a report: it must still be open (two desks at once: only the
      // first registers; the other gets "already ended" and nothing).
      if (item.lostReportId) {
        const [linked] = await manager.query<[{ id: string }[], number]>(
          `UPDATE tb_lost_reports
              SET status = '${LostReportStatus.FOUND}', closed_at = now(),
                  idtb_found_items = $2
            WHERE idtb_lost_reports = $1 AND idtb_condominiums = $3
              AND status = '${LostReportStatus.OPEN}'
            RETURNING idtb_lost_reports AS id`,
          [item.lostReportId, row.id, item.condominiumId],
        );
        if (linked.length === 0) {
          throw AppException.from(APP_ERRORS.lostFound.reportClosed, undefined);
        }
      }
      const created = await this.get(manager, row.id);
      await this.outbox.write(manager, notices(created));
      return created;
    });
  }

  release(
    itemId: string,
    by: string,
    at: Date,
    notices: (item: FoundItem) => OutboxDraft[],
  ): Promise<FoundItem | null> {
    return this.dataSource.transaction(async (manager) => {
      const [previous] = await manager.query<{ ownerUserId: string | null }[]>(
        `SELECT owner_user_id AS "ownerUserId" FROM tb_found_items
          WHERE idtb_found_items = $1 AND status = '${KEPT}'
            AND (owner_unit_id IS NOT NULL OR owner_user_id IS NOT NULL)
          FOR UPDATE`,
        [itemId],
      );
      if (!previous) return null;
      await manager.query(
        `UPDATE tb_found_items
            SET owner_unit_id = NULL, owner_user_id = NULL, updated_by = $2,
                updated_at = now()
          WHERE idtb_found_items = $1`,
        [itemId, by],
      );
      if (previous.ownerUserId) {
        await manager.query(
          `UPDATE tb_found_item_claims
              SET status = '${ClaimStatus.WITHDRAWN}', updated_at = $3
            WHERE idtb_found_items = $1 AND idtb_users = $2
              AND status IN ('${ClaimStatus.PENDING}', '${ClaimStatus.ACCEPTED}')`,
          [itemId, previous.ownerUserId, at],
        );
      }
      const item = await this.get(manager, itemId);
      await this.outbox.write(manager, notices(item));
      return item;
    });
  }

  async find(condominiumId: string, id: string): Promise<FoundItem | null> {
    const [item] = await this.query(
      this.dataSource.manager,
      `${SELECT} WHERE f.idtb_condominiums = $1 AND f.idtb_found_items = $2`,
      [condominiumId, id],
    );
    return item ?? null;
  }

  list(
    condominiumId: string,
    filter: FoundItemFilter,
    page: PageRequest,
  ): Promise<Paginated<FoundItem>> {
    const params: unknown[] = [condominiumId];
    const where = ["f.idtb_condominiums = $1"];
    if (filter.statuses) {
      params.push(filter.statuses);
      where.push(`f.status = ANY($${params.length}::varchar[])`);
    }
    if (filter.category) {
      params.push(filter.category);
      where.push(`f.category = $${params.length}`);
    }
    if (filter.search) {
      params.push(likeTerm(filter.search));
      const n = params.length;
      where.push(
        `(unaccent(f.title) ILIKE unaccent($${n})
          OR unaccent(coalesce(f.description, '')) ILIKE unaccent($${n})
          OR unaccent(f.found_location) ILIKE unaccent($${n}))`,
      );
    }
    for (const [column, value] of [
      ["title", filter.title],
      ["found_location", filter.foundLocation],
      ["storage_location", filter.storageLocation],
    ] as const) {
      if (!value) continue;
      params.push(value);
      where.push(
        `lower(unaccent(f.${column})) = lower(unaccent(${params.length}))`,
      );
    }
    if (filter.residentId) {
      params.push(filter.residentId);
      const n = params.length;
      where.push(
        `(f.owner_user_id = ${n}::uuid
          OR EXISTS (SELECT 1 FROM tb_found_item_claims c
                      WHERE c.idtb_found_items = f.idtb_found_items
                        AND c.idtb_users = ${n}::uuid))`,
      );
    }
    if (filter.withPendingClaims) {
      where.push(
        `EXISTS (SELECT 1 FROM tb_found_item_claims c
                  WHERE c.idtb_found_items = f.idtb_found_items
                    AND c.status = '${ClaimStatus.PENDING}')`,
      );
    }
    if (filter.from) {
      params.push(filter.from);
      where.push(`f.found_at >= $${params.length}`);
    }
    if (filter.to) {
      params.push(filter.to);
      where.push(`f.found_at < $${params.length}`);
    }
    return this.page(`WHERE ${where.join(" AND ")}`, params, page);
  }

  listKept(
    condominiumId: string,
    category: FoundItemCategory | null,
    viewer: KeptViewer,
    page: PageRequest,
  ): Promise<Paginated<FoundItem>> {
    // A reserved item shows only to whoever it is for (a resident or a
    // staff member), or, reserved for a unit, to that unit's residents.
    const params: unknown[] = [condominiumId, viewer.userId, viewer.unitId];
    const where = [
      "f.idtb_condominiums = $1",
      `f.status = '${KEPT}'`,
      `((f.owner_unit_id IS NULL AND f.owner_user_id IS NULL)
        OR f.owner_user_id = $2
        OR (f.owner_user_id IS NULL AND f.owner_unit_id = $3::uuid))`,
    ];
    if (category) {
      params.push(category);
      where.push(`f.category = $${params.length}`);
    }
    return this.page(`WHERE ${where.join(" AND ")}`, params, page);
  }

  async overview(
    condominiumId: string,
    expiringBefore: Date,
  ): Promise<FoundItemOverview> {
    const [
      byStatus,
      [counts],
      titles,
      foundLocations,
      storageLocations,
      residents,
    ] = await Promise.all([
      this.dataSource.query<{ status: FoundItemStatus; count: number }[]>(
        `SELECT status, count(*)::int AS count
           FROM tb_found_items WHERE idtb_condominiums = $1
          GROUP BY status`,
        [condominiumId],
      ),
      this.dataSource.query<{ pendingClaims: number; expiringSoon: number }[]>(
        `SELECT
           (SELECT count(*)::int FROM tb_found_item_claims c
              JOIN tb_found_items f ON f.idtb_found_items = c.idtb_found_items
             WHERE f.idtb_condominiums = $1
               AND c.status = '${ClaimStatus.PENDING}') AS "pendingClaims",
           (SELECT count(*)::int FROM tb_found_items
             WHERE idtb_condominiums = $1 AND status = '${KEPT}'
               AND keep_until < $2) AS "expiringSoon"`,
        [condominiumId, expiringBefore],
      ),
      this.usedValues(condominiumId, "title"),
      this.usedValues(condominiumId, "found_location"),
      this.usedValues(condominiumId, "storage_location"),
      this.dataSource.query<{ id: string; name: string }[]>(
        `SELECT u.idtb_users AS id, u.name
           FROM tb_users u
          WHERE u.idtb_users IN (
                  SELECT f.owner_user_id FROM tb_found_items f
                   WHERE f.idtb_condominiums = $1
                  UNION
                  SELECT c.idtb_users FROM tb_found_item_claims c
                    JOIN tb_found_items f
                      ON f.idtb_found_items = c.idtb_found_items
                   WHERE f.idtb_condominiums = $1)
          ORDER BY u.name
          LIMIT ${USED_VALUES_LIMIT}`,
        [condominiumId],
      ),
    ]);
    return {
      byStatus,
      pendingClaims: counts?.pendingClaims ?? 0,
      expiringSoon: counts?.expiringSoon ?? 0,
      titles,
      foundLocations,
      storageLocations,
      residents,
    };
  }

  /** The distinct values of a column, most recently found first. */
  private async usedValues(
    condominiumId: string,
    column: "title" | "found_location" | "storage_location",
  ): Promise<string[]> {
    const rows = await this.dataSource.query<{ value: string }[]>(
      `SELECT ${column} AS value
         FROM tb_found_items
        WHERE idtb_condominiums = $1
        GROUP BY ${column}
        ORDER BY max(found_at) DESC
        LIMIT ${USED_VALUES_LIMIT}`,
      [condominiumId],
    );
    return rows.map((row) => row.value);
  }

  async claimsOf(itemId: string): Promise<FoundItemClaim[]> {
    return this.claims(
      this.dataSource.manager,
      `${CLAIM_SELECT} WHERE c.idtb_found_items = $1
        ORDER BY c.created_at DESC`,
      [itemId],
    );
  }

  async latestClaimBy(
    itemId: string,
    userId: string,
  ): Promise<FoundItemClaim | null> {
    const [claim] = await this.claims(
      this.dataSource.manager,
      `${CLAIM_SELECT} WHERE c.idtb_found_items = $1 AND c.idtb_users = $2
        ORDER BY c.created_at DESC LIMIT 1`,
      [itemId, userId],
    );
    return claim ?? null;
  }

  async findClaim(
    condominiumId: string,
    id: string,
  ): Promise<FoundItemClaim | null> {
    const [claim] = await this.claims(
      this.dataSource.manager,
      `${CLAIM_SELECT}
        WHERE f.idtb_condominiums = $1 AND c.idtb_found_item_claims = $2`,
      [condominiumId, id],
    );
    return claim ?? null;
  }

  async claimsIn(
    condominiumId: string,
    open: boolean,
    page: PageRequest,
  ): Promise<Paginated<FoundItemClaim>> {
    const clause = open
      ? `WHERE f.idtb_condominiums = $1 AND f.status = '${KEPT}'
          AND c.status IN ('${ClaimStatus.PENDING}', '${ClaimStatus.ACCEPTED}')`
      : `WHERE f.idtb_condominiums = $1`;
    const order = open
      ? `ORDER BY (c.status = '${ClaimStatus.PENDING}') DESC, c.created_at`
      : `ORDER BY c.created_at DESC`;
    const [items, [count]] = await Promise.all([
      this.claims(
        this.dataSource.manager,
        `${CLAIM_SELECT} ${clause} ${order}, c.idtb_found_item_claims
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        [condominiumId],
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_found_item_claims c
           JOIN tb_found_items f ON f.idtb_found_items = c.idtb_found_items
          ${clause}`,
        [condominiumId],
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  async claimsBy(
    condominiumId: string,
    userId: string,
    page: PageRequest,
  ): Promise<Paginated<FoundItemClaim>> {
    const clause = `WHERE f.idtb_condominiums = $1 AND c.idtb_users = $2`;
    const [items, [count]] = await Promise.all([
      this.claims(
        this.dataSource.manager,
        `${CLAIM_SELECT} ${clause} ORDER BY c.created_at DESC
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        [condominiumId, userId],
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_found_item_claims c
           JOIN tb_found_items f ON f.idtb_found_items = c.idtb_found_items
          ${clause}`,
        [condominiumId, userId],
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  claim(
    itemId: string,
    userId: string,
    message: string | null,
    notices: (claim: FoundItemClaim) => OutboxDraft[],
  ): Promise<FoundItemClaim | null> {
    return this.dataSource.transaction(async (manager) => {
      // Only while kept; the unique index refuses a second open claim.
      const inserted = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_found_item_claims (idtb_found_items, idtb_users, message)
         SELECT $1, $2, $3
          WHERE EXISTS (SELECT 1 FROM tb_found_items
                         WHERE idtb_found_items = $1 AND status = '${KEPT}')
         ON CONFLICT DO NOTHING
         RETURNING idtb_found_item_claims AS id`,
        [itemId, userId, message],
      );
      if (inserted.length === 0) return null;
      const [claim] = await this.claims(
        manager,
        `${CLAIM_SELECT} WHERE c.idtb_found_item_claims = $1`,
        [inserted[0].id],
      );
      await this.outbox.write(manager, notices(claim));
      return claim;
    });
  }

  async withdrawClaim(claimId: string, userId: string): Promise<boolean> {
    const [updated] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE tb_found_item_claims
          SET status = '${ClaimStatus.WITHDRAWN}', updated_at = now()
        WHERE idtb_found_item_claims = $1 AND idtb_users = $2
          AND status = '${ClaimStatus.PENDING}'
        RETURNING idtb_found_item_claims AS id`,
      [claimId, userId],
    );
    return updated.length > 0;
  }

  decideClaim(
    claimId: string,
    decision: ClaimDecision,
    notices: (claim: FoundItemClaim) => OutboxDraft[],
  ): Promise<FoundItemClaim | null> {
    return this.dataSource.transaction(async (manager) => {
      const [updated] = await manager.query<[{ id: string }[], number]>(
        `UPDATE tb_found_item_claims c
            SET status = $2, decision_note = $3, decided_at = $4,
                decided_by = $5, updated_at = now()
           FROM tb_found_items f
          WHERE c.idtb_found_item_claims = $1
            AND f.idtb_found_items = c.idtb_found_items
            AND c.status = '${ClaimStatus.PENDING}' AND f.status = '${KEPT}'
          RETURNING c.idtb_found_item_claims AS id`,
        [claimId, decision.status, decision.note, decision.at, decision.by],
      );
      if (updated.length === 0) return null;
      const [claim] = await this.claims(
        manager,
        `${CLAIM_SELECT} WHERE c.idtb_found_item_claims = $1`,
        [claimId],
      );
      await this.outbox.write(manager, notices(claim));
      return claim;
    });
  }

  returnItem(
    itemId: string,
    record: NewFoundItemReturn,
    note: string,
    notices: (item: FoundItem, rejected: ClosedClaims) => OutboxDraft[],
  ): Promise<FoundItem | null> {
    return this.dataSource.transaction(async (manager) => {
      const [updated] = await manager.query<[{ id: string }[], number]>(
        `UPDATE tb_found_items
            SET status = '${FoundItemStatus.RETURNED}', closed_at = $2,
                closed_by = $3, returned_to = $4, updated_by = $3,
                updated_at = now()
          WHERE idtb_found_items = $1 AND status = '${KEPT}'
          RETURNING idtb_found_items AS id`,
        [itemId, record.signedAt, record.collectedBy, record.claimantId],
      );
      if (updated.length === 0) return null;
      const { location } = record;
      await manager.query(
        `INSERT INTO tb_found_item_returns
           (idtb_found_items, claim_id, signer_name, signer_document_type,
            signer_document, declaration, image_key, image_sha256, strokes,
            strokes_sha256, signed_at, client_signed_at, client_time_zone,
            ip_address, user_agent, device, location_status, latitude,
            longitude, location_accuracy_m, collected_by, collected_by_name,
            collected_by_role, session_id, evidence, evidence_sha256)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
        [
          itemId,
          record.claimId,
          record.signerName,
          record.signerDocumentType,
          record.signerDocument,
          record.declaration,
          record.imageKey,
          record.imageSha256,
          JSON.stringify(record.drawing),
          record.strokesSha256,
          record.signedAt,
          record.clientSignedAt,
          record.clientTimeZone,
          record.ipAddress,
          record.userAgent,
          JSON.stringify(record.device),
          location.status,
          location.latitude,
          location.longitude,
          location.accuracyMeters,
          record.collectedBy,
          record.collectedByName,
          record.collectedByRole,
          record.sessionId,
          record.evidenceJson,
          record.evidenceSha256,
        ],
      );
      // The claim it closes is accepted (if it was still pending, the desk
      // checked the owner at the handover); every other open one is over.
      if (record.claimId) {
        await manager.query(
          `UPDATE tb_found_item_claims
              SET status = '${ClaimStatus.ACCEPTED}', decided_at = $2,
                  decided_by = $3, updated_at = now()
            WHERE idtb_found_item_claims = $1
              AND status = '${ClaimStatus.PENDING}'`,
          [record.claimId, record.signedAt, record.collectedBy],
        );
      }
      const rejected = await this.rejectOpenClaims(
        manager,
        itemId,
        record.claimId,
        note,
        record.collectedBy,
        record.signedAt,
      );
      const item = await this.get(manager, itemId);
      await this.outbox.write(manager, notices(item, rejected));
      return item;
    });
  }

  close(
    itemId: string,
    closing: ItemClosing,
    note: string,
    notices: (item: FoundItem, rejected: ClosedClaims) => OutboxDraft[],
  ): Promise<FoundItem | null> {
    return this.dataSource.transaction(async (manager) => {
      const [updated] = await manager.query<[{ id: string }[], number]>(
        `UPDATE tb_found_items
            SET status = $2, close_reason = $3, closed_at = $4,
                closed_by = $5, updated_by = $5, updated_at = now()
          WHERE idtb_found_items = $1 AND status = '${KEPT}'
          RETURNING idtb_found_items AS id`,
        [itemId, closing.status, closing.reason, closing.at, closing.by],
      );
      if (updated.length === 0) return null;
      const rejected = await this.rejectOpenClaims(
        manager,
        itemId,
        null,
        note,
        closing.by,
        closing.at,
      );
      const item = await this.get(manager, itemId);
      await this.outbox.write(manager, notices(item, rejected));
      return item;
    });
  }

  async findReturn(itemId: string): Promise<FoundItemReturn | null> {
    const [row] = await this.dataSource.query<ReturnRow[]>(
      `SELECT idtb_found_items AS "itemId", claim_id AS "claimId",
              signer_name AS "signerName",
              signer_document_type AS "signerDocumentType",
              signer_document AS "signerDocument", declaration,
              image_key AS "imageKey", image_sha256 AS "imageSha256",
              strokes AS drawing, strokes_sha256 AS "strokesSha256",
              signed_at AS "signedAt", client_signed_at AS "clientSignedAt",
              client_time_zone AS "clientTimeZone", ip_address AS "ipAddress",
              user_agent AS "userAgent", device,
              location_status AS "locationStatus", latitude, longitude,
              location_accuracy_m AS "accuracyMeters",
              collected_by AS "collectedById",
              collected_by_name AS "collectedByName",
              collected_by_role AS "collectedByRole",
              evidence, evidence_sha256 AS "evidenceSha256"
         FROM tb_found_item_returns WHERE idtb_found_items = $1`,
      [itemId],
    );
    if (!row) return null;
    const { locationStatus, latitude, longitude, accuracyMeters, ...rest } =
      row;
    void locationStatus;
    void latitude;
    void longitude;
    void accuracyMeters;
    return {
      ...rest,
      signerDocumentType: rest.signerDocumentType as DocumentType | null,
      device: (rest.device ?? {}) as SignatureDevice,
      location: toLocation(row),
    };
  }

  dueExpiry(before: Date, limit: number): Promise<FoundItem[]> {
    return this.query(
      this.dataSource.manager,
      `${SELECT}
        WHERE f.status = '${KEPT}' AND f.expiry_notified_at IS NULL
          AND f.keep_until < $1
        ORDER BY f.keep_until LIMIT ${Number(limit)}`,
      [before],
    );
  }

  markExpiryNotified(
    id: string,
    at: Date,
    notices: OutboxDraft[],
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const [updated] = await manager.query<[{ id: string }[], number]>(
        `UPDATE tb_found_items SET expiry_notified_at = $2
          WHERE idtb_found_items = $1 AND status = '${KEPT}'
            AND expiry_notified_at IS NULL
          RETURNING idtb_found_items AS id`,
        [id, at],
      );
      if (updated.length === 0) return false;
      await this.outbox.write(manager, notices);
      return true;
    });
  }

  async releasePhotos(closedBefore: Date): Promise<string[]> {
    const [rows] = await this.dataSource.query<[{ key: string }[], number]>(
      `UPDATE tb_found_items f SET photo_key = NULL
         FROM (SELECT idtb_found_items, photo_key FROM tb_found_items
                WHERE photo_key IS NOT NULL AND closed_at < $1
                FOR UPDATE) old
        WHERE f.idtb_found_items = old.idtb_found_items
        RETURNING old.photo_key AS key`,
      [closedBefore],
    );
    return rows.map((row) => row.key);
  }

  /** Rejects the item's open claims but `keep`; returns them (for notices). */
  private async rejectOpenClaims(
    manager: EntityManager,
    itemId: string,
    keep: string | null,
    note: string,
    by: string,
    at: Date,
  ): Promise<ClosedClaims> {
    const [rows] = await manager.query<[{ id: string }[], number]>(
      `UPDATE tb_found_item_claims
          SET status = '${ClaimStatus.REJECTED}', decision_note = $3,
              decided_at = $4, decided_by = $5, updated_at = now()
        WHERE idtb_found_items = $1
          AND status IN ('${ClaimStatus.PENDING}', '${ClaimStatus.ACCEPTED}')
          AND ($2::uuid IS NULL OR idtb_found_item_claims <> $2::uuid)
        RETURNING idtb_found_item_claims AS id`,
      [itemId, keep, note, at, by],
    );
    if (rows.length === 0) return [];
    return this.claims(
      manager,
      `${CLAIM_SELECT} WHERE c.idtb_found_item_claims = ANY($1::uuid[])`,
      [rows.map((row) => row.id)],
    );
  }

  private async page(
    clause: string,
    params: unknown[],
    page: PageRequest,
  ): Promise<Paginated<FoundItem>> {
    const [items, [count]] = await Promise.all([
      this.query(
        this.dataSource.manager,
        `${SELECT} ${clause} ${ORDER}
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_found_items f ${clause}`,
        params,
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  private async get(manager: EntityManager, id: string): Promise<FoundItem> {
    const [item] = await this.query(
      manager,
      `${SELECT} WHERE f.idtb_found_items = $1`,
      [id],
    );
    if (!item) throw new Error(`Found item ${id} not found`);
    return item;
  }

  private async query(
    manager: EntityManager,
    sql: string,
    params: unknown[],
  ): Promise<FoundItem[]> {
    return (await manager.query<ItemRow[]>(sql, params)).map(toItem);
  }

  private async claims(
    manager: EntityManager,
    sql: string,
    params: unknown[],
  ): Promise<FoundItemClaim[]> {
    const rows = await manager.query<ClaimRow[]>(sql, params);
    return rows.map(toClaim);
  }
}
