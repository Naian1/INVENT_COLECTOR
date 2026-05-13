/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\logout\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextResponse } from "next/server";

/**
 * [DOC-FUNC] POST
 * Objetivo: Executa a rotina de 'p os t'.
 */
export async function POST() {
  const response = NextResponse.json({ sucesso: true });

  response.cookies.set({
    name: "inv_profile",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}

