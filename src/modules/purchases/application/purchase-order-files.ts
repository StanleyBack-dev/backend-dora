import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { prepareDocument } from "@/shared/application/document-file";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

/** A file kept with an order: its key and whether it is a PDF. */
export type StoredFile = { key: string | null; isPdf: boolean | null };

const NONE: StoredFile = { key: null, isPdf: null };

/**
 * The files of the orders (the invoices of the deliveries, the proofs of
 * payment): a PDF or an image (shrunk), kept in the object storage.
 */
@Injectable()
export class PurchaseOrderFiles {
  private readonly logger = new Logger(PurchaseOrderFiles.name);

  constructor(
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  /** Stores the file sent (base64; null: none). */
  async store(
    condominiumId: string,
    base64: string | null,
  ): Promise<StoredFile> {
    if (!base64) return NONE;
    const document = await prepareDocument(this.images, base64);
    if (!document) {
      throw AppException.from(APP_ERRORS.purchases.orderInvalidFile, undefined);
    }
    const key = `purchase-orders/${condominiumId}/${randomUUID()}.${document.extension}`;
    await this.storage.put(key, document.data, document.contentType);
    return { key, isPdf: document.extension === "pdf" };
  }

  /** Removes a file no longer used (a failure is only logged). */
  async drop(key: string | null | undefined): Promise<void> {
    if (!key) return;
    await this.storage.deleteMany([key]).catch((cause) => {
      this.logger.warn(`Order file not removed: ${String(cause)}`);
    });
  }
}
