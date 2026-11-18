import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import express from "express";
import { accountLimiter } from "../src/lib/limits.js";

// Wrong passwords are counted per account as well as per IP, so faking the IP doesn't buy more guesses.
// Tests allow 1000 failures per key (see failureLimiter), so this runs one past that.

const LIMIT = 1000;
let server: ReturnType<express.Express["listen"]>;
let url: string;

before(async () => {
  const app = express();
  app.use(express.json());
  app.post("/login", accountLimiter(10), (req, res) => {
    res.status(req.body.password === "right" ? 200 : 401).end();
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/login`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const login = (body: object) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status);

test("failures are counted per email, whatever its case or spacing", async () => {
  for (let i = 0; i < LIMIT; i++) await login({ email: i % 2 ? "a@test.local" : " A@Test.local ", password: "wrong" });
  assert.equal(await login({ email: "a@test.local", password: "right" }), 429, "the account is locked for now");
  assert.equal(await login({ email: "b@test.local", password: "right" }), 200, "another account is not");
});

test("requests without an email (a mailed reset token) aren't counted together", async () => {
  for (let i = 0; i < LIMIT + 1; i++) await login({ token: "x", password: "wrong" });
  assert.equal(await login({ token: "x", password: "right" }), 200);
});
