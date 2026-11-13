import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { coupleMember, resetDatabase, startServer, type Client } from "./helpers.js";

// Profile photos go to R2 under avatars/{userId}/; only your own key is accepted. (Tests run without R2.)

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;
let userId = 0;

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "avatar@test.local");
  ({ id: userId } = (await a.ok("GET", "/auth/me")).user);
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

test("only a key for your own avatar is accepted", async () => {
  for (const key of [
    `avatars/${userId + 1}/11111111-1111-1111-1111-111111111111.jpg`,
    `couples/1/albums/1/11111111-1111-1111-1111-111111111111.jpg`,
    `avatars/${userId}/../x.jpg`,
  ]) {
    const res = await a.request("PUT", "/auth/me/avatar", { key });
    assert.equal(res.status, 400, key);
    assert.equal(res.body.code, "INVALID_UPLOAD");
  }
  assert.equal((await a.request("POST", "/auth/me/avatar/upload")).body.code, "STORAGE_DISABLED");
});

test("removing the photo clears it, and an old URL is shown as it was", async () => {
  await prisma.user.update({ where: { id: userId }, data: { profileImageUrl: "https://example.com/me.jpg" } });
  assert.equal((await a.ok("GET", "/couple")).users[0].profileImageUrl, "https://example.com/me.jpg");
  const me = await a.ok("DELETE", "/auth/me/avatar");
  assert.equal(me.user.profileImageUrl, null);
});
