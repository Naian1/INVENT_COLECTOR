/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\api\inventario\consolidado\route.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/security/apiAuth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type ConsolidadoRow = Record<string, unknown>;

/**
 * [DOC-FUNC] normalizarHeader
 * O que faz: A funcao 'normalizarHeader' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: header. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarHeader(header: string) {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * [DOC-FUNC] normalizarTexto
 * O que faz: A funcao 'normalizarTexto' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarTexto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * [DOC-FUNC] normalizarStatus
 * O que faz: A funcao 'normalizarStatus' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarStatus(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (['ATIVO', 'MANUTENCAO', 'BACKUP', 'DEVOLUCAO'].includes(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * [DOC-FUNC] mapearLinha
 * O que faz: A funcao 'mapearLinha' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: row. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function mapearLinha(row: ConsolidadoRow) {
  const normalizado = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalizado.set(normalizarHeader(key), value);
  }

  /**
   * [DOC-FUNC] pick
   * O que faz: A funcao 'pick' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
   * Entradas: Recebe os parametros: aliases. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const pick = (...aliases: string[]) => {
    for (const alias of aliases) {
      const parsed = normalizarTexto(normalizado.get(alias));
      if (parsed) return parsed;
    }
    return null;
  };

  /**
   * [DOC-FUNC] normalizarTimestamp
   * O que faz: A funcao 'normalizarTimestamp' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
   * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const normalizarTimestamp = (value: string | null) => {
    if (!value) return null;

    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }

    const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (br) {
      const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = br;
      const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss)));
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    return null;
  };

  const statusDireto = normalizarStatus(
    pick('status', 'tp status', 'tp_status', 'status item', 'situacao', 'situacao do item'),
  );

  const observacao = pick('observacao');
  let status = statusDireto;
  if (!status && observacao) {
    const obs = normalizarHeader(observacao);
    if (obs.includes('devolucao')) status = 'DEVOLUCAO';
    else if (obs.includes('manutencao')) status = 'MANUTENCAO';
    else if (obs.includes('backup')) status = 'BACKUP';
  }

  const projeto = pick('projeto');
  const obra = pick('obra');
  const local = [
    projeto ? `Projeto ${projeto}` : null,
    obra ? `Obra ${obra}` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return {
    cd_cliente: pick('codigo cliente'),
    nm_cliente: pick('nome do cliente'),
    nr_projeto: projeto,
    nr_obra: obra,
    nr_id_equipamento: pick('id equipamento'),
    // Na planilha recebida, a coluna L "Equipamento" representa o patrimonio.
    nr_patrimonio: pick('equipamento', 'patrimonio', 'nr patrimonio'),
    nm_tipo: pick('tipo'),
    ds_produto: pick('descricao do produto'),
    nr_nf_faturamento: pick('nf de faturamento'),
    dt_faturamento: normalizarTimestamp(pick('data de faturamento')),
    nr_serie: pick('serie do equipamento'),
    ds_observacao_linha: observacao,
    nm_hostname: pick('hostname', 'host name', 'nm hostname'),
    nm_local: local || pick('local', 'localizacao', 'setor', 'nm_setor'),
    tp_status: status,
    dados_json: {
      cd_cliente: pick('codigo cliente'),
      nm_cliente: pick('nome do cliente'),
      nr_id_equipamento: pick('id equipamento'),
      nr_patrimonio: pick('equipamento', 'patrimonio', 'nr patrimonio'),
      nm_tipo: pick('tipo'),
      ds_produto: pick('descricao do produto'),
      nr_serie: pick('serie do equipamento'),
    },
  };
}

/**
 * [DOC-FUNC] validarCompetencia
 * O que faz: A funcao 'validarCompetencia' verifica condicoes de validade do fluxo. Ela retorna um sinal objetivo (ou erro) para decidir se a execucao pode continuar com seguranca.
 * Entradas: Recebe os parametros: competencia. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna verdadeiro/falso para orientar o proximo passo do fluxo sem ambiguidade, facilitando leitura e depuracao.
 */
function validarCompetencia(competencia: string): boolean {
  return /^(0[1-9]|1[0-2])\/[0-9]{4}$/.test(competencia);
}

/**
 * [DOC-FUNC] GET
 * O que faz: A funcao 'GET' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('inventario_consolidado_carga')
      .select('nr_carga, nr_competencia, nm_arquivo, nr_total_linhas, dt_importacao')
      .order('dt_importacao', { ascending: false })
      .limit(12);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('[GET /api/inventario/consolidado]', error);
    return NextResponse.json({ error: error.message || 'Falha ao listar consolidado.' }, { status: 500 });
  }
}

/**
 * [DOC-FUNC] POST
 * O que faz: A funcao 'POST' atende uma rota HTTP desta camada. Ela interpreta a requisicao recebida, valida o contrato esperado, aciona as regras de negocio e monta a resposta padronizada para o cliente.
 * Entradas: Recebe os parametros: request. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) percorre colecoes quando necessario para consolidar ou transformar resultados; 5) persiste alteracoes somente quando as regras de negocio permitem.
 * Retorno/Efeitos: Retorna uma resposta HTTP padronizada (sucesso ou erro), com mensagem e payload no formato esperado por quem consome a API.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, { requireAdmin: true });
    if (auth.response) return auth.response;

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? (body.rows as ConsolidadoRow[]) : [];
    const competencia = String(body?.competencia || '').trim();
    const nomeArquivo = String(body?.nomeArquivo || 'arquivo-consolidado').trim();
    const observacao = normalizarTexto(body?.observacao);

    if (!validarCompetencia(competencia)) {
      return NextResponse.json(
        { error: 'Competencia invalida. Use MM/AAAA, por exemplo 02/2026.' },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha enviada para consolidado.' }, { status: 400 });
    }

    if (rows.length > 30000) {
      return NextResponse.json(
        { error: 'Arquivo muito grande para processamento unico. Divida a planilha e tente novamente.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: existente, error: findError } = await supabase
      .from('inventario_consolidado_carga')
      .select('nr_carga')
      .eq('nr_competencia', competencia)
      .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }

    if (existente?.nr_carga) {
      const { error: deleteError } = await supabase
        .from('inventario_consolidado_carga')
        .delete()
        .eq('nr_carga', Number(existente.nr_carga));

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    const { data: carga, error: cargaError } = await supabase
      .from('inventario_consolidado_carga')
      .insert([
        {
          nr_competencia: competencia,
          nm_arquivo: nomeArquivo,
          nr_total_linhas: rows.length,
          ds_observacao: observacao,
        },
      ])
      .select('nr_carga')
      .single();

    if (cargaError || !carga) {
      throw new Error(cargaError?.message || 'Falha ao criar carga consolidada.');
    }

    const payloadLinhas = rows.map((row, index) => ({
      nr_carga: Number(carga.nr_carga),
      nr_linha: index + 2,
      ...mapearLinha(row),
    }));

    const chunkSize = 250;
    for (let start = 0; start < payloadLinhas.length; start += chunkSize) {
      const chunk = payloadLinhas.slice(start, start + chunkSize);
      const { error: linhasError } = await supabase
        .from('inventario_consolidado_linha')
        .insert(chunk);

      if (linhasError) {
        await supabase
          .from('inventario_consolidado_carga')
          .delete()
          .eq('nr_carga', Number(carga.nr_carga));

        throw new Error(`Falha ao inserir lote da Matrix (${start + 1}-${start + chunk.length}): ${linhasError.message}`);
      }
    }

    return NextResponse.json({
      sucesso: true,
      competencia,
      nr_carga: Number(carga.nr_carga),
      total_linhas: rows.length,
      substituida: Boolean(existente?.nr_carga),
    });
  } catch (error: any) {
    console.error('[POST /api/inventario/consolidado]', error);
    return NextResponse.json({ error: error.message || 'Falha ao salvar consolidado.' }, { status: 500 });
  }
}

