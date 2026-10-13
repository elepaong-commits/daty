import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await resetDatabase();
  server = await startServer();
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

/** A couple of two: `a` started it and `b` joined with the invite code. */
async function couple(name: string) {
  const a = await coupleMember(server.baseUrl, `${name}-a@test.local`);
  const { coupleCode } = await a.ok("GET", "/couple");
  const b = new Client(server.baseUrl);
  await b.ok("POST", "/auth/signup", { email: `${name}-b@test.local`, password: "password1234", nickname: `${name}-b` });
  await b.ok("POST", "/couple/join", { code: coupleCode });
  return { a, b, bEmail: `${name}-b@test.local` };
}

async function login(email: string, password: string) {
  const client = new Client(server.baseUrl);
  return { client, res: await client.request("POST", "/auth/login", { email, password }) };
}

describe("change password while logged in", () => {
  test("needs the current password", async () => {
    const { b } = await couple("wrong");
    const res = await b.request("POST", "/auth/password", { currentPassword: "nope", newPassword: "newpassword1" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "WRONG_PASSWORD");
  });

  test("keeps this device logged in and logs out the others", async () => {
    const { b, bEmail } = await couple("change");
    const { client: otherDevice } = await login(bEmail, "password1234");
    // Sessions carry whole-second issue times; make sure the change lands in a later second.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const res = await b.request("POST", "/auth/password", { currentPassword: "password1234", newPassword: "newpassword1" });
    assert.equal(res.status, 204);
    assert.equal((await b.request("GET", "/places")).status, 200);
    assert.equal((await otherDevice.request("GET", "/auth/me")).status, 401);
    assert.equal((await login(bEmail, "password1234")).res.status, 401);
    assert.equal((await login(bEmail, "newpassword1")).res.status, 200);
  });
});

describe("reset with a code from the partner", () => {
  test("can't be issued without a partner", async () => {
    const single = await coupleMember(server.baseUrl, "alone@test.local");
    const res = await single.request("POST", "/couple/reset-code");
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "NO_PARTNER");
  });

  test("logs in with the new password and logs out old sessions", async () => {
    const { a, b, bEmail } = await couple("reset");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const issued = await a.ok("POST", "/couple/reset-code");
    assert.equal(issued.user.nickname, "reset-b");
    assert.match(issued.code, /^[A-Z2-9]{8}$/);

    const forgetful = new Client(server.baseUrl);
    const me = await forgetful.ok("POST", "/auth/reset-password", {
      email: bEmail,
      code: issued.code.toLowerCase(), // typed by hand
      newPassword: "resetpassword1",
    });
    assert.equal(me.user.email, bEmail);
    assert.equal((await forgetful.request("GET", "/places")).status, 200);
    assert.equal((await b.request("GET", "/auth/me")).status, 401);
    assert.equal((await login(bEmail, "resetpassword1")).res.status, 200);

    const again = await new Client(server.baseUrl).request("POST", "/auth/reset-password", {
      email: bEmail,
      code: issued.code,
      newPassword: "another-password",
    });
    assert.equal(again.status, 400, "a code works once");
  });

  test("only the newest code works, and only for the partner's email", async () => {
    const { a, bEmail } = await couple("newest");
    const first = await a.ok("POST", "/couple/reset-code");
    const second = await a.ok("POST", "/couple/reset-code");
    const client = new Client(server.baseUrl);
    const redeem = (email: string, code: string) => client.request("POST", "/auth/reset-password", { email, code, newPassword: "whatever123" });
    assert.equal((await redeem(bEmail, first.code)).status, 400);
    assert.equal((await redeem("newest-a@test.local", second.code)).status, 400);
    assert.equal((await redeem("nobody@test.local", second.code)).status, 400);
    assert.equal((await redeem(bEmail, second.code)).status, 200);
  });

  test("stops working after it expires or after 5 wrong tries", async () => {
    const { a, bEmail } = await couple("limits");
    const client = new Client(server.baseUrl);
    const redeem = (code: string) => client.request("POST", "/auth/reset-password", { email: bEmail, code, newPassword: "whatever123" });

    const expiring = await a.ok("POST", "/couple/reset-code");
    await prisma.passwordResetCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await redeem(expiring.code);
    assert.equal(expired.status, 400);
    assert.equal(expired.body.code, "INVALID_RESET_CODE");

    const guessed = await a.ok("POST", "/couple/reset-code");
    for (let i = 0; i < 5; i++) assert.equal((await redeem("AAAAAAAA")).status, 400);
    assert.equal((await redeem(guessed.code)).status, 400);
  });
});
