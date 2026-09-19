import crypto from "node:crypto";
import { ENV } from "../_core/env";
import { getBlingIntegration, saveBlingIntegration, upsertImportedOrder, type OrderInput } from "../db";

const API_BASE = ENV.blingApiBaseUrl.replace(/\/$/, "");
const OAUTH_BASE = ENV.blingOAuthBaseUrl.replace(/\/$/, "");
const DEFAULT_LIMIT = 100;

type BlingTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type BlingSalesOrder = {
  id?: number | string;
  numero?: number | string;
  data?: string;
  dataAlteracao?: string;
  observacoes?: string;
  contato?: { nome?: string; telefone?: string; celular?: string };
  itens?: Array<{
    id?: number | string;
    codigo?: string;
    descricao?: string;
    quantidade?: number;
    unidade?: string;
    produto?: { id?: number | string; codigo?: string; nome?: string };
  }>;
};

type BlingListResponse = { data?: BlingSalesOrder[] };

function requireConfig() {
  if (!ENV.blingClientId || !ENV.blingClientSecret || !ENV.blingRedirectUri) {
    throw new Error("Configure BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REDIRECT_URI antes de conectar.");
  }
}

function basicAuth() {
  return `Basic ${Buffer.from(`${ENV.blingClientId}:${ENV.blingClientSecret}`).toString("base64")}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.text();
  let parsed: unknown = null;
  try {
    parsed = payload ? JSON.parse(payload) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const message = typeof parsed === "object" && parsed && "error" in parsed ? String((parsed as { error: unknown }).error) : payload;
    throw new Error(`Bling respondeu ${response.status}: ${message || "erro desconhecido"}`);
  }
  return parsed as T;
}

export function createBlingOAuthState() {
  return crypto.randomBytes(32).toString("hex");
}

export function getBlingAuthorizationUrl(state: string) {
  requireConfig();
  const url = new URL(`${OAUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", ENV.blingClientId);
  url.searchParams.set("redirect_uri", ENV.blingRedirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeBlingCode(code: string) {
  requireConfig();
  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: ENV.blingRedirectUri }),
  });
  return parseJson<BlingTokenResponse>(response);
}

async function refreshBlingToken(refreshToken: string) {
  requireConfig();
  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  return parseJson<BlingTokenResponse>(response);
}

async function getValidAccessToken(ownerId: number) {
  const integration = await getBlingIntegration(ownerId);
  if (!integration?.accessToken) throw new Error("A conta Bling ainda não está conectada.");
  const isExpired = integration.accessTokenExpiresAt && integration.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (!isExpired || !integration.refreshToken) return integration.accessToken;
  const refreshed = await refreshBlingToken(integration.refreshToken);
  await saveBlingIntegration(ownerId, {
    status: "CONECTADO",
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? integration.refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + Math.max(60, refreshed.expires_in ?? 21600) * 1000),
  });
  return refreshed.access_token;
}

async function listSalesOrdersPage(accessToken: string, page: number, limit: number, since?: Date) {
  const url = new URL(`${API_BASE}/pedidos/vendas`);
  url.searchParams.set("pagina", String(page));
  url.searchParams.set("limite", String(limit));
  if (since) url.searchParams.set("dataAlteracaoInicial", since.toISOString().slice(0, 10));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  return parseJson<BlingListResponse>(response);
}

function normalizeUnit(unit?: string): OrderInput["items"][number]["unit"] {
  const normalized = (unit || "UN").toUpperCase();
  if (["UN", "METRO", "JOGO", "PAR", "KIT", "CONJUNTO"].includes(normalized)) return normalized as OrderInput["items"][number]["unit"];
  return "OUTRO";
}

export function normalizeBlingOrder(order: BlingSalesOrder): OrderInput {
  const orderNumber = String(order.numero ?? order.id ?? "").trim();
  if (!orderNumber) throw new Error("Pedido Bling sem número identificável.");
  const items = (order.itens || []).map(item => ({
    productId: undefined,
    sku: item.codigo || item.produto?.codigo || undefined,
    description: item.descricao || item.produto?.nome || "Item sem descrição",
    categoryName: "Outros",
    quantity: Math.max(1, Math.round(Number(item.quantidade || 1))),
    unit: normalizeUnit(item.unidade),
    note: undefined,
  }));
  if (!items.length) throw new Error(`O pedido ${orderNumber} não possui itens.`);
  return {
    blingOrderNumber: orderNumber,
    blingOrderId: order.id != null ? String(order.id) : undefined,
    orderDate: order.data ? new Date(order.data) : order.dataAlteracao ? new Date(order.dataAlteracao) : undefined,
    customerName: order.contato?.nome || "Cliente não informado",
    customerPhone: order.contato?.telefone || order.contato?.celular || undefined,
    customerNote: order.observacoes || undefined,
    items,
  } as OrderInput;
}

export async function syncBlingOrders(ownerId: number, actorUserId: number, options?: { sinceDays?: number; maxPages?: number }) {
  const accessToken = await getValidAccessToken(ownerId);
  const sinceDays = Math.min(365, Math.max(1, options?.sinceDays ?? 30));
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const maxPages = Math.min(20, Math.max(1, options?.maxPages ?? 5));
  let imported = 0;
  let skipped = 0;
  let page = 1;
  for (; page <= maxPages; page += 1) {
    const response = await listSalesOrdersPage(accessToken, page, DEFAULT_LIMIT, since);
    const orders = response.data || [];
    for (const raw of orders) {
      try {
        await upsertImportedOrder(ownerId, actorUserId, normalizeBlingOrder(raw));
        imported += 1;
      } catch (error) {
        skipped += 1;
        console.warn("[Bling] Pedido ignorado", raw.id ?? raw.numero, error);
      }
    }
    if (orders.length < DEFAULT_LIMIT) break;
  }
  await saveBlingIntegration(ownerId, { status: "CONECTADO", lastSyncedAt: new Date() });
  return { imported, skipped, pages: page, sinceDays };
}

export function verifyBlingWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  if (!ENV.blingWebhookSecret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", ENV.blingWebhookSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export type { BlingSalesOrder };
