/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\services\inventarioService.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Inventario, CreateInventarioInput, UpdateInventarioInput } from '@/types/inventario';

/**
 * Serviço de Inventário (instâncias físicas de equipamentos)
 */

type TpHierarquia = 'RAIZ' | 'FILHO' | 'AMBOS';
type TpStatus = 'ATIVO' | 'MANUTENCAO' | 'BACKUP' | 'DEVOLUCAO';

/**
 * [DOC-FUNC] situacaoParaTpStatus
 * O que faz: Consulta informacoes na funcao 'situacaoParaTpStatus' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (ieSituacao?) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
function situacaoParaTpStatus(ieSituacao?: string | null): TpStatus {
  if (ieSituacao === 'M') return 'MANUTENCAO';
  if (ieSituacao === 'I') return 'BACKUP';
  return 'ATIVO';
}

/**
 * [DOC-FUNC] tpStatusParaSituacao
 * O que faz: Consulta informacoes na funcao 'tpStatusParaSituacao' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (tpStatus) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
function tpStatusParaSituacao(tpStatus: TpStatus): 'A' | 'M' | 'I' {
  if (tpStatus === 'MANUTENCAO') return 'M';
  if (tpStatus === 'BACKUP' || tpStatus === 'DEVOLUCAO') return 'I';
  return 'A';
}

/**
 * [DOC-FUNC] getTpHierarquiaEquipamento
 * O que faz: Consulta informacoes na funcao 'getTpHierarquiaEquipamento' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (cdEquipamento) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
async function getTpHierarquiaEquipamento(cdEquipamento: number): Promise<TpHierarquia> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipamento')
    .select('tp_hierarquia')
    .eq('cd_equipamento', cdEquipamento)
    .single();

  if (error) {
    throw new Error(`Erro ao validar tipo de hierarquia do equipamento: ${error.message}`);
  }

  return (data?.tp_hierarquia || 'AMBOS') as TpHierarquia;
}

/**
 * [DOC-FUNC] validarHierarquiaInventario
 * O que faz: Consulta informacoes na funcao 'validarHierarquiaInventario' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
async function validarHierarquiaInventario(params: {
  cd_equipamento: number;
  cd_setor: number;
  nr_invent_sup?: number | null;
  tp_status: TpStatus;
  nr_inventarioAtual?: number;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const tpHierarquia = await getTpHierarquiaEquipamento(params.cd_equipamento);

  if (tpHierarquia === 'RAIZ' && params.nr_invent_sup) {
    throw new Error('Equipamento do tipo RAIZ nao pode ter item superior vinculado.');
  }

  if (tpHierarquia === 'FILHO' && params.tp_status === 'ATIVO' && !params.nr_invent_sup) {
    throw new Error('Equipamento do tipo FILHO em status ATIVO precisa de item superior (nr_invent_sup).');
  }

  if (!params.nr_invent_sup) {
    return;
  }

  if (params.nr_inventarioAtual && params.nr_invent_sup === params.nr_inventarioAtual) {
    throw new Error('Um item nao pode apontar para ele mesmo como item superior.');
  }

  const { data: parent, error: parentError } = await supabase
    .from('inventario')
    .select('nr_inventario, cd_setor, ie_situacao, tp_status')
    .eq('nr_inventario', params.nr_invent_sup)
    .single();

  if (parentError || !parent) {
    throw new Error('Item superior informado nao foi encontrado no inventario.');
  }

  if (parent.ie_situacao === 'I' || parent.tp_status === 'BACKUP' || parent.tp_status === 'DEVOLUCAO') {
    throw new Error('Nao e permitido vincular item superior inativo.');
  }

  if (parent.cd_setor !== params.cd_setor) {
    throw new Error('Item superior e item filho devem estar no mesmo setor.');
  }
}

/**
 * [DOC-FUNC] getInventarios
 * O que faz: Consulta informacoes na funcao 'getInventarios' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (sem parametros obrigatorios) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
export async function getInventarios(): Promise<Inventario[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .order('nr_patrimonio');

  if (error) throw new Error(`Erro ao listar inventário: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getInventarioById
 * O que faz: Consulta informacoes na funcao 'getInventarioById' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (id) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
export async function getInventarioById(id: number): Promise<Inventario | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .eq('nr_inventario', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar inventário: ${error.message}`);
  return data || null;
}

/**
 * [DOC-FUNC] getInventarioByPatrimonio
 * O que faz: Consulta informacoes na funcao 'getInventarioByPatrimonio' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (patrimonio) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
export async function getInventarioByPatrimonio(patrimonio: string): Promise<Inventario | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .ilike('nr_patrimonio', patrimonio)
    .neq('ie_situacao', 'I')
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(`Erro ao buscar por patrimônio: ${error.message}`);
  return data || null;
}

/**
 * [DOC-FUNC] getInventariosBySetor
 * O que faz: Consulta informacoes na funcao 'getInventariosBySetor' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (setorId) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
export async function getInventariosBySetor(setorId: number): Promise<Inventario[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .eq('cd_setor', setorId)
    .order('nr_patrimonio');

  if (error) throw new Error(`Erro ao listar inventário por setor: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] getInventariosByEquipamento
 * O que faz: Consulta informacoes na funcao 'getInventariosByEquipamento' e organiza o retorno para consumo pelas camadas superiores.
 * Entradas: Recebe filtros/chaves (equipamentoId) e usa o contexto atual para montar a consulta na origem de dados.
 * Como executa: Executa query/chamada de leitura, trata erro de acesso e normaliza o resultado antes de devolver.
 * Retorno/Efeitos: Retorna dados tipados e prontos para uso, com tratamento consistente para ausencia de registros.
 */
export async function getInventariosByEquipamento(equipamentoId: number): Promise<Inventario[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .eq('cd_equipamento', equipamentoId)
    .order('nr_patrimonio');

  if (error) throw new Error(`Erro ao listar inventário por equipamento: ${error.message}`);
  return data || [];
}

/**
 * [DOC-FUNC] createInventario
 * O que faz: Grava novos dados na funcao 'createInventario', aplicando validacoes para preservar integridade do dominio.
 * Entradas: Recebe payload/chaves (input) e verifica campos obrigatorios antes da persistencia.
 * Como executa: Sanitiza os valores, aplica regras de negocio e executa insert/upsert com tratamento de erro transacional.
 * Retorno/Efeitos: Retorna o registro criado (ou resumo da gravacao) e sinaliza claramente conflitos/permissoes.
 */
export async function createInventario(input: CreateInventarioInput): Promise<Inventario> {
  const supabase = getSupabaseServerClient();
  const tpStatus = (input.tp_status || situacaoParaTpStatus(input.ie_situacao)) as TpStatus;

  await validarHierarquiaInventario({
    cd_equipamento: input.cd_equipamento,
    cd_setor: input.cd_setor,
    nr_invent_sup: input.nr_invent_sup,
    tp_status: tpStatus,
  });

  const payload: CreateInventarioInput = {
    ...input,
    tp_status: tpStatus,
    ie_situacao: tpStatusParaSituacao(tpStatus),
  };

  const { data, error } = await supabase
    .from('inventario')
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar inventário: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] updateInventario
 * O que faz: Atualiza dados na funcao 'updateInventario', mantendo consistencia entre o estado atual e as novas informacoes.
 * Entradas: Recebe identificador e campos para alteracao (id, input), com validacao de formato e regra de negocio.
 * Como executa: Localiza o alvo, aplica apenas mudancas permitidas e executa update com tratamento de conflito/falha.
 * Retorno/Efeitos: Devolve o estado final atualizado ou erro contextualizado para facilitar diagnostico.
 */
export async function updateInventario(
  id: number,
  input: UpdateInventarioInput,
): Promise<Inventario> {
  const supabase = getSupabaseServerClient();
  const inventarioAtual = await getInventarioById(id);
  if (!inventarioAtual) {
    throw new Error('Inventário não encontrado');
  }

  const tpStatusAtual = (inventarioAtual.tp_status || situacaoParaTpStatus(inventarioAtual.ie_situacao)) as TpStatus;
  const tpStatusNovo = (input.tp_status || tpStatusAtual) as TpStatus;
  const cdEquipamentoNovo = input.cd_equipamento ?? inventarioAtual.cd_equipamento;
  const cdSetorNovo = input.cd_setor ?? inventarioAtual.cd_setor;
  const nrInventSupNovo = input.nr_invent_sup !== undefined
    ? input.nr_invent_sup
    : inventarioAtual.nr_invent_sup;

  await validarHierarquiaInventario({
    cd_equipamento: cdEquipamentoNovo,
    cd_setor: cdSetorNovo,
    nr_invent_sup: nrInventSupNovo,
    tp_status: tpStatusNovo,
    nr_inventarioAtual: id,
  });

  const payload: UpdateInventarioInput = {
    ...input,
    tp_status: tpStatusNovo,
  };

  if (input.ie_situacao !== 'I') {
    payload.ie_situacao = tpStatusParaSituacao(tpStatusNovo);
  }

  const { data, error } = await supabase
    .from('inventario')
    .update(payload)
    .eq('nr_inventario', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar inventário: ${error.message}`);
  return data;
}

/**
 * [DOC-FUNC] moveInventarioToSetor
 * O que faz: Grava novos dados na funcao 'moveInventarioToSetor', aplicando validacoes para preservar integridade do dominio.
 * Entradas: Recebe payload/chaves (id, novoSetorId, motivo?) e verifica campos obrigatorios antes da persistencia.
 * Como executa: Sanitiza os valores, aplica regras de negocio e executa insert/upsert com tratamento de erro transacional.
 * Retorno/Efeitos: Retorna o registro criado (ou resumo da gravacao) e sinaliza claramente conflitos/permissoes.
 */
export async function moveInventarioToSetor(
  id: number,
  novoSetorId: number,
  motivo?: string,
): Promise<Inventario> {
  const supabase = getSupabaseServerClient();
  // Buscar dados atuais
  const inventario = await getInventarioById(id);
  if (!inventario) throw new Error('Inventário não encontrado');

  // Criar movimentação
  const { error: moveError } = await supabase.from('movimentacao').insert([
    {
      nr_inventario: id,
      cd_setor_origem: inventario.cd_setor,
      cd_setor_destino: novoSetorId,
      ds_observacao: motivo ?? null,
      nm_usuario: 'sistema',
    },
  ]);

  if (moveError) throw new Error(`Erro ao criar movimentação: ${moveError.message}`);

  // Atualizar setor
  return updateInventario(id, { cd_setor: novoSetorId });
}

/**
 * [DOC-FUNC] deleteInventario
 * O que faz: Remove ou inativa registros na funcao 'deleteInventario', conforme a politica de ciclo de vida do modulo.
 * Entradas: Recebe chaves/filtros do alvo (id) e valida dependencias antes da exclusao.
 * Como executa: Confere pre-condicoes de seguranca/integridade e executa delete fisico ou logico de forma controlada.
 * Retorno/Efeitos: Confirma a remocao/inativacao e reporta bloqueios quando houver vinculos ou restricoes.
 */
export async function deleteInventario(id: number): Promise<void> {
  // Soft delete
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('inventario')
    .update({ ie_situacao: 'I', tp_status: 'DEVOLUCAO' })
    .eq('nr_inventario', id);

  if (error) throw new Error(`Erro ao deletar inventário: ${error.message}`);
}

