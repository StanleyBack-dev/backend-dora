/**
 * A "contains" pattern for ILIKE from what the person typed: the LIKE
 * wildcards they typed (%, _ and the escape) are matched literally.
 */
export const likePattern = (search: string): string =>
  `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`;
