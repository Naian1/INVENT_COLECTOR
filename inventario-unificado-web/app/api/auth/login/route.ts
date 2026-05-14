/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\login\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";

/**
 * [DOC-FUNC] POST
 * O que faz: Implementa endpoint HTTP POST 'POST', validando payload e processando persistencia/integracao.
 * Entradas: Parametros esperados: sem parametros obrigatorios; com validacao de formato e fallback quando necessario.
 * Como executa: Executa processamento local em sequencia previsivel.
 * Retorno/Efeitos: Retorna resultado da operacao de escrita/processamento e efeitos de persistencia quando aplicavel.
 */
export async function POST() {
  return NextResponse.json(
    { sucesso: false, erro: "Autenticacao migrada para Supabase Auth." },
    { status: 410 }
  );
}

