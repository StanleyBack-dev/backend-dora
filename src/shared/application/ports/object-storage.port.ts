// Object storage (Neon Object Storage, S3-compatible). Profile photos and
// future uploads live here; the adapter is provided globally by SharedModule.

export type UploadForm = {
  /** The browser POSTs a multipart form with `fields` + the file here. */
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
};

export interface ObjectStoragePort {
  /** Presigned POST: the storage itself enforces key, type and size. */
  createUploadForm(params: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds: number;
  }): Promise<UploadForm>;
  /** Stores a file the server already checked (e.g. a profile photo). */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  head(
    key: string,
  ): Promise<{ sizeBytes: number; contentType: string | null } | null>;
  /** Short-lived signed GET; `downloadName` makes the browser save the file. */
  signedReadUrl(
    key: string,
    options?: { downloadName?: string },
  ): Promise<string>;
  deleteMany(keys: string[]): Promise<void>;
}

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");
