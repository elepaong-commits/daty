import { createHash, randomInt } from "node:crypto";

// No 0/O or 1/I/L so codes are easy to read out loud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const randomCode = (length: number) =>
  Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/** Codes that work like passwords are stored hashed; they are random enough that SHA-256 is plenty. */
export const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
