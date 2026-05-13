/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\supabase\server.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * [DOC-FUNC] getSupabaseEnv
 * O que faz: Consulta e organiza informacoes na funcao 'getSupabaseEnv', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase env vars privilegiadas ausentes. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return { url, key };
}

/**
 * [DOC-FUNC] getSupabaseServerClient
 * O que faz: Consulta e organiza informacoes na funcao 'getSupabaseServerClient', entregando retorno confiavel para camadas superiores.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
export function getSupabaseServerClient() {
  if (cachedClient) return cachedClient;

  const { url, key } = getSupabaseEnv();

  cachedClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return cachedClient;
}

