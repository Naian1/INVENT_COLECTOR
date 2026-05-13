/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\security\apiAuth.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type AuthenticatedActor = {
  authUserId: string;
  cdUsuario: number;
  cdPerfil: number;
  isAdmin: boolean;
};

type AuthOptions = {
  requireAdmin?: boolean;
};

/**
 * [DOC-FUNC] getBearerToken
 * O que faz: Consulta dados de 'get bearer token' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: request.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

type PerfilNomeLookupRow = {
  perfil: { nm_perfil: string } | { nm_perfil: string }[] | null;
};

/**
 * [DOC-FUNC] getPerfilNome
 * O que faz: Consulta dados de 'get perfil nome' na fonte principal (API, banco ou cache).
 * Entradas: Parametros esperados: value.
 * Como executa: Valida filtros de entrada, executa consulta e trata erros de acesso/integra??o.
 * Retorno/Efeitos: Entrega dados normalizados para consumo da camada chamadora.
 */
function getPerfilNome(value: PerfilNomeLookupRow["perfil"]): string {
  if (Array.isArray(value)) return String(value[0]?.nm_perfil || "");
  return String(value?.nm_perfil || "");
}

/**
 * [DOC-FUNC] resolveIsAdmin
 * O que faz: Monta estrutura de 'resolve is admin' a partir de dados intermediarios do modulo.
 * Entradas: Parametros esperados: cdUsuario, cdPerfilPrincipal.
 * Como executa: Combina campos, aplica prioridade de regras e prepara payload final.
 * Retorno/Efeitos: Retorna estrutura consolidada para a proxima etapa do processo.
 */
async function resolveIsAdmin(cdUsuario: number, cdPerfilPrincipal: number): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const perfisResponse = await supabase
    .from("usuario_perfil")
    .select("perfil:perfil (nm_perfil)")
    .eq("cd_usuario", cdUsuario)
    .eq("ie_situacao", "A")
    .returns<PerfilNomeLookupRow[]>();

  if (perfisResponse.error) {
    throw new Error(`Falha ao validar perfis: ${perfisResponse.error.message}`);
  }

  const ehAdminRelacionamento = (perfisResponse.data || []).some(
    (row) => getPerfilNome(row.perfil).trim().toUpperCase() === "ADMIN",
  );
  if (ehAdminRelacionamento) return true;

  if (!Number.isFinite(cdPerfilPrincipal) || cdPerfilPrincipal <= 0) return false;
  const principalResponse = await supabase
    .from("perfil")
    .select("nm_perfil")
    .eq("cd_perfil", cdPerfilPrincipal)
    .limit(1)
    .maybeSingle();
  if (principalResponse.error) {
    throw new Error(`Falha ao validar perfil principal: ${principalResponse.error.message}`);
  }
  return String(principalResponse.data?.nm_perfil || "").trim().toUpperCase() === "ADMIN";
}

/**
 * [DOC-FUNC] authenticateApiRequest
 * O que faz: Executa a rotina principal de 'authenticate api request' no contexto deste modulo.
 * Entradas: Parametros esperados: request, options.
 * Como executa: Valida precondicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
export async function authenticateApiRequest(
  request: NextRequest,
  options: AuthOptions = {},
): Promise<{ actor: AuthenticatedActor; response: null } | { actor: null; response: NextResponse }> {
  const token = getBearerToken(request);
  if (!token) {
    return {
      actor: null,
      response: NextResponse.json({ sucesso: false, erro: "Token ausente." }, { status: 401 }),
    };
  }

  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return {
      actor: null,
      response: NextResponse.json({ sucesso: false, erro: "Token invalido." }, { status: 401 }),
    };
  }

  const usuarioResponse = await supabase
    .from("usuario")
    .select("cd_usuario, cd_perfil, ie_situacao")
    .eq("auth_user_id", authData.user.id)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (usuarioResponse.error) {
    return {
      actor: null,
      response: NextResponse.json(
        { sucesso: false, erro: `Falha ao validar sessao: ${usuarioResponse.error.message}` },
        { status: 500 },
      ),
    };
  }

  if (!usuarioResponse.data) {
    return {
      actor: null,
      response: NextResponse.json({ sucesso: false, erro: "Usuario inativo ou inexistente." }, { status: 401 }),
    };
  }

  const cdUsuario = Number(usuarioResponse.data.cd_usuario);
  const cdPerfil = Number(usuarioResponse.data.cd_perfil);

  let isAdmin = false;
  try {
    isAdmin = await resolveIsAdmin(cdUsuario, cdPerfil);
  } catch (error) {
    return {
      actor: null,
      response: NextResponse.json(
        {
          sucesso: false,
          erro: error instanceof Error ? error.message : "Falha ao validar perfis.",
        },
        { status: 500 },
      ),
    };
  }

  if (options.requireAdmin && !isAdmin) {
    return {
      actor: null,
      response: NextResponse.json({ sucesso: false, erro: "Acesso restrito a administradores." }, { status: 403 }),
    };
  }

  return {
    actor: {
      authUserId: authData.user.id,
      cdUsuario,
      cdPerfil,
      isAdmin,
    },
    response: null,
  };
}


