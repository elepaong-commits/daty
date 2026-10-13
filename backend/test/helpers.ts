import { execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

/** Creates the test database if needed, migrates it and empties every table. */
export async function resetDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = url.pathname.slice(1);
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).href });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, stdio: "pipe" });
  await prisma.$executeRawUnsafe('TRUNCATE "couples", "users" RESTART IDENTITY CASCADE');
}

/** Runs the app on a random port for the test file. */
export async function startServer() {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/api`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A logged-in user: keeps its session cookie and sends JSON. */
export class Client {
  private cookie = "";

  constructor(private readonly baseUrl: string) {}

  async request(method: string, path: string, body?: unknown) {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: { "content-type": "application/json", cookie: this.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0]!;
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  /** Like `request`, but fails the test unless the call succeeds. */
  async ok(method: string, path: string, body?: unknown) {
    const res = await this.request(method, path, body);
    if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  }
}

/** Signs up a new user and starts a couple for them. */
export async function coupleMember(baseUrl: string, email: string) {
  const client = new Client(baseUrl);
  await client.ok("POST", "/auth/signup", { email, password: "password1234", nickname: email.split("@")[0] });
  await client.ok("POST", "/couple", { anniversaryDate: "2024-05-01" });
  return client;
}
