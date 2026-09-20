import crypto from "node:crypto";
import { ENV } from "../_core/env";
import { getBlingIntegration, saveBlingIntegration, upsertImportedOrder, upsertBlingProduct, type OrderInput } from "../db";

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
  return {
    blingOrderNumber: orderNumber,
    blingOrderId: order.id != null ? String(order.id) : undefined,
    customerName: order.contato?.nome || "Cliente não informado",
    items: [],
  };

}

export async function findBlingOrder(ownerId: number, number: string) {
  const requested = number.trim();
  if (!/^\d{1,20}$/.test(requested)) throw new Error("Informe somente os dígitos do número do pedido Bling.");
  const token = await getValidAccessToken(ownerId);
  const url = new URL(`${API_BASE}/pedidos/vendas`);
  url.searchParams.set("numero", requested);
  url.searchParams.set("pagina", "1");
  url.searchParams.set("limite", "100");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (response.status === 401) throw new Error("A conexão com o Bling expirou. Reconecte a conta em Administração.");
  if (response.status === 403) throw new Error("A conexão não tem permissão para consultar pedidos de venda no Bling.");
  if (response.status === 429) throw new Error("O Bling recebeu muitas consultas. Aguarde alguns segundos e tente novamente.");
  if (!response.ok) throw new Error("Não foi possível consultar o Bling agora. Tente novamente.");
  const result = await response.json() as BlingListResponse;
  const matches = (result.data || []).filter(order => /^\d+$/.test(String(order.numero ?? "")) && BigInt(String(order.numero)) === BigInt(requested));
  if (!matches.length) throw new Error("Pedido não encontrado no Bling. Confira o número informado.");
  if (matches.length !== 1) throw new Error("Há mais de um pedido com esse número no Bling. Confira a origem do pedido.");
  const match = matches[0];
  if (!match.id || !match.contato?.nome?.trim()) throw new Error("O pedido no Bling está sem identificação ou nome do cliente.");
  return { blingOrderId: String(match.id), blingOrderNumber: String(match.numero), customerName: match.contato.nome.trim() };
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
        const result = await upsertImportedOrder(ownerId, actorUserId, normalizeBlingOrder(raw));
        if ("skipped" in result && result.skipped) skipped += 1; else imported += 1;
      } catch (error) {
        skipped += 1;
        console.warn("[Bling] Pedido não importado", raw.id ?? raw.numero);
      }
    }
    if (orders.length < DEFAULT_LIMIT) break;
    await new Promise(resolve => setTimeout(resolve, 400));
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

type BlingProduct = { id?: number | string; nome?: string; codigo?: string; unidade?: string; situacao?: string };
export function normalizeBlingProduct(product: BlingProduct) {
  if (!product.id || !product.nome?.trim()) throw new Error("Produto Bling sem identificação ou nome.");
  return { externalId: String(product.id), name: product.nome.trim().slice(0, 240), sku: product.codigo?.slice(0, 120), unit: normalizeUnit(product.unidade || "OUTRO") };
}

export async function syncBlingProducts(ownerId: number, actorUserId: number, page = 1) {
  const token = await getValidAccessToken(ownerId);
  const limit = 20;
  const url = new URL(`${API_BASE}/produtos`);
  url.searchParams.set("pagina", String(page));
  url.searchParams.set("limite", String(limit));
  url.searchParams.set("criterio", "2");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  const result = await parseJson<{ data?: BlingProduct[] }>(response);
  const products = result.data || [];
  let imported = 0;
  for (const summary of products) {
    if (summary.situacao === "I" || summary.nome?.trim().toLowerCase() === "teste") continue;
    // The detail endpoint supplies the unit, which may be omitted from the list.
    await new Promise(resolve => setTimeout(resolve, 400));
    const detailResponse = await fetch(`${API_BASE}/produtos/${encodeURIComponent(String(summary.id))}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    const detail = await parseJson<{ data: BlingProduct }>(detailResponse);
    if (detail.data.nome?.trim().toLowerCase() === "teste") continue;
    await upsertBlingProduct(ownerId, actorUserId, normalizeBlingProduct(detail.data));
    imported += 1;
  }
  return { imported, hasMore: products.length === limit, nextPage: products.length === limit ? page + 1 : 1 };
}
