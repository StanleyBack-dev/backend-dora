/** Which build of the API is running. */
export type BuildInfo = {
  /** Release version (package.json), e.g. "0.2.0"; "dev" when unknown. */
  version: string;
  /** Full git commit SHA of the deploy; null outside a deploy. */
  commit: string | null;
  /** When this build was deployed; null outside a deploy. */
  deployedAt: Date | null;
};

export interface BuildInfoPort {
  current(): BuildInfo;
}

export const BUILD_INFO = Symbol("BUILD_INFO");
