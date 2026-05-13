/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\middleware.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";

type RateWindow = {
  count: number;
  resetAt: number;
};

const store =
  (globalThis as typeof globalThis & { __rateLimitStore?: Map<string, RateWindow> }).__rateLimitStore ||
  new Map<string, RateWindow>();

(globalThis as typeof globalThis & { __rateLimitStore?: Map<string, RateWindow> }).__rateLimitStore = store;

/**
 * [DOC-FUNC] getClientIp
 * O que faz: Consulta dados de 'get client ip' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: request.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim();
  if (ip) return ip;
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * [DOC-FUNC] applyRateLimit
 * O que faz: Executa a rotina principal de 'apply rate limit' no contexto deste modulo.
 * Entradas: Parametros esperados: key, limit, windowMs.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function applyRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const nextWindow: RateWindow = { count: 1, resetAt: now + windowMs };
    store.set(key, nextWindow);
    return { allowed: true, remaining: limit - 1, resetAt: nextWindow.resetAt };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

/**
 * [DOC-FUNC] withSecurityHeaders
 * O que faz: Executa a rotina principal de 'with security headers' no contexto deste modulo.
 * Entradas: Parametros esperados: response.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https:",
      "script-src 'self' 'unsafe-inline'",
      "script-src-elem 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.vercel.app",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  return response;
}

/**
 * [DOC-FUNC] middleware
 * O que faz: Executa a rotina principal de 'middleware' no contexto deste modulo.
 * Entradas: Parametros esperados: request.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIp(request);

  if (pathname === "/login") {
    const limit = applyRateLimit(`login:${ip}`, 30, 60_000);
    if (!limit.allowed) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
      const response = NextResponse.json(
        { sucesso: false, erro: "Muitas tentativas. Aguarde e tente novamente." },
        { status: 429 },
      );
      response.headers.set("Retry-After", String(Math.max(1, retryAfter)));
      return withSecurityHeaders(response);
    }
  }

  if (pathname.startsWith("/api/auth/")) {
    const limit = applyRateLimit(`api-auth:${ip}`, 120, 60_000);
    if (!limit.allowed) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
      const response = NextResponse.json(
        { sucesso: false, erro: "Limite de requisicoes excedido." },
        { status: 429 },
      );
      response.headers.set("Retry-After", String(Math.max(1, retryAfter)));
      return withSecurityHeaders(response);
    }
  }

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    const collectorRoute = pathname.startsWith("/api/coletor/");
    const limit = collectorRoute
      ? applyRateLimit(`api-coletor:${ip}`, 600, 60_000)
      : applyRateLimit(`api-geral:${ip}`, 180, 60_000);

    if (!limit.allowed) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
      const response = NextResponse.json(
        { sucesso: false, erro: "Limite de requisicoes excedido para API." },
        { status: 429 },
      );
      response.headers.set("Retry-After", String(Math.max(1, retryAfter)));
      return withSecurityHeaders(response);
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

