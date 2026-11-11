import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

// Reactions and comments on photos and place memos.

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;
let b: Client;
let photoPath = "";
let notePath = "";
let albumId = 0;
let placeId = 0;

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "a@test.local");
  const { coupleCode } = await a.ok("GET", "/couple");
  b = new Client(server.baseUrl);
  await b.ok("POST", "/auth/signup", { email: "b@test.local", password: "password1234", nickname: "b" });
  await b.ok("POST", "/couple/join", { code: coupleCode });

  const place = await a.ok("POST", "/places", { name: "Cafe", category: "CAFE", note: "Try the latte" });
  const detail = await a.ok("GET", `/places/${place.id}`);
  const album = await a.ok("POST", "/albums", { title: "Day", albumDate: "2026-10-01" });
  const photo = await prisma.photo.create({ data: { albumId: album.id, imageUrl: "https://example.com/a.jpg" } });
  albumId = album.id;
  placeId = place.id;
  photoPath = `/albums/${album.id}/photos/${photo.id}`;
  notePath = `/places/${place.id}/notes/${detail.notes[0].id}`;
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

for (const [name, path] of [
  ["photo", () => photoPath],
  ["memo", () => notePath],
] as const) {
  test(`${name}: each person keeps one reaction, which can change or go`, async () => {
    await a.ok("PUT", `${path()}/reaction`, { emoji: "❤️" });
    await b.ok("PUT", `${path()}/reaction`, { emoji: "😂" });
    const changed = await a.ok("PUT", `${path()}/reaction`, { emoji: "🔥" });
    assert.deepEqual(changed.reactions.map((r: { emoji: string }) => r.emoji).sort(), ["😂", "🔥"].sort());
    const cleared = await a.ok("DELETE", `${path()}/reaction`);
    assert.deepEqual(cleared.reactions.map((r: { emoji: string }) => r.emoji), ["😂"]);
    assert.equal((await a.request("PUT", `${path()}/reaction`, { emoji: "💩" })).status, 400, "only the offered emoji");
  });

  test(`${name}: comments keep their order and only the writer can delete one`, async () => {
    await a.ok("POST", `${path()}/comments`, { content: "first" });
    const { comments } = await b.ok("POST", `${path()}/comments`, { content: "second" });
    assert.deepEqual(comments.map((c: { content: string }) => c.content), ["first", "second"]);
    assert.equal(comments[1].writer.nickname, "b");
    assert.equal((await b.request("DELETE", `${path()}/comments/${comments[0].id}`)).status, 404);
    const left = await a.ok("DELETE", `${path()}/comments/${comments[0].id}`);
    assert.deepEqual(left.comments.map((c: { content: string }) => c.content), ["second"]);
    assert.equal((await a.request("POST", `${path()}/comments`, { content: "  " })).status, 400);
  });
}

test("the album and the place carry the feedback, and deleting them takes it along", async () => {
  const album = await b.ok("GET", `/albums/${albumId}`);
  assert.equal(album.photos[0].comments.length, 1);
  assert.equal(album.photos[0].reactions.length, 1);
  const place = await b.ok("GET", `/places/${placeId}`);
  assert.equal(place.notes[0].comments.length, 1);
  assert.equal(place.notes[0].reactions.length, 1);

  await a.ok("DELETE", `/albums/${albumId}`);
  await a.ok("DELETE", `/places/${placeId}`);
  assert.equal(await prisma.comment.count(), 0);
  assert.equal(await prisma.reaction.count(), 0);
});
