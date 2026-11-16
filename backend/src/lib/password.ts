import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scryptOnce = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );

// Each hash takes ~32MB, so a burst of login attempts (from many IPs, past the per-IP limit) could run
// the 1GB server out of memory. At most this many run at once; the rest wait their turn.
const MAX_CONCURRENT = 2;
let running = 0;
const waiting: (() => void)[] = [];

async function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions) {
  // A finished hash hands its slot straight to the next in line, so `running` never goes over the cap.
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  else running++;
  try {
    return await scryptOnce(password, salt, keylen, options);
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

// N=2^15 keeps hashing around 100ms and 32MB of memory, safe for the 1GB server.
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

/** Format: `scrypt$N$r$p$saltBase64$hashBase64`, so parameters can be raised later. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return timingSafeEqual(actual, expected);
}

// Compared against when the email is unknown, so both paths take the same time.
let dummyHash: Promise<string> | undefined;
export const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));
