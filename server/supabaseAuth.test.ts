import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn(), lookup: vi.fn(), sign: vi.fn() }));
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("./db", () => ({ upsertUser: mocks.upsert, getUserByOpenId: mocks.lookup }));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: mocks.sign } }));
import { registerSupabaseAuth } from "./supabaseAuth";

async function request(origin = "https://inject.example", body: unknown = { accessToken: "a".repeat(30) }) {
  let handler: any;
  registerSupabaseAuth({ post: (_path: string, fn: any) => { handler = fn; } } as Express);
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
  await handler({ headers: { origin }, body, protocol: "https" }, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks(); process.env.PUBLIC_APP_URL = "https://inject.example";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "trusted-id", email: "employee@example.com", email_confirmed_at: "2026-01-01", user_metadata: {} } }, error: null });
  mocks.upsert.mockResolvedValue(undefined);
  mocks.lookup.mockResolvedValue({ openId: "trusted-id", email: "employee@example.com", name: "Employee", disabledAt: null });
  mocks.sign.mockResolvedValue("app-session");
});
describe("Supabase session exchange", () => {
  it("rejects requests from another origin before verifying tokens", async () => {
    const res = await request("https://attacker.example"); expect(res.status).toHaveBeenCalledWith(403); expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects missing origin", async () => { const res = await request(""); expect(res.status).toHaveBeenCalledWith(403); });
  it("rejects malformed access tokens", async () => { const res = await request(undefined, { accessToken: "short" }); expect(res.status).toHaveBeenCalledWith(400); });
  it("does not trust unconfirmed email identities", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "unknown", email: "vpramos85@gmail.com" } }, error: null });
    const res = await request(); expect(res.status).toHaveBeenCalledWith(401); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects tokens rejected by Supabase", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    const res = await request(); expect(res.status).toHaveBeenCalledWith(401); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not issue a session for revoked members", async () => {
    mocks.lookup.mockResolvedValue({ disabledAt: new Date() }); const res = await request(); expect(res.status).toHaveBeenCalledWith(403); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("uses verified identity and issues a secure HttpOnly cookie", async () => {
    const res = await request(undefined, { accessToken: "a".repeat(30), email: "forged@example.com", role: "admin" });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ openId: "trusted-id", email: "employee@example.com", loginMethod: "supabase" }));
    expect(res.cookie).toHaveBeenCalledWith(expect.any(String), "app-session", expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 604800000 }));
  });
});
