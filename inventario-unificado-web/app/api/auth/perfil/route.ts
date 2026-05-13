/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\auth\perfil\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * [DOC-FUNC] getBearerToken
 * O que faz: Consulta e organiza informacoes na funcao 'getBearerToken', entregando retorno confiavel para camadas superiores.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna dados prontos para consumo (tipados e consistentes) ou sinaliza ausencia/erro sem ambiguidade.
 */
function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * [DOC-FUNC] POST
 * O que faz: Implementa o endpoint HTTP POST 'POST' para receber payload, validar regras e processar/gravar dados.
 * Entradas: Parametros esperados: request; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; consulta fontes de dados/servicos externos; padroniza campos para evitar divergencia de formato; captura e propaga erros com contexto de diagnostico.
 * Retorno/Efeitos: Retorna o resultado da mutacao e registra efeitos de persistencia/integracao com tratamento de falhas claro.
 */
export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: "Body JSON invalido." },
      { status: 400 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { sucesso: false, erro: "Token ausente." },
      { status: 401 }
    );
  }

  const cdPerfil = (body as { cd_perfil?: number })?.cd_perfil;
  if (!cdPerfil || typeof cdPerfil !== "number") {
    return NextResponse.json(
      { sucesso: false, erro: "Perfil invalido." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return NextResponse.json(
      { sucesso: false, erro: "Token invalido." },
      { status: 401 }
    );
  }

  const result = await supabase
    .from("usuario")
    .select("cd_usuario, nm_usuario, cd_perfil, ie_situacao")
    .eq("auth_user_id", authData.user.id)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar usuario: ${result.error.message}` },
      { status: 500 }
    );
  }

  if (!result.data) {
    return NextResponse.json(
      { sucesso: false, erro: "Usuario inativo ou inexistente." },
      { status: 401 }
    );
  }

  const perfilVinculo = await supabase
    .from("usuario_perfil")
    .select("cd_perfil")
    .eq("cd_usuario", result.data.cd_usuario)
    .eq("cd_perfil", cdPerfil)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (perfilVinculo.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar perfis: ${perfilVinculo.error.message}` },
      { status: 500 }
    );
  }

  if (!perfilVinculo.data && result.data.cd_perfil !== cdPerfil) {
    return NextResponse.json(
      { sucesso: false, erro: "Perfil nao autorizado para este usuario." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ sucesso: true });
  response.cookies.set({
    name: "inv_profile",
    value: String(cdPerfil),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return response;
}

