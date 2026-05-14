/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\auditoria\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * [DOC-FUNC] getBearerToken
 * O que faz: A funcao 'getBearerToken' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ sucesso: false, erro: "Token ausente." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return NextResponse.json({ sucesso: false, erro: "Token invalido." }, { status: 401 });
  }

  const usuarioAuth = await supabase
    .from("usuario")
    .select("cd_usuario")
    .eq("auth_user_id", authData.user.id)
    .eq("ie_situacao", "A")
    .limit(1)
    .maybeSingle();

  if (usuarioAuth.error) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao validar usuario: ${usuarioAuth.error.message}` },
      { status: 500 }
    );
  }

  if (!usuarioAuth.data?.cd_usuario) {
    return NextResponse.json({ sucesso: false, erro: "Usuario inativo ou inexistente." }, { status: 401 });
  }

  const nrInventario = Number(request.nextUrl.searchParams.get("nr_inventario"));
  if (!Number.isFinite(nrInventario) || nrInventario <= 0) {
    return NextResponse.json({ sucesso: false, erro: "nr_inventario invalido." }, { status: 400 });
  }

  const ultimaMovResponse = await supabase
    .from("movimentacao")
    .select("dt_movimentacao, ds_observacao, nm_usuario")
    .eq("nr_inventario", nrInventario)
    .order("dt_movimentacao", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimaMovResponse.error && ultimaMovResponse.error.code !== "PGRST116") {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar ultima movimentacao: ${ultimaMovResponse.error.message}` },
      { status: 500 },
    );
  }

  let criacao: {
    cd_usuario_criacao: number | null;
    dt_entrada: string | null;
    nm_usuario_criacao: string | null;
  } | null = null;

  // Some environments still do not have cd_usuario_criacao in inventario.
  // Fallback to dt_entrada-only response in this case.
  let criacaoResponse = await supabase
    .from("inventario")
    .select("cd_usuario_criacao, dt_entrada")
    .eq("nr_inventario", nrInventario)
    .limit(1)
    .maybeSingle();

  if (criacaoResponse.error && /column\s+inventario\.cd_usuario_criacao\s+does not exist/i.test(criacaoResponse.error.message || "")) {
    criacaoResponse = await supabase
      .from("inventario")
      .select("dt_entrada")
      .eq("nr_inventario", nrInventario)
      .limit(1)
      .maybeSingle() as any;
  }

  if (criacaoResponse.error && criacaoResponse.error.code !== "PGRST116") {
    return NextResponse.json(
      { sucesso: false, erro: `Falha ao consultar criacao do item: ${criacaoResponse.error.message}` },
      { status: 500 },
    );
  }

  if (criacaoResponse.data) {
    const cdUsuarioCriacao = Number(criacaoResponse.data.cd_usuario_criacao);
    let nmUsuarioCriacao: string | null = null;

    if (Number.isFinite(cdUsuarioCriacao) && cdUsuarioCriacao > 0) {
      const usuarioCriacaoResponse = await supabase
        .from("usuario")
        .select("nm_usuario")
        .eq("cd_usuario", cdUsuarioCriacao)
        .limit(1)
        .maybeSingle();

      if (!usuarioCriacaoResponse.error && usuarioCriacaoResponse.data?.nm_usuario) {
        nmUsuarioCriacao = String(usuarioCriacaoResponse.data.nm_usuario);
      }
    }

    criacao = {
      cd_usuario_criacao: Number.isFinite(cdUsuarioCriacao) ? cdUsuarioCriacao : null,
      dt_entrada: criacaoResponse.data.dt_entrada || null,
      nm_usuario_criacao: nmUsuarioCriacao,
    };
  }

  return NextResponse.json({
    sucesso: true,
    dados: {
      ultima_movimentacao: ultimaMovResponse.data
        ? {
            dt_movimentacao: ultimaMovResponse.data.dt_movimentacao || null,
            ds_observacao: ultimaMovResponse.data.ds_observacao || null,
            nm_usuario: ultimaMovResponse.data.nm_usuario || null,
          }
        : null,
      criacao,
    },
  });
}

