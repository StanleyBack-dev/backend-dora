import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import {
  toUnitOptions,
  type UnitRow,
} from "@/modules/condominiums/infrastructure/persistence/unit-options";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  NewParcel,
  NewParcelSignature,
  Parcel,
  ParcelFilter,
  ParcelOverview,
  ParcelRepositoryPort,
  ParcelSignature,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import {
  LocationStatus,
  type SignatureDevice,
  type SignatureDrawing,
  type SignatureLocation,
} from "@/modules/parcels/domain/parcel-signature";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";
import type { DocumentType } from "@/shared/domain/identity-document";

type ParcelRow = Omit<Parcel, "unitLabel"> & {
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

type SignatureRow = Omit<ParcelSignature, "location" | "drawing"> & {
  drawing: SignatureDrawing;
  locationStatus: LocationStatus;
  latitude: string | null;
  longitude: string | null;
  accuracyMeters: string | null;
};

// Staff names and the unit come from tb_users and tb_units (identity and
// condominiums), read-only.
const SELECT = `
  SELECT p.idtb_parcels AS id, p.idtb_condominiums AS "condominiumId",
         p.idtb_units AS "unitId", un.street AS "unitStreet",
         un.block AS "unitBlock", un.number AS "unitNumber",
         p.recipient_name AS "recipientName",
         p.recipient_user_id AS "recipientUserId", p.carrier,
         p.tracking_code AS "trackingCode", p.notes,
         p.storage_location AS "storageLocation", p.photo_key AS "photoKey",
         p.pickup_code AS "pickupCode", p.status,
         p.received_at AS "receivedAt", p.received_by AS "receivedById",
         rb.name AS "receivedByName", p.closed_at AS "closedAt",
         p.closed_by AS "closedById", cb.name AS "closedByName",
         p.close_reason AS "closeReason", p.reminded_at AS "remindedAt",
         s.signer_name AS "signerName"
    FROM tb_parcels p
    LEFT JOIN tb_units un ON un.idtb_units = p.idtb_units
    LEFT JOIN tb_users rb ON rb.idtb_users = p.received_by
    LEFT JOIN tb_users cb ON cb.idtb_users = p.closed_by
    LEFT JOIN tb_parcel_signatures s ON s.idtb_parcels = p.idtb_parcels`;

/** Waiting at the gate first, then the newest. */
const ORDER = `ORDER BY (p.status = '${ParcelStatus.RECEIVED}') DESC,
                        p.received_at DESC, p.idtb_parcels`;

const toParcel = (row: ParcelRow): Parcel => {
  const { unitStreet, unitBlock, unitNumber, ...parcel } = row;
  return {
    ...parcel,
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

const toLocation = (row: SignatureRow): SignatureLocation =>
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

/** Most values offered in each filter list. */
const USED_VALUES_LIMIT = 300;

/** "%term%" for ILIKE, with the wildcards typed by the user escaped. */
const likeTerm = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

// Parcels and their signatures: raw SQL. Every change that ends a parcel is
// conditioned on it still being at the gate, so two staff members can't
// both hand it over.
@Injectable()
export class ParcelSqlRepository implements ParcelRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  create(
    parcel: NewParcel,
    notices: (parcel: Parcel) => OutboxDraft[],
  ): Promise<Parcel> {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_parcels
           (idtb_condominiums, idtb_units, recipient_name, recipient_user_id,
            carrier, tracking_code, notes, storage_location, photo_key,
            pickup_code, received_at, received_by, created_by, updated_by)
         VALUES (, , , , , , , , , , , , , )
         RETURNING idtb_parcels AS id`,
        [
          parcel.condominiumId,
          parcel.unitId,
          parcel.recipientName,
          parcel.recipientUserId,
          parcel.carrier,
          parcel.trackingCode,
          parcel.notes,
          parcel.storageLocation,
          parcel.photoKey,
          parcel.pickupCode,
          parcel.receivedAt,
          parcel.receivedBy,
        ],
      );
      const created = await this.get(manager, row.id);
      await this.outbox.write(manager, notices(created));
      return created;
    });
  }

  async find(condominiumId: string, id: string): Promise<Parcel | null> {
    const [parcel] = await this.query(
      this.dataSource.manager,
      `${SELECT} WHERE p.idtb_condominiums = $1 AND p.idtb_parcels = $2`,
      [condominiumId, id],
    );
    return parcel ?? null;
  }

  async findByCode(code: string): Promise<Parcel | null> {
    const [parcel] = await this.query(
      this.dataSource.manager,
      `${SELECT} WHERE p.pickup_code = $1`,
      [code],
    );
    return parcel ?? null;
  }

  async list(
    condominiumId: string,
    filter: ParcelFilter,
    page: PageRequest,
  ): Promise<Paginated<Parcel>> {
    const params: unknown[] = [condominiumId];
    const where = ["p.idtb_condominiums = $1"];
    if (filter.statuses) {
      params.push(filter.statuses);
      where.push(`p.status = ANY($${params.length}::varchar[])`);
    }
    if (filter.unitId) {
      params.push(filter.unitId);
      where.push(`p.idtb_units = $${params.length}`);
    }
    if (filter.search) {
      params.push(likeTerm(filter.search));
      const n = params.length;
      where.push(
        `(p.pickup_code ILIKE $${n} OR p.tracking_code ILIKE $${n}
          OR unaccent(p.recipient_name) ILIKE unaccent($${n})
          OR unaccent(p.carrier) ILIKE unaccent($${n}))`,
      );
    }
    for (const [column, value] of [
      ["recipient_name", filter.recipientName],
      ["carrier", filter.carrier],
      ["tracking_code", filter.trackingCode],
    ] as const) {
      if (!value) continue;
      params.push(value);
      where.push(
        `lower(unaccent(p.${column})) = lower(unaccent($${params.length}))`,
      );
    }
    if (filter.from) {
      params.push(filter.from);
      where.push(`p.received_at >= $${params.length}`);
    }
    if (filter.to) {
      params.push(filter.to);
      where.push(`p.received_at < $${params.length}`);
    }
    return this.page(`WHERE ${where.join(" AND ")}`, params, page);
  }

  listForUnit(
    unitId: string,
    viewerId: string,
    statuses: ParcelStatus[] | null,
    page: PageRequest,
  ): Promise<Paginated<Parcel>> {
    const params: unknown[] = [unitId, viewerId];
    const where = [
      "p.idtb_units = $1",
      "(p.recipient_user_id IS NULL OR p.recipient_user_id = $2)",
    ];
    if (statuses) {
      params.push(statuses);
      where.push(`p.status = ANY($3::varchar[])`);
    }
    return this.page(`WHERE ${where.join(" AND ")}`, params, page);
  }

  async overview(
    condominiumId: string,
    waitingSince: Date,
  ): Promise<ParcelOverview> {
    const [
      byStatus,
      [waiting],
      units,
      recipientNames,
      carriers,
      trackingCodes,
    ] = await Promise.all([
      this.dataSource.query<{ status: ParcelStatus; count: number }[]>(
        `SELECT status, count(*)::int AS count
           FROM tb_parcels WHERE idtb_condominiums = $1
          GROUP BY status`,
        [condominiumId],
      ),
      this.dataSource.query<{ count: number }[]>(
        `SELECT count(*)::int AS count
           FROM tb_parcels
          WHERE idtb_condominiums = $1 AND status = '${ParcelStatus.RECEIVED}'
            AND received_at < $2`,
        [condominiumId, waitingSince],
      ),
      this.dataSource.query<UnitRow[]>(
        `SELECT DISTINCT un.idtb_units AS id, un.street, un.block, un.number
           FROM tb_parcels p JOIN tb_units un ON un.idtb_units = p.idtb_units
          WHERE p.idtb_condominiums = $1`,
        [condominiumId],
      ),
      this.usedValues(condominiumId, "recipient_name"),
      this.usedValues(condominiumId, "carrier"),
      this.usedValues(condominiumId, "tracking_code"),
    ]);
    return {
      byStatus,
      waitingLong: waiting?.count ?? 0,
      units: toUnitOptions(units),
      recipientNames,
      carriers,
      trackingCodes,
    };
  }

  /** The distinct values of a column, most recently used first. */
  private async usedValues(
    condominiumId: string,
    column: "recipient_name" | "carrier" | "tracking_code",
  ): Promise<string[]> {
    const rows = await this.dataSource.query<{ value: string }[]>(
      `SELECT ${column} AS value
         FROM tb_parcels
        WHERE idtb_condominiums = $1 AND ${column} IS NOT NULL
        GROUP BY ${column}
        ORDER BY max(received_at) DESC
        LIMIT ${USED_VALUES_LIMIT}`,
      [condominiumId],
    );
    return rows.map((row) => row.value);
  }

  pickUp(
    id: string,
    signature: NewParcelSignature,
    notices: (parcel: Parcel) => OutboxDraft[],
  ): Promise<Parcel | null> {
    return this.dataSource.transaction(async (manager) => {
      const updated = await manager.query<{ id: string }[]>(
        `UPDATE tb_parcels
            SET status = '${ParcelStatus.PICKED_UP}', closed_at = $2,
                closed_by = $3, updated_by = $3, updated_at = now()
          WHERE idtb_parcels = $1 AND status = '${ParcelStatus.RECEIVED}'
          RETURNING idtb_parcels AS id`,
        [id, signature.signedAt, signature.collectedBy],
      );
      if (updated.length === 0) return null;
      const { location } = signature;
      await manager.query(
        `INSERT INTO tb_parcel_signatures
           (idtb_parcels, signer_name, signer_document_type, signer_document,
            declaration, image_key, image_sha256, strokes, strokes_sha256,
            signed_at, client_signed_at, client_time_zone, ip_address,
            user_agent, device, location_status, latitude, longitude,
            location_accuracy_m, collected_by, collected_by_name, collected_by_role,
            session_id,
            evidence, evidence_sha256)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
        [
          id,
          signature.signerName,
          signature.signerDocumentType,
          signature.signerDocument,
          signature.declaration,
          signature.imageKey,
          signature.imageSha256,
          JSON.stringify(signature.drawing),
          signature.strokesSha256,
          signature.signedAt,
          signature.clientSignedAt,
          signature.clientTimeZone,
          signature.ipAddress,
          signature.userAgent,
          JSON.stringify(signature.device),
          location.status,
          location.latitude,
          location.longitude,
          location.accuracyMeters,
          signature.collectedBy,
          signature.collectedByName,
          signature.collectedByRole,
          signature.sessionId,
          signature.evidenceJson,
          signature.evidenceSha256,
        ],
      );
      const parcel = await this.get(manager, id);
      await this.outbox.write(manager, notices(parcel));
      return parcel;
    });
  }

  close(
    id: string,
    change: {
      status: ParcelStatus.RETURNED | ParcelStatus.CANCELLED;
      reason: string;
      by: string;
      at: Date;
    },
    notices: (parcel: Parcel) => OutboxDraft[],
  ): Promise<Parcel | null> {
    return this.dataSource.transaction(async (manager) => {
      const updated = await manager.query<{ id: string }[]>(
        `UPDATE tb_parcels
            SET status = $2, close_reason = $3, closed_at = $4,
                closed_by = $5, updated_by = $5, updated_at = now()
          WHERE idtb_parcels = $1 AND status = '${ParcelStatus.RECEIVED}'
          RETURNING idtb_parcels AS id`,
        [id, change.status, change.reason, change.at, change.by],
      );
      if (updated.length === 0) return null;
      const parcel = await this.get(manager, id);
      await this.outbox.write(manager, notices(parcel));
      return parcel;
    });
  }

  async findSignature(parcelId: string): Promise<ParcelSignature | null> {
    const [row] = await this.dataSource.query<SignatureRow[]>(
      `SELECT idtb_parcels AS "parcelId", signer_name AS "signerName",
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
              collected_by_role AS "collectedByRole", session_id AS "sessionId",
              evidence, evidence_sha256 AS "evidenceSha256"
         FROM tb_parcel_signatures WHERE idtb_parcels = $1`,
      [parcelId],
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

  dueReminders(receivedBefore: Date, limit: number): Promise<Parcel[]> {
    return this.query(
      this.dataSource.manager,
      `${SELECT}
        WHERE p.status = '${ParcelStatus.RECEIVED}' AND p.reminded_at IS NULL
          AND p.received_at < $1 AND p.idtb_units IS NOT NULL
        ORDER BY p.received_at LIMIT ${Number(limit)}`,
      [receivedBefore],
    );
  }

  markReminded(id: string, at: Date, notices: OutboxDraft[]): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const updated = await manager.query<{ id: string }[]>(
        `UPDATE tb_parcels SET reminded_at = $2
          WHERE idtb_parcels = $1 AND status = '${ParcelStatus.RECEIVED}'
            AND reminded_at IS NULL
          RETURNING idtb_parcels AS id`,
        [id, at],
      );
      if (updated.length === 0) return false;
      await this.outbox.write(manager, notices);
      return true;
    });
  }

  async releasePhotos(closedBefore: Date): Promise<string[]> {
    const rows = await this.dataSource.query<{ key: string }[]>(
      `UPDATE tb_parcels p SET photo_key = NULL
         FROM (SELECT idtb_parcels, photo_key FROM tb_parcels
                WHERE photo_key IS NOT NULL AND closed_at < $1
                FOR UPDATE) old
        WHERE p.idtb_parcels = old.idtb_parcels
        RETURNING old.photo_key AS key`,
      [closedBefore],
    );
    return rows.map((row) => row.key);
  }

  private async page(
    clause: string,
    params: unknown[],
    page: PageRequest,
  ): Promise<Paginated<Parcel>> {
    const [items, [count]] = await Promise.all([
      this.query(
        this.dataSource.manager,
        `${SELECT} ${clause} ${ORDER}
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_parcels p ${clause}`,
        params,
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  private async get(manager: EntityManager, id: string): Promise<Parcel> {
    const [parcel] = await this.query(
      manager,
      `${SELECT} WHERE p.idtb_parcels = $1`,
      [id],
    );
    if (!parcel) throw new Error(`Parcel ${id} not found`);
    return parcel;
  }

  private async query(
    manager: EntityManager,
    sql: string,
    params: unknown[],
  ): Promise<Parcel[]> {
    const rows = await manager.query<ParcelRow[]>(sql, params);
    return rows.map(toParcel);
  }
}
