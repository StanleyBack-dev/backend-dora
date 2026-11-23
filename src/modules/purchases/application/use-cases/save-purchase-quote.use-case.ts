import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  type PurchaseQuoteInput,
  validateQuoteInput,
} from "@/modules/purchases/application/purchase-quote-input";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import type { PurchaseQuote } from "@/modules/purchases/domain/purchase-quote";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";
import { prepareDocument } from "@/shared/application/document-file";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

/** The supplier's document: a new one, kept as is, or removed. */
export type QuoteFileChange =
  { kind: "keep" } | { kind: "remove" } | { kind: "replace"; base64: string };

const locked = () =>
  AppException.from(APP_ERRORS.purchases.quotesLocked, undefined);

// The management records the quotes of a request (one per supplier): adds
// them while the request waits for or is in quotes (the first one moves it
// to "Em cotação"), edits and removes them while it is in quotes (the last
// one removed moves it back). The supplier's document is stored apart.
@Injectable()
export class SavePurchaseQuoteUseCase {
  private readonly logger = new Logger(SavePurchaseQuoteUseCase.name);

  constructor(
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  private async loadRequest(condominiumId: string, id: string) {
    const request = await this.requests.find(condominiumId, id);
    if (!request) {
      throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
    }
    return request;
  }

  private async loadQuote(condominiumId: string, id: string) {
    const quote = await this.quotes.find(condominiumId, id);
    if (!quote) {
      throw AppException.from(APP_ERRORS.purchases.quoteNotFound, undefined);
    }
    return quote;
  }

  private async storeFile(condominiumId: string, base64: string) {
    const document = await prepareDocument(this.images, base64);
    if (!document) {
      throw AppException.from(APP_ERRORS.purchases.quoteInvalidFile, undefined);
    }
    const key = `purchase-quotes/${condominiumId}/${randomUUID()}.${document.extension}`;
    await this.storage.put(key, document.data, document.contentType);
    return { fileKey: key, fileIsPdf: document.extension === "pdf" };
  }

  private async dropFile(key: string | null | undefined) {
    if (!key) return;
    await this.storage.deleteMany([key]).catch((cause) => {
      this.logger.warn(`Quote file not removed: ${String(cause)}`);
    });
  }

  private stamp(actor: AuthenticatedUser, id: string, created = false) {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_quote",
      entityId: id,
      created,
    });
  }

  async add(
    actor: AuthenticatedUser,
    requestId: string,
    supplierId: string,
    input: PurchaseQuoteInput,
    file: string | null,
  ): Promise<PurchaseQuote> {
    const condominiumId = await this.access.condominiumOf(actor);
    const request = await this.loadRequest(condominiumId, requestId);
    if (
      request.status !== PurchaseRequestStatus.OPEN &&
      request.status !== PurchaseRequestStatus.QUOTING
    ) {
      throw locked();
    }
    const supplier = await this.suppliers.find(condominiumId, supplierId);
    if (!supplier || !supplier.active) {
      throw AppException.from(
        APP_ERRORS.purchases.quoteSupplierUnavailable,
        undefined,
      );
    }
    const existing = await this.quotes.listFor(requestId);
    if (existing.some((quote) => quote.supplierId === supplierId)) {
      throw AppException.from(
        APP_ERRORS.purchases.quoteSupplierTaken,
        undefined,
      );
    }
    const terms = validateQuoteInput(input, request.items);
    const stored = file
      ? await this.storeFile(condominiumId, file)
      : { fileKey: null, fileIsPdf: null };
    const quote = await this.quotes
      .create(requestId, supplierId, { ...terms, ...stored })
      .catch(async (error: unknown) => {
        await this.dropFile(stored.fileKey);
        throw error;
      });
    if (!quote) {
      await this.dropFile(stored.fileKey);
      throw locked();
    }
    await this.stamp(actor, quote.id, true);
    return quote;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: PurchaseQuoteInput,
    file: QuoteFileChange,
  ): Promise<PurchaseQuote> {
    const condominiumId = await this.access.condominiumOf(actor);
    const current = await this.loadQuote(condominiumId, id);
    const request = await this.loadRequest(condominiumId, current.requestId);
    if (request.status !== PurchaseRequestStatus.QUOTING) throw locked();
    const terms = validateQuoteInput(input, request.items);
    const stored =
      file.kind === "replace"
        ? await this.storeFile(condominiumId, file.base64)
        : file.kind === "remove"
          ? { fileKey: null, fileIsPdf: null }
          : { fileKey: current.fileKey, fileIsPdf: current.fileIsPdf };
    const fresh = file.kind === "replace" ? stored.fileKey : null;
    const updated = await this.quotes
      .update(id, { ...terms, ...stored })
      .catch(async (error: unknown) => {
        await this.dropFile(fresh);
        throw error;
      });
    if (!updated) {
      await this.dropFile(fresh);
      throw locked();
    }
    if (file.kind !== "keep") await this.dropFile(current.fileKey);
    await this.stamp(actor, id);
    return updated;
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const condominiumId = await this.access.condominiumOf(actor);
    await this.loadQuote(condominiumId, id);
    const fileKey = await this.quotes.remove(id);
    if (fileKey === undefined) throw locked();
    await this.dropFile(fileKey);
  }
}
