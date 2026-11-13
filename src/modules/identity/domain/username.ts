// Usernames are case-insensitive and stored lowercase, e.g. "sgt.silva".
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value) && !/[._-]{2}/.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Login accepts either the username or the e-mail. */
export function isEmailLogin(login: string): boolean {
  return login.includes("@");
}

// Connectors left out of a suggested login ("Ana de Souza" → "ana.souza").
const NAME_PARTICLES = new Set(["da", "das", "de", "di", "do", "dos", "e"]);

/**
 * Login suggested from the full name: first and last names, without accents,
 * e.g. "Ana Maria de Souza" → "ana.souza". A number is appended when taken.
 */
export function usernameBase(fullName: string): string {
  const words = fullName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !NAME_PARTICLES.has(word));
  const first = words[0] ?? "morador";
  const last = words.length > 1 ? words[words.length - 1] : "";
  return (last ? `${first}.${last}` : first).slice(0, 28);
}
