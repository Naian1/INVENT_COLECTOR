/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web/lib/supabase/invokeEdge.ts
 * [DOC-CODEMAP] Papel: centraliza chamadas autenticadas para Edge Functions do Supabase.
 *
 * Este helper existe para evitar um problema perigoso em producao: telas React podem
 * montar antes de a sessao Supabase estar disponivel. Se a tela chama uma Edge com
 * verify_jwt=true nesse instante, a Edge responde 401. Em alguns cenarios de recarga,
 * foco de aba ou erro de rede, isso pode virar varias tentativas seguidas. Por isso,
 * primeiro confirmamos que existe access_token local e so entao enviamos a requisicao.
 */
import { supabase } from "@/lib/supabase/client";

type EdgeEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

type InvokeEdgeOptions = {
  timeoutMs?: number;
};

export class EdgeUnauthorizedError extends Error {
  status = 401;

  constructor(message = "Sessao expirada ou ausente. Faca login novamente.") {
    super(message);
    this.name = "EdgeUnauthorizedError";
  }
}

function getEdgeStatus(error: unknown): number | null {
  const maybeError = error as { context?: { status?: number }; status?: number } | null;
  return maybeError?.context?.status ?? maybeError?.status ?? null;
}

/**
 * [DOC-FUNC] extrairMensagemErroEdge
 * Objetivo: recuperar a mensagem real devolvida pela Edge quando o SDK Supabase embrulha non-2xx.
 * Como executa: prioriza `data.error`; se nao existir, tenta ler o corpo HTTP de `error.context`.
 * Saida/Efeito: devolve uma mensagem clara para a tela, sem disparar novas tentativas.
 */
async function extrairMensagemErroEdge(
  data: EdgeEnvelope<unknown> | null,
  error: unknown,
  fallbackMessage: string,
): Promise<string> {
  const directMessage = data?.error || (error as { message?: string } | null)?.message;

  const responseContext = (error as { context?: { text?: () => Promise<string> } } | null)?.context;
  if (responseContext && typeof responseContext.text === "function") {
    try {
      const rawText = await responseContext.text();
      if (rawText) {
        const parsed = JSON.parse(rawText) as { error?: unknown; message?: unknown };
        const parsedMessage = parsed?.error || parsed?.message;
        if (parsedMessage) {
          return String(parsedMessage);
        }
      }
    } catch {
      // Mantem a mensagem direta quando o corpo da resposta nao esta em JSON legivel.
    }
  }

  return directMessage || fallbackMessage;
}

/**
 * [DOC-FUNC] invokeAuthedEdgeFunction
 * Objetivo: chamar uma Edge Function protegida somente quando existe sessao valida.
 * Entradas: nome da funcao, corpo enviado para a Edge e mensagem opcional de erro.
 * Como executa: busca a sessao Supabase no navegador, interrompe sem chamar rede se
 * nao houver access_token, envia Authorization Bearer explicitamente e interpreta o
 * envelope padrao `{ ok, data, error }` usado pelas Edge Functions do sistema.
 * Saida/Efeito: retorna `data` tipado quando a Edge confirma sucesso ou lanca erro
 * claro para a tela tratar sem iniciar retry infinito.
 */
export async function invokeAuthedEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
  options: InvokeEdgeOptions = {},
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new EdgeUnauthorizedError();
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const invokePromise = supabase.functions.invoke<EdgeEnvelope<T>>(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const { data, error } = await (async () => {
    try {
      return options.timeoutMs
        ? await Promise.race([
            invokePromise,
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                reject(new Error(`Tempo esgotado ao executar ${functionName}.`));
              }, options.timeoutMs);
            }),
          ])
        : await invokePromise;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  })();

  if (!error && data?.ok) {
    return data.data as T;
  }

  const status = getEdgeStatus(error);
  const reason = await extrairMensagemErroEdge(data ?? null, error, fallbackMessage);

  if (status === 401 || /401|jwt|unauthori[sz]ed|nao autorizado/i.test(reason)) {
    throw new EdgeUnauthorizedError(reason);
  }

  throw new Error(reason);
}

/**
 * [DOC-FUNC] invokeAuthedEdgeAction
 * Objetivo: padronizar o contrato mais usado no sistema: `{ action, payload }`.
 * Como executa: monta o corpo sem alterar payload, chama `invokeAuthedEdgeFunction` e reaproveita a validacao
 * de sessao, Authorization, timeout opcional e tratamento de 401 centralizado.
 * Saida/Efeito: devolve o `data` da Edge Function ou lanca erro padronizado.
 */
export async function invokeAuthedEdgeAction<T>(
  functionName: string,
  action: string,
  payload?: Record<string, unknown>,
  fallbackMessage = `Falha ao executar ${functionName}.`,
  options: InvokeEdgeOptions = {},
) {
  return invokeAuthedEdgeFunction<T>(
    functionName,
    { action, payload: payload ?? {} },
    fallbackMessage,
    options,
  );
}
