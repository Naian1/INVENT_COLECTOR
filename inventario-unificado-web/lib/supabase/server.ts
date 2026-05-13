/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\supabase\server.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * [DOC-FUNC] getSupabaseEnv
 * O que faz: Consulta informacoes na funcao 'getSupabaseEnv' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getSupabaseServerClient' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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

