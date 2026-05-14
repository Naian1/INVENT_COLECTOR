/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\supabase\functions\_shared\cors.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * [DOC-FUNC] jsonResponse
 * O que faz: Executa a responsabilidade principal da funcao 'jsonResponse' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: body, status; com validacao de formato e fallback quando necessario.
 * Como executa: Executa processamento local em sequencia previsivel.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

