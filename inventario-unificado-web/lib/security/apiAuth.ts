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
 * O que faz: A funcao 'getBearerToken' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'getPerfilNome' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function getPerfilNome(value: PerfilNomeLookupRow["perfil"]): string {
  if (Array.isArray(value)) return String(value[0]?.nm_perfil || "");
  return String(value?.nm_perfil || "");
}

/**
 * [DOC-FUNC] resolveIsAdmin
 * O que faz: A funcao 'resolveIsAdmin' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: cdUsuario, cdPerfilPrincipal. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'authenticateApiRequest' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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


