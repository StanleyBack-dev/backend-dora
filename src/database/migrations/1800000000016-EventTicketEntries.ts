import { randomInt } from "crypto";
import type { MigrationInterface, QueryRunner } from "typeorm";

// No 0/O, 1/I/L (the same alphabet as the order codes).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const code = () =>
  Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    "",
  );

// Event tickets at the gate: each person of an order gets a ticket code (in
// the QR and typed at the gate; valid once the order is confirmed) and the
// entry the gate records (when and by whom, undone on a mistake). People of
// orders made before this get their codes here.
export class EventTicketEntries1800000000016 implements MigrationInterface {
  name = "EventTicketEntries1800000000016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_event_attendees"
        ADD COLUMN "ticket_code" varchar(10),
        ADD COLUMN "checked_in_at" timestamptz,
        ADD COLUMN "checked_in_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL`);
    const rows: { id: string }[] = await queryRunner.query(
      `SELECT "idtb_event_attendees" AS id FROM "tb_event_attendees"`,
    );
    const used = new Set<string>();
    for (const row of rows) {
      let next = code();
      while (used.has(next)) next = code();
      used.add(next);
      await queryRunner.query(
        `UPDATE "tb_event_attendees" SET "ticket_code" = $2
          WHERE "idtb_event_attendees" = $1`,
        [row.id, next],
      );
    }
    await queryRunner.query(
      `ALTER TABLE "tb_event_attendees" ALTER COLUMN "ticket_code" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_event_attendees_ticket_code"
         ON "tb_event_attendees" ("ticket_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_event_attendees_ticket_code"`);
    await queryRunner.query(`
      ALTER TABLE "tb_event_attendees"
        DROP COLUMN "checked_in_by",
        DROP COLUMN "checked_in_at",
        DROP COLUMN "ticket_code"`);
  }
}
