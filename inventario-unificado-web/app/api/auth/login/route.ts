/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\login\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";

/**
 * [DOC-FUNC] POST
 * Objetivo: Executa a rotina de 'p os t'.
 */
export async function POST() {
  return NextResponse.json(
    { sucesso: false, erro: "Autenticacao migrada para Supabase Auth." },
    { status: 410 }
  );
}

