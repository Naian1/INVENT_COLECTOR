/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\login\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";

/**
 * [DOC-FUNC] POST
 * O que faz: Implementa o endpoint HTTP POST 'POST' para receber payload, validar regras e processar/gravar dados.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function POST() {
  return NextResponse.json(
    { sucesso: false, erro: "Autenticacao migrada para Supabase Auth." },
    { status: 410 }
  );
}

