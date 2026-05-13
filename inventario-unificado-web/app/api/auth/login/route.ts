/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\login\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";

/**
 * [DOC-FUNC] POST
 * O que faz: Sincroniza/enfila dados de 'post' entre camadas internas e servicos externos.
 * Entradas: Sem parametros obrigatorios.
 * Como executa: Executa transmissao com controle de timeout, retentativa e observabilidade.
 * Retorno/Efeitos: Retorna status operacional com metadados de sucesso ou motivo de falha.
 */
export async function POST() {
  return NextResponse.json(
    { sucesso: false, erro: "Autenticacao migrada para Supabase Auth." },
    { status: 410 }
  );
}

