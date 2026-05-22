/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\inventario\categorias\page.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { BasicPageShell } from '@/components/BasicPageShell';
import { StatusFeedback } from '@/components/StatusFeedback';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { invokeAuthedEdgeAction } from '@/lib/supabase/invokeEdge';

type Empresa = {
  cd_cgc: string;
  nm_empresa: string;
  nm_fantasia?: string | null;
  ds_email?: string | null;
  nr_telefone?: string | null;
  ie_situacao: 'A' | 'I';
};

type TipoEquipamento = {
  cd_tipo_equipamento: number;
  nm_tipo_equipamento: string;
  ds_tipo_equipamento?: string | null;
  ie_situacao: 'A' | 'I';
};

type Piso = {
  cd_piso: number;
  nm_piso: string;
  ds_piso?: string | null;
  ie_situacao: 'A' | 'I';
};

type Setor = {
  cd_setor: number;
  cd_piso: number;
  nm_piso?: string | null;
  nm_setor: string;
  nm_localizacao?: string | null;
  ds_setor?: string | null;
  ie_situacao: 'A' | 'I';
};

type Equipamento = {
  cd_equipamento: number;
  cd_cgc: string;
  cd_tipo_equipamento: number;
  nm_equipamento: string;
  ds_equipamento?: string | null;
  nm_marca?: string | null;
  nm_modelo?: string | null;
  tp_hierarquia?: 'RAIZ' | 'FILHO' | 'AMBOS' | null;
  ie_situacao: 'A' | 'I';
};

/**
 * [DOC-FUNC] invokeInventoryAdmin
 * Objetivo: controla uma tela administrativa do sistema web.
 * Entradas: usa os parametros da assinatura e/ou estado ja carregado pela tela/servico.
 * Como executa: carrega dados da API/Edge, mantem estado de filtros e formulario, e renderiza a resposta visual para o usuario; quando algo falha, propaga mensagem contextualizada para facilitar suporte e apresentacao.
 * Saida/Efeito: devolve dados prontos para a proxima etapa ou renderiza/atualiza a interface sem alterar a regra de negocio principal.
 */
async function invokeInventoryAdmin<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  return invokeAuthedEdgeAction<T>(
    'inventory-admin',
    action,
    payload,
    'inventory-admin indisponivel',
  );
}

/**
 * [DOC-FUNC] formatSetorLabel
 * O que faz: A funcao 'formatSetorLabel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: setor, 'nm_piso' | 'nm_setor' | 'nm_localizacao'>. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatSetorLabel(setor: Pick<Setor, 'nm_piso' | 'nm_setor' | 'nm_localizacao'>): string {
  const piso = (setor.nm_piso || '').trim();
  const nomeSetor = (setor.nm_setor || '').trim();
  const localizacao = (setor.nm_localizacao || '').trim();

  return [piso, nomeSetor, localizacao].filter(Boolean).join(' > ');
}

/**
 * [DOC-FUNC] formatPisoLabel
 * O que faz: A funcao 'formatPisoLabel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: piso, 'nm_piso' | 'ds_piso'>. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatPisoLabel(piso: Pick<Piso, 'nm_piso' | 'ds_piso'>): string {
  const nome = (piso.nm_piso || '').trim();
  const descricao = (piso.ds_piso || '').trim();
  return descricao ? `${nome} (${descricao})` : nome;
}

/**
 * [DOC-FUNC] GerenciarCategoriasPage
 * Objetivo: controla uma tela administrativa do sistema web.
 * Entradas: usa os parametros da assinatura e/ou estado ja carregado pela tela/servico.
 * Como executa: carrega dados da API/Edge, mantem estado de filtros e formulario, e renderiza a resposta visual para o usuario; quando algo falha, propaga mensagem contextualizada para facilitar suporte e apresentacao.
 * Saida/Efeito: devolve dados prontos para a proxima etapa ou renderiza/atualiza a interface sem alterar a regra de negocio principal.
 */
export default function GerenciarCategoriasPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [tipos, setTipos] = useState<TipoEquipamento[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);

  const [novoPiso, setNovoPiso] = useState({
    nm_piso: '',
    ds_piso: '',
  });

  const [novaEmpresa, setNovaEmpresa] = useState({
    cd_cgc: '',
    nm_empresa: '',
    nm_fantasia: '',
    ds_email: '',
    nr_telefone: '',
  });

  const [novoTipo, setNovoTipo] = useState({
    nm_tipo_equipamento: '',
    ds_tipo_equipamento: '',
  });

  const [novoSetor, setNovoSetor] = useState({
    cd_piso: '',
    nm_setor: '',
    nm_localizacao: '',
    ds_setor: '',
  });

  const [novoEquipamento, setNovoEquipamento] = useState({
    cd_cgc: '',
    cd_tipo_equipamento: '',
    nm_equipamento: '',
    ds_equipamento: '',
    nm_marca: '',
    nm_modelo: '',
    tp_hierarquia: 'AMBOS' as 'RAIZ' | 'FILHO' | 'AMBOS',
  });

  const [empresaSelecionada, setEmpresaSelecionada] = useState('');
  const [pisoSelecionado, setPisoSelecionado] = useState('');
  const [tipoSelecionado, setTipoSelecionado] = useState('');
  const [setorSelecionado, setSetorSelecionado] = useState('');
  const [equipamentoSelecionado, setEquipamentoSelecionado] = useState('');
  const [novoCadastroModalOpen, setNovoCadastroModalOpen] = useState(false);
  const [editarCadastroModalOpen, setEditarCadastroModalOpen] = useState(false);

  const [edicaoEmpresa, setEdicaoEmpresa] = useState({
    cd_cgc: '',
    nm_empresa: '',
    nm_fantasia: '',
    ds_email: '',
    nr_telefone: '',
  });

  const [edicaoPiso, setEdicaoPiso] = useState({
    nm_piso: '',
    ds_piso: '',
  });

  const [edicaoTipo, setEdicaoTipo] = useState({
    nm_tipo_equipamento: '',
    ds_tipo_equipamento: '',
  });

  const [edicaoSetor, setEdicaoSetor] = useState({
    cd_piso: '',
    nm_setor: '',
    nm_localizacao: '',
    ds_setor: '',
  });

  const [edicaoEquipamento, setEdicaoEquipamento] = useState({
    cd_cgc: '',
    cd_tipo_equipamento: '',
    nm_equipamento: '',
    ds_equipamento: '',
    nm_marca: '',
    nm_modelo: '',
    tp_hierarquia: 'AMBOS' as 'RAIZ' | 'FILHO' | 'AMBOS',
  });

  /**
   * [DOC-FUNC] carregarTudo
   * O que faz: A funcao 'carregarTudo' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function carregarTudo() {
    setLoading(true);
    setErro(null);
    try {
      const response = await invokeInventoryAdmin<{
        pisos: Piso[];
        empresas: Empresa[];
        tipos: TipoEquipamento[];
        setores: Setor[];
        equipamentos: Equipamento[];
      }>('list');

      setPisos(Array.isArray(response.pisos) ? response.pisos : []);
      setEmpresas(Array.isArray(response.empresas) ? response.empresas : []);
      setTipos(Array.isArray(response.tipos) ? response.tipos : []);
      setSetores(Array.isArray(response.setores) ? response.setores : []);
      setEquipamentos(Array.isArray(response.equipamentos) ? response.equipamentos : []);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Falha ao carregar dados de gerenciamento.';
      setErro(mensagem);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    /**
     * [DOC-FUNC] loadAuth
     * O que faz: A funcao 'loadAuth' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
     * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
     * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 5) trata erros de forma explicita para facilitar diagnostico e operacao.
     * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
     */
    const loadAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setIsAdmin(false);
          setAuthChecked(true);
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.sucesso || !active) {
          setIsAdmin(false);
          setAuthChecked(true);
          return;
        }

        const perfilNome = String(payload?.dados?.perfil?.nm_perfil || '').trim().toUpperCase();
        setIsAdmin(perfilNome === 'ADMIN');
      } catch {
        setIsAdmin(false);
      } finally {
        if (active) setAuthChecked(true);
      }
    };

    void loadAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    void carregarTudo();
  }, [authChecked, isAdmin]);

  useEffect(() => {
    if (!empresaSelecionada) return;
    const atual = empresas.find((item) => item.cd_cgc === empresaSelecionada);
    if (!atual) return;

    setEdicaoEmpresa({
      cd_cgc: atual.cd_cgc || '',
      nm_empresa: atual.nm_empresa || '',
      nm_fantasia: atual.nm_fantasia || '',
      ds_email: atual.ds_email || '',
      nr_telefone: atual.nr_telefone || '',
    });
  }, [empresaSelecionada, empresas]);

  useEffect(() => {
    if (!pisoSelecionado) return;
    const id = Number(pisoSelecionado);
    const atual = pisos.find((item) => item.cd_piso === id);
    if (!atual) return;

    setEdicaoPiso({
      nm_piso: atual.nm_piso || '',
      ds_piso: atual.ds_piso || '',
    });
  }, [pisoSelecionado, pisos]);

  useEffect(() => {
    if (!tipoSelecionado) return;
    const id = Number(tipoSelecionado);
    const atual = tipos.find((item) => item.cd_tipo_equipamento === id);
    if (!atual) return;

    setEdicaoTipo({
      nm_tipo_equipamento: atual.nm_tipo_equipamento || '',
      ds_tipo_equipamento: atual.ds_tipo_equipamento || '',
    });
  }, [tipoSelecionado, tipos]);

  useEffect(() => {
    if (!setorSelecionado) return;
    const id = Number(setorSelecionado);
    const atual = setores.find((item) => item.cd_setor === id);
    if (!atual) return;

    setEdicaoSetor({
      cd_piso: atual.cd_piso ? String(atual.cd_piso) : '',
      nm_setor: atual.nm_setor || '',
      nm_localizacao: atual.nm_localizacao || '',
      ds_setor: atual.ds_setor || '',
    });
  }, [setorSelecionado, setores]);

  useEffect(() => {
    if (!equipamentoSelecionado) return;
    const id = Number(equipamentoSelecionado);
    const atual = equipamentos.find((item) => item.cd_equipamento === id);
    if (!atual) return;

    setEdicaoEquipamento({
      cd_cgc: atual.cd_cgc || '',
      cd_tipo_equipamento: String(atual.cd_tipo_equipamento || ''),
      nm_equipamento: atual.nm_equipamento || '',
      ds_equipamento: atual.ds_equipamento || '',
      nm_marca: atual.nm_marca || '',
      nm_modelo: atual.nm_modelo || '',
      tp_hierarquia: (atual.tp_hierarquia || 'AMBOS') as 'RAIZ' | 'FILHO' | 'AMBOS',
    });
  }, [equipamentoSelecionado, equipamentos]);

  /**
   * [DOC-FUNC] criarEmpresa
   * O que faz: A funcao 'criarEmpresa' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function criarEmpresa() {
    if (!novaEmpresa.cd_cgc || !novaEmpresa.nm_empresa) {
      setErro('Preencha CNPJ/CGC e nome da empresa.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('create_empresa', {
        cd_cgc: novaEmpresa.cd_cgc,
        nm_empresa: novaEmpresa.nm_empresa,
        nm_fantasia: novaEmpresa.nm_fantasia || null,
        ds_email: novaEmpresa.ds_email || null,
        nr_telefone: novaEmpresa.nr_telefone || null,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar empresa.');
      return;
    }

    setOk('Empresa criada com sucesso.');
    setNovaEmpresa({ cd_cgc: '', nm_empresa: '', nm_fantasia: '', ds_email: '', nr_telefone: '' });
    await carregarTudo();
  }

  /**
   * [DOC-FUNC] criarTipo
   * O que faz: A funcao 'criarTipo' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function criarTipo() {
    if (!novoTipo.nm_tipo_equipamento) {
      setErro('Preencha o nome do tipo de equipamento.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('create_tipo', {
        nm_tipo_equipamento: novoTipo.nm_tipo_equipamento,
        ds_tipo_equipamento: novoTipo.ds_tipo_equipamento || null,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar tipo de equipamento.');
      return;
    }

    setOk('Tipo de equipamento criado com sucesso.');
    setNovoTipo({ nm_tipo_equipamento: '', ds_tipo_equipamento: '' });
    await carregarTudo();
  }

  /**
   * [DOC-FUNC] criarPiso
   * O que faz: A funcao 'criarPiso' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function criarPiso() {
    if (!novoPiso.nm_piso.trim()) {
      setErro('Preencha o nome do piso.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('create_piso', {
        nm_piso: novoPiso.nm_piso.trim(),
        ds_piso: novoPiso.ds_piso.trim() || null,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar piso.');
      return;
    }

    setOk('Piso criado com sucesso.');
    setNovoPiso({ nm_piso: '', ds_piso: '' });
    await carregarTudo();
  }

  /**
   * [DOC-FUNC] criarSetor
   * O que faz: A funcao 'criarSetor' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function criarSetor() {
    if (!novoSetor.cd_piso || !novoSetor.nm_setor) {
      setErro('Preencha piso e nome do setor.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('create_setor', {
        cd_piso: Number(novoSetor.cd_piso),
        nm_setor: novoSetor.nm_setor,
        nm_localizacao: novoSetor.nm_localizacao || null,
        ds_setor: novoSetor.ds_setor || null,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar setor.');
      return;
    }

    setOk('Setor criado com sucesso.');
    setNovoSetor({ cd_piso: '', nm_setor: '', nm_localizacao: '', ds_setor: '' });
    await carregarTudo();
  }

  /**
   * [DOC-FUNC] criarEquipamento
   * O que faz: A funcao 'criarEquipamento' registra novos dados de negocio. Ela valida a entrada, monta o payload no formato exigido e executa a gravacao de forma segura.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function criarEquipamento() {
    if (
      !novoEquipamento.cd_cgc ||
      !novoEquipamento.cd_tipo_equipamento ||
      !novoEquipamento.nm_equipamento ||
      !novoEquipamento.nm_modelo
    ) {
      setErro('Preencha empresa, tipo, nome e modelo do equipamento.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('create_equipamento', {
        cd_cgc: novoEquipamento.cd_cgc,
        cd_tipo_equipamento: Number(novoEquipamento.cd_tipo_equipamento),
        nm_equipamento: novoEquipamento.nm_equipamento,
        ds_equipamento: novoEquipamento.ds_equipamento || null,
        nm_marca: novoEquipamento.nm_marca || null,
        nm_modelo: novoEquipamento.nm_modelo,
        tp_hierarquia: novoEquipamento.tp_hierarquia,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar modelo de equipamento.');
      return;
    }

    setOk('Equipamento criado com sucesso.');
    setNovoEquipamento({
      cd_cgc: '',
      cd_tipo_equipamento: '',
      nm_equipamento: '',
      ds_equipamento: '',
      nm_marca: '',
      nm_modelo: '',
      tp_hierarquia: 'AMBOS',
    });
    await carregarTudo();
  }

  /**
   * [DOC-FUNC] atualizarEmpresa
   * O que faz: A funcao 'atualizarEmpresa' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function atualizarEmpresa() {
    if (!empresaSelecionada) {
      setErro('Selecione uma empresa para editar.');
      return;
    }

    if (!edicaoEmpresa.nm_empresa.trim()) {
      setErro('Nome da empresa é obrigatório.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('update_empresa', {
        cd_cgc: empresaSelecionada,
        nm_empresa: edicaoEmpresa.nm_empresa.trim(),
        nm_fantasia: edicaoEmpresa.nm_fantasia.trim() || null,
        ds_email: edicaoEmpresa.ds_email.trim() || null,
        nr_telefone: edicaoEmpresa.nr_telefone.trim() || null,
      });
      setOk('Empresa atualizada com sucesso.');
      await carregarTudo();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar empresa.');
    }
  }

  /**
   * [DOC-FUNC] atualizarTipo
   * O que faz: A funcao 'atualizarTipo' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function atualizarTipo() {
    if (!tipoSelecionado) {
      setErro('Selecione um tipo para editar.');
      return;
    }

    if (!edicaoTipo.nm_tipo_equipamento.trim()) {
      setErro('Nome do tipo é obrigatório.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('update_tipo', {
        cd_tipo_equipamento: Number(tipoSelecionado),
        nm_tipo_equipamento: edicaoTipo.nm_tipo_equipamento.trim(),
        ds_tipo_equipamento: edicaoTipo.ds_tipo_equipamento.trim() || null,
      });
      setOk('Tipo atualizado com sucesso.');
      await carregarTudo();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar tipo.');
    }
  }

  /**
   * [DOC-FUNC] atualizarPiso
   * O que faz: A funcao 'atualizarPiso' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function atualizarPiso() {
    if (!pisoSelecionado) {
      setErro('Selecione um piso para editar.');
      return;
    }

    if (!edicaoPiso.nm_piso.trim()) {
      setErro('Nome do piso é obrigatório.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('update_piso', {
        cd_piso: Number(pisoSelecionado),
        nm_piso: edicaoPiso.nm_piso.trim(),
        ds_piso: edicaoPiso.ds_piso.trim() || null,
      });
      setOk('Piso atualizado com sucesso.');
      await carregarTudo();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar piso.');
    }
  }

  /**
   * [DOC-FUNC] atualizarSetor
   * O que faz: A funcao 'atualizarSetor' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function atualizarSetor() {
    if (!setorSelecionado) {
      setErro('Selecione um setor para editar.');
      return;
    }

    if (!edicaoSetor.nm_setor.trim()) {
      setErro('Nome do setor é obrigatório.');
      return;
    }

    if (!edicaoSetor.cd_piso) {
      setErro('Piso é obrigatório.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('update_setor', {
        cd_setor: Number(setorSelecionado),
        cd_piso: Number(edicaoSetor.cd_piso),
        nm_setor: edicaoSetor.nm_setor.trim(),
        nm_localizacao: edicaoSetor.nm_localizacao.trim() || null,
        ds_setor: edicaoSetor.ds_setor.trim() || null,
      });
      setOk('Setor atualizado com sucesso.');
      await carregarTudo();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar setor.');
    }
  }

  /**
   * [DOC-FUNC] atualizarEquipamento
   * O que faz: A funcao 'atualizarEquipamento' altera estado existente. Ela confere pre-condicoes, aplica as regras da mudanca e persiste somente o que e permitido no dominio.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  async function atualizarEquipamento() {
    if (!equipamentoSelecionado) {
      setErro('Selecione um equipamento para editar.');
      return;
    }

    if (
      !edicaoEquipamento.cd_cgc ||
      !edicaoEquipamento.cd_tipo_equipamento ||
      !edicaoEquipamento.nm_equipamento.trim() ||
      !edicaoEquipamento.nm_modelo.trim()
    ) {
      setErro('Preencha empresa, tipo, nome e modelo no equipamento.');
      return;
    }

    setErro(null);
    setOk(null);
    try {
      await invokeInventoryAdmin('update_equipamento', {
        cd_equipamento: Number(equipamentoSelecionado),
        cd_cgc: edicaoEquipamento.cd_cgc,
        cd_tipo_equipamento: Number(edicaoEquipamento.cd_tipo_equipamento),
        nm_equipamento: edicaoEquipamento.nm_equipamento.trim(),
        ds_equipamento: edicaoEquipamento.ds_equipamento.trim() || null,
        nm_marca: edicaoEquipamento.nm_marca.trim() || null,
        nm_modelo: edicaoEquipamento.nm_modelo.trim(),
        tp_hierarquia: edicaoEquipamento.tp_hierarquia,
      });
      setOk('Equipamento atualizado com sucesso.');
      await carregarTudo();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar equipamento.');
    }
  }

  const resumo = useMemo(
    () => ({ pisos: pisos.length, empresas: empresas.length, tipos: tipos.length, setores: setores.length, equipamentos: equipamentos.length }),
    [pisos.length, empresas.length, tipos.length, setores.length, equipamentos.length]
  );

  if (!authChecked) {
    return (
      <BasicPageShell title="Gerenciar Inventário (Admin)" subtitle="Cadastre empresas, tipos, setores e equipamentos">
        <div className="ui-card">Validando permissão...</div>
      </BasicPageShell>
    );
  }

  if (!isAdmin) {
    return (
      <BasicPageShell title="Gerenciar Inventário (Admin)" subtitle="Cadastre empresas, tipos, setores e equipamentos">
        <div className="ui-card">Acesso restrito. Esta tela exige perfil ADMIN.</div>
      </BasicPageShell>
    );
  }

  return (
    <BasicPageShell title="Gerenciar Inventário (Admin)" subtitle="Cadastre empresas, tipos, setores e equipamentos">
      <div className="ui-stack">
        <StatusFeedback loading={loading} error={erro} success={ok} />

        <div className="ui-grid-4">
          <div className="ui-card">Pisos: <strong>{resumo.pisos}</strong></div>
          <div className="ui-card">Empresas: <strong>{resumo.empresas}</strong></div>
          <div className="ui-card">Tipos: <strong>{resumo.tipos}</strong></div>
          <div className="ui-card">Setores: <strong>{resumo.setores}</strong></div>
          <div className="ui-card">Modelos: <strong>{resumo.equipamentos}</strong></div>
        </div>

        <div className="ui-card ui-muted-note">
          Configure primeiro empresa, tipo e setor. Depois cadastre o modelo com tp_hierarquia para controlar o
          vínculo CPU/monitor/nobreak no inventário.
        </div>

        <div className="ui-grid-3">
          <div className="ui-card ui-muted-note">
            <strong>Piso + Setor:</strong> cada setor/localização pertence a um piso cadastrado (ex.: 1º Andar &gt; SAME &gt; Sala de Equipamentos).
          </div>
          <div className="ui-card ui-muted-note">
            <strong>Tipo:</strong> classe do equipamento (CPU, MONITOR, NOBREAK, TABLET, IMPRESSORA).
          </div>
          <div className="ui-card ui-muted-note">
            <strong>Modelo:</strong> catálogo técnico usado no inventário oficial para criar cada item físico.
          </div>
        </div>

        <div className="ui-card ui-stack">
          <h2 className="ui-title-reset">Fluxos de cadastro</h2>
          <p className="ui-muted-note ui-kv-flat">
            Escolha o fluxo para abrir no modal: novo cadastro ou edição de cadastros existentes.
          </p>
          <div className="ui-inline-actions">
            <button className="ui-btn ui-btn-primary" onClick={() => setNovoCadastroModalOpen(true)}>
              NOVO CADASTRO
            </button>
            <button className="ui-btn" onClick={() => setEditarCadastroModalOpen(true)}>
              EDITAR CADASTRO
            </button>
          </div>
        </div>

        <Dialog open={novoCadastroModalOpen} onOpenChange={setNovoCadastroModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cadastro</DialogTitle>
              <DialogDescription>
                Cadastre piso, empresa, tipo, setor (vinculado ao piso) e modelos de equipamento.
              </DialogDescription>
            </DialogHeader>
            <div className="ui-modal-body">
              <div className="ui-grid-2">
                <div className="ui-card ui-form-card">
                  <h2 className="ui-title-reset">Nova Empresa</h2>
                  <input className="ui-field" placeholder="CNPJ/CGC" value={novaEmpresa.cd_cgc} onChange={(e) => setNovaEmpresa(v => ({ ...v, cd_cgc: e.target.value }))} />
                  <input className="ui-field" placeholder="Nome" value={novaEmpresa.nm_empresa} onChange={(e) => setNovaEmpresa(v => ({ ...v, nm_empresa: e.target.value }))} />
                  <input className="ui-field" placeholder="Fantasia" value={novaEmpresa.nm_fantasia} onChange={(e) => setNovaEmpresa(v => ({ ...v, nm_fantasia: e.target.value }))} />
                  <input className="ui-field" placeholder="E-mail" value={novaEmpresa.ds_email} onChange={(e) => setNovaEmpresa(v => ({ ...v, ds_email: e.target.value }))} />
                  <input className="ui-field" placeholder="Telefone" value={novaEmpresa.nr_telefone} onChange={(e) => setNovaEmpresa(v => ({ ...v, nr_telefone: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={criarEmpresa}>Salvar Empresa</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h2 className="ui-title-reset">Novo Tipo de Equipamento</h2>
                  <input className="ui-field" placeholder="Nome do tipo" value={novoTipo.nm_tipo_equipamento} onChange={(e) => setNovoTipo(v => ({ ...v, nm_tipo_equipamento: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição" value={novoTipo.ds_tipo_equipamento} onChange={(e) => setNovoTipo(v => ({ ...v, ds_tipo_equipamento: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={criarTipo}>Salvar Tipo</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h2 className="ui-title-reset">Novo Piso</h2>
                  <input className="ui-field" placeholder="Nome do piso (ex.: 1º Andar, Térreo, Anexo A)" value={novoPiso.nm_piso} onChange={(e) => setNovoPiso(v => ({ ...v, nm_piso: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição do piso (opcional)" value={novoPiso.ds_piso} onChange={(e) => setNovoPiso(v => ({ ...v, ds_piso: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={criarPiso}>Salvar Piso</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h2 className="ui-title-reset">Novo Setor</h2>
                  <select className="ui-select" value={novoSetor.cd_piso} onChange={(e) => setNovoSetor(v => ({ ...v, cd_piso: e.target.value }))}>
                    <option value="">Selecione piso</option>
                    {pisos.map((p) => <option key={p.cd_piso} value={p.cd_piso}>{formatPisoLabel(p)}</option>)}
                  </select>
                  <input className="ui-field" placeholder="Nome do setor" value={novoSetor.nm_setor} onChange={(e) => setNovoSetor(v => ({ ...v, nm_setor: e.target.value }))} />
                  <input className="ui-field" placeholder="Localização (opcional)" value={novoSetor.nm_localizacao} onChange={(e) => setNovoSetor(v => ({ ...v, nm_localizacao: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição" value={novoSetor.ds_setor} onChange={(e) => setNovoSetor(v => ({ ...v, ds_setor: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={criarSetor}>Salvar Setor</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h2 className="ui-title-reset">Novo Equipamento (Modelo)</h2>
                  <select className="ui-select" value={novoEquipamento.cd_cgc} onChange={(e) => setNovoEquipamento(v => ({ ...v, cd_cgc: e.target.value }))}>
                    <option value="">Selecione empresa</option>
                    {empresas.map((e) => <option key={e.cd_cgc} value={e.cd_cgc}>{e.nm_empresa}</option>)}
                  </select>
                  <select className="ui-select" value={novoEquipamento.cd_tipo_equipamento} onChange={(e) => setNovoEquipamento(v => ({ ...v, cd_tipo_equipamento: e.target.value }))}>
                    <option value="">Selecione tipo</option>
                    {tipos.map((t) => <option key={t.cd_tipo_equipamento} value={t.cd_tipo_equipamento}>{t.nm_tipo_equipamento}</option>)}
                  </select>
                  <input className="ui-field" placeholder="Nome equipamento" value={novoEquipamento.nm_equipamento} onChange={(e) => setNovoEquipamento(v => ({ ...v, nm_equipamento: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição" value={novoEquipamento.ds_equipamento} onChange={(e) => setNovoEquipamento(v => ({ ...v, ds_equipamento: e.target.value }))} />
                  <input className="ui-field" placeholder="Marca" value={novoEquipamento.nm_marca} onChange={(e) => setNovoEquipamento(v => ({ ...v, nm_marca: e.target.value }))} />
                  <input className="ui-field" placeholder="Modelo" value={novoEquipamento.nm_modelo} onChange={(e) => setNovoEquipamento(v => ({ ...v, nm_modelo: e.target.value }))} />
                  <select
                    className="ui-select"
                    value={novoEquipamento.tp_hierarquia}
                    onChange={(e) => setNovoEquipamento(v => ({ ...v, tp_hierarquia: e.target.value as 'RAIZ' | 'FILHO' | 'AMBOS' }))}
                  >
                    <option value="RAIZ">RAIZ (não pode ter item superior)</option>
                    <option value="FILHO">FILHO (ativo exige item superior)</option>
                    <option value="AMBOS">AMBOS (pode ter ou não)</option>
                  </select>
                  <button className="ui-btn ui-btn-primary" onClick={criarEquipamento}>Salvar Modelo</button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editarCadastroModalOpen} onOpenChange={setEditarCadastroModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Cadastro</DialogTitle>
              <DialogDescription>
                Selecione um registro para carregar os campos e salvar alterações.
              </DialogDescription>
            </DialogHeader>
            <div className="ui-modal-body">
              <div className="ui-grid-2">
                <div className="ui-card ui-form-card">
                  <h3 className="ui-title-reset">Editar Empresa</h3>
                  <select className="ui-select" value={empresaSelecionada} onChange={(e) => setEmpresaSelecionada(e.target.value)}>
                    <option value="">Selecione empresa</option>
                    {empresas.map((item) => (
                      <option key={item.cd_cgc} value={item.cd_cgc}>{item.nm_empresa}</option>
                    ))}
                  </select>
                  <input className="ui-field" placeholder="CNPJ/CGC" value={edicaoEmpresa.cd_cgc} readOnly />
                  <input className="ui-field" placeholder="Nome" value={edicaoEmpresa.nm_empresa} onChange={(e) => setEdicaoEmpresa((v) => ({ ...v, nm_empresa: e.target.value }))} />
                  <input className="ui-field" placeholder="Fantasia" value={edicaoEmpresa.nm_fantasia} onChange={(e) => setEdicaoEmpresa((v) => ({ ...v, nm_fantasia: e.target.value }))} />
                  <input className="ui-field" placeholder="E-mail" value={edicaoEmpresa.ds_email} onChange={(e) => setEdicaoEmpresa((v) => ({ ...v, ds_email: e.target.value }))} />
                  <input className="ui-field" placeholder="Telefone" value={edicaoEmpresa.nr_telefone} onChange={(e) => setEdicaoEmpresa((v) => ({ ...v, nr_telefone: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={atualizarEmpresa}>Salvar Empresa</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h3 className="ui-title-reset">Editar Tipo de Equipamento</h3>
                  <select className="ui-select" value={tipoSelecionado} onChange={(e) => setTipoSelecionado(e.target.value)}>
                    <option value="">Selecione tipo</option>
                    {tipos.map((item) => (
                      <option key={item.cd_tipo_equipamento} value={item.cd_tipo_equipamento}>{item.nm_tipo_equipamento}</option>
                    ))}
                  </select>
                  <input className="ui-field" placeholder="Nome do tipo" value={edicaoTipo.nm_tipo_equipamento} onChange={(e) => setEdicaoTipo((v) => ({ ...v, nm_tipo_equipamento: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição" value={edicaoTipo.ds_tipo_equipamento} onChange={(e) => setEdicaoTipo((v) => ({ ...v, ds_tipo_equipamento: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={atualizarTipo}>Salvar Tipo</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h3 className="ui-title-reset">Editar Piso</h3>
                  <select className="ui-select" value={pisoSelecionado} onChange={(e) => setPisoSelecionado(e.target.value)}>
                    <option value="">Selecione piso</option>
                    {pisos.map((item) => (
                      <option key={item.cd_piso} value={item.cd_piso}>{formatPisoLabel(item)}</option>
                    ))}
                  </select>
                  <input className="ui-field" placeholder="Nome do piso" value={edicaoPiso.nm_piso} onChange={(e) => setEdicaoPiso((v) => ({ ...v, nm_piso: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição (opcional)" value={edicaoPiso.ds_piso} onChange={(e) => setEdicaoPiso((v) => ({ ...v, ds_piso: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={atualizarPiso}>Salvar Piso</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h3 className="ui-title-reset">Editar Setor</h3>
                  <select className="ui-select" value={setorSelecionado} onChange={(e) => setSetorSelecionado(e.target.value)}>
                    <option value="">Selecione setor</option>
                    {setores.map((item) => (
                      <option key={item.cd_setor} value={item.cd_setor}>{formatSetorLabel(item)}</option>
                    ))}
                  </select>
                  <select className="ui-select" value={edicaoSetor.cd_piso} onChange={(e) => setEdicaoSetor((v) => ({ ...v, cd_piso: e.target.value }))}>
                    <option value="">Selecione piso</option>
                    {pisos.map((item) => (
                      <option key={item.cd_piso} value={item.cd_piso}>{formatPisoLabel(item)}</option>
                    ))}
                  </select>
                  <input className="ui-field" placeholder="Nome do setor" value={edicaoSetor.nm_setor} onChange={(e) => setEdicaoSetor((v) => ({ ...v, nm_setor: e.target.value }))} />
                  <input className="ui-field" placeholder="Localização (opcional)" value={edicaoSetor.nm_localizacao} onChange={(e) => setEdicaoSetor((v) => ({ ...v, nm_localizacao: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição" value={edicaoSetor.ds_setor} onChange={(e) => setEdicaoSetor((v) => ({ ...v, ds_setor: e.target.value }))} />
                  <button className="ui-btn ui-btn-primary" onClick={atualizarSetor}>Salvar Setor</button>
                </div>

                <div className="ui-card ui-form-card">
                  <h3 className="ui-title-reset">Editar Equipamento (Modelo)</h3>
                  <select className="ui-select" value={equipamentoSelecionado} onChange={(e) => setEquipamentoSelecionado(e.target.value)}>
                    <option value="">Selecione equipamento</option>
                    {equipamentos.map((item) => (
                      <option key={item.cd_equipamento} value={item.cd_equipamento}>{item.nm_modelo || item.nm_equipamento}</option>
                    ))}
                  </select>
                  <select className="ui-select" value={edicaoEquipamento.cd_cgc} onChange={(e) => setEdicaoEquipamento((v) => ({ ...v, cd_cgc: e.target.value }))}>
                    <option value="">Selecione empresa</option>
                    {empresas.map((item) => (
                      <option key={item.cd_cgc} value={item.cd_cgc}>{item.nm_empresa}</option>
                    ))}
                  </select>
                  <select className="ui-select" value={edicaoEquipamento.cd_tipo_equipamento} onChange={(e) => setEdicaoEquipamento((v) => ({ ...v, cd_tipo_equipamento: e.target.value }))}>
                    <option value="">Selecione tipo</option>
                    {tipos.map((item) => (
                      <option key={item.cd_tipo_equipamento} value={item.cd_tipo_equipamento}>{item.nm_tipo_equipamento}</option>
                    ))}
                  </select>
                  <input className="ui-field" placeholder="Nome equipamento" value={edicaoEquipamento.nm_equipamento} onChange={(e) => setEdicaoEquipamento((v) => ({ ...v, nm_equipamento: e.target.value }))} />
                  <input className="ui-field" placeholder="Descrição" value={edicaoEquipamento.ds_equipamento} onChange={(e) => setEdicaoEquipamento((v) => ({ ...v, ds_equipamento: e.target.value }))} />
                  <input className="ui-field" placeholder="Marca" value={edicaoEquipamento.nm_marca} onChange={(e) => setEdicaoEquipamento((v) => ({ ...v, nm_marca: e.target.value }))} />
                  <input className="ui-field" placeholder="Modelo" value={edicaoEquipamento.nm_modelo} onChange={(e) => setEdicaoEquipamento((v) => ({ ...v, nm_modelo: e.target.value }))} />
                  <select className="ui-select" value={edicaoEquipamento.tp_hierarquia} onChange={(e) => setEdicaoEquipamento((v) => ({ ...v, tp_hierarquia: e.target.value as 'RAIZ' | 'FILHO' | 'AMBOS' }))}>
                    <option value="RAIZ">RAIZ</option>
                    <option value="FILHO">FILHO</option>
                    <option value="AMBOS">AMBOS</option>
                  </select>
                  <button className="ui-btn ui-btn-primary" onClick={atualizarEquipamento}>Salvar Equipamento</button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </BasicPageShell>
  );
}

