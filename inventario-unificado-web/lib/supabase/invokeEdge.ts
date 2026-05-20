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
  fallbackMessage: string
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new EdgeUnauthorizedError();
  }

  const { data, error } = await supabase.functions.invoke<EdgeEnvelope<T>>(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!error && data?.ok) {
    return data.data as T;
  }

  const status = getEdgeStatus(error);
  const reason = data?.error || error?.message || fallbackMessage;

  if (status === 401 || /401|jwt|unauthori[sz]ed|nao autorizado/i.test(reason)) {
    throw new EdgeUnauthorizedError(reason);
  }

  throw new Error(reason);
}
