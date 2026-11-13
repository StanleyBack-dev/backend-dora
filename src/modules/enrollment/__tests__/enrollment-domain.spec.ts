import {
  capitalizeFullName,
  isInviteOpen,
  isValidEmail,
  normalizeFullName,
  normalizePhone,
  usernameBase,
  type EnrollmentInvite,
} from "@/modules/enrollment/domain/enrollment";
import { isValidUsername } from "@/modules/identity/domain/username";

describe("enrollment domain", () => {
  it.each([
    ["(62) 99999-1234", "62999991234"],
    ["+55 62 3333-4444", "6233334444"],
    ["99999-1234", null],
    ["abc", null],
  ])("normalizePhone(%p) → %p", (value, expected) => {
    expect(normalizePhone(value)).toBe(expected);
  });

  it.each([
    ["Ana Maria de Souza", "ana.souza"],
    ["João da Silva", "joao.silva"],
    ["Ângela D'Ávila", "angela.avila"],
    ["Mariana", "mariana"],
  ])("usernameBase(%p) → %p (a valid login)", (name, expected) => {
    expect(usernameBase(name)).toBe(expected);
    expect(isValidUsername(expected)).toBe(true);
  });

  it("a name too short for a login gives an invalid base (random fallback)", () => {
    expect(isValidUsername(usernameBase("Zé"))).toBe(false);
  });

  it.each([
    ["  João   da Silva ", "João da Silva"],
    ["João", null],
    ["Jo S", null],
  ])("normalizeFullName(%p) → %p", (value, expected) => {
    expect(normalizeFullName(value)).toBe(expected);
  });

  it.each([
    ["STANLEY BARROS RODRIGUES", "Stanley Barros Rodrigues"],
    ["joão DE paula", "João de Paula"],
    ["  MARIA   DAS  DORES e SILVA ", "Maria das Dores e Silva"],
    ["ÂNGELA DOS SANTOS", "Ângela dos Santos"],
    ["ana-maria d'ávila", "Ana-Maria D'Ávila"],
    ["Da Costa Lima", "Da Costa Lima"],
  ])("capitalizeFullName(%p) → %p", (value, expected) => {
    expect(capitalizeFullName(value)).toBe(expected);
  });

  it("validates e-mails", () => {
    expect(isValidEmail("ana.souza@example.com")).toBe(true);
    expect(isValidEmail("sem-arroba.com")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });

  it("an invite is open until it expires or is revoked", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const invite: EnrollmentInvite = {
      id: "i",
      code: "123456",
      label: "Bloco A",
      expiresAt: new Date("2026-10-26T12:00:00Z"),
      revokedAt: null,
      createdBy: "u",
      createdAt: now,
      requestCount: 0,
    };
    expect(isInviteOpen(invite, now)).toBe(true);
    expect(isInviteOpen({ ...invite, revokedAt: now }, now)).toBe(false);
    expect(isInviteOpen({ ...invite, expiresAt: now }, now)).toBe(false);
  });
});
