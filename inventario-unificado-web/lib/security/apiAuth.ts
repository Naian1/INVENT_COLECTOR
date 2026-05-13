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
 * O que faz: Consulta informacoes na funcao 'getBearerToken' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (request) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
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
 * O que faz: Consulta informacoes na funcao 'getPerfilNome' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (value) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
function getPerfilNome(value: PerfilNomeLookupRow["perfil"]): string {
  if (Array.isArray(value)) return String(value[0]?.nm_perfil || "");
  return String(value?.nm_perfil || "");
}

/**
 * [DOC-FUNC] resolveIsAdmin
 * O que faz: Avalia uma condicao booleana na funcao 'resolveIsAdmin' para decidir o caminho de execucao do modulo.
 * Entradas: Analisa parametros/contexto (cdUsuario, cdPerfilPrincipal) e possiveis variaveis de ambiente/estado atual.
 * Como executa: Aplica comparacoes diretas e regras simples de validacao para classificar o estado como verdadeiro ou falso.
 * Retorno/Efeitos: Retorna um indicador de controle que habilita, bloqueia ou redireciona as proximas etapas do fluxo.
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
 * O que faz: Orquestra a etapa 'authenticateApiRequest' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (sem parametros obrigatorios) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, acesso a dados/servicos externos, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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


