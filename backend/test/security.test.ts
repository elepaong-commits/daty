import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import { isPushServiceUrl } from "../src/modules/push.routes.js";
import { coupleMember, resetDatabase, startServer } from "./helpers.js";

let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await resetDatabase();
  server = await startServer();
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

test("a malformed JSON body is a 400, not a server error", async () => {
  const res = await fetch(`${server.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"email": ',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "INVALID_REQUEST");
});

test("map links must be http(s), so a javascript: link can't be saved", async () => {
  const a = await coupleMember(server.baseUrl, "links@test.local");
  for (const googleMapsUrl of ["javascript:alert(1)", "data:text/html,hi"]) {
    const place = await a.request("POST", "/places", { name: "x", category: "CAFE", googleMapsUrl });
    assert.equal(place.status, 400, googleMapsUrl);
    const record = await a.request("POST", "/records", {
      type: "PLAN",
      scheduledAt: "2026-11-20T12:00:00+09:00",
      placeName: "x",
      category: "CAFE",
      googleMapsUrl,
    });
    assert.equal(record.status, 400, googleMapsUrl);
  }
  const ok = await a.request("POST", "/places", { name: "y", category: "CAFE", googleMapsUrl: "https://maps.app.goo.gl/abc" });
  assert.equal(ok.status, 201);
});

test("push subscriptions only point at the browsers' push services", () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ]) {
    assert.ok(isPushServiceUrl(url), url);
  }
  for (const url of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://127.0.0.1/x",
    "https://169.254.169.254/computeMetadata/v1/",
    "https://localhost:4000/api",
    "https://fcm.googleapis.com:8443/x",
    "https://evil.example/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example/x",
    "https://notify.windows.com.evil.example/x",
  ]) {
    assert.ok(!isPushServiceUrl(url), url);
  }
});

test("password hashes still verify when many run at once", async () => {
  const passwords = Array.from({ length: 6 }, (_, i) => `password-${i}`);
  const hashes = await Promise.all(passwords.map((p) => hashPassword(p)));
  const checks = await Promise.all(hashes.map((h, i) => verifyPassword(passwords[i]!, h)));
  assert.deepEqual(checks, passwords.map(() => true));
  assert.equal(await verifyPassword("wrong", hashes[0]!), false);
});
