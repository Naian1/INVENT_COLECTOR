"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BasicPageShell } from "@/components/BasicPageShell";
import { StatusFeedback } from "@/components/StatusFeedback";
import { SuprimentosLista } from "@/components/SuprimentosLista";
import { supabase } from "@/lib/supabase/client";

type ImpressoraVisao = {
  id: string;
  patrimonio: string;
  ip: string;
  setor: string;
  localizacao: string | null;
  modelo: string;
  fabricante: string | null;
  numero_serie: string | null;
  hostname: string | null;
  ativo: boolean;
  ultima_coleta_em: string | null;
  status_atual: string;
  contador_paginas_atual: number | null;
  menor_nivel_suprimento: number | null;
  resumo_suprimentos: Array<{
    chave_suprimento: string;
    nome_suprimento: string;
    nivel_percentual: number | null;
    quantidade_atual: number | null;
    status_suprimento: string;
  }>;
  operacional: boolean;
  origem_linha_id: string | null;
};

type CategoriaInventario = {
  id: string;
  nome: string;
  aba_inventario_id: string;
  ativo: boolean;
};

type LinhaInventario = {
  id: string;
  codigo_linha: string | null;
  observacao: string | null;
  setor: string | null;
  localizacao: string | null;
  ativo: boolean;
};

type LinhaValorDef = {
  campo: {
    id: string;
    nome_campo_exibicao: string;
    chave_campo: string;
    tipo_semantico: string;
  };
  valor: {
    valor_texto?: string | null;
    valor_numero?: number | null;
    valor_booleano?: boolean | null;
    valor_data?: string | null;
    valor_ip?: string | null;
    valor_json?: unknown;
  } | null;
};

type FiltroOperacional = "todos" | "operacional" | "nao_operacional";
type FiltroStatus = "todos" | "online" | "offline" | "warning" | "error" | "unknown" | "nao_operacional";
type FiltroRapido =
  | "todos"
  | "online"
  | "offline"
  | "nao_operacional"
  | "toner_baixo"
  | "toner_critico"
  | "sem_coleta";

type QuickFilterItem = {
  key: FiltroRapido;
  label: string;
  count: number;
  tone: "neutral" | "online" | "offline" | "warn" | "danger";
};

type ColunaOrdenacao =
  | "operacional"
  | "patrimonio"
  | "ip"
  | "modelo"
  | "setor"
  | "localizacao"
  | "status_atual"
  | "ultima_coleta_em"
  | "contador_paginas_atual"
  | "menor_nivel_suprimento";

type DirecaoOrdenacao = "asc" | "desc";

const BUSCA_DEBOUNCE_MS = 350;
const COLETA_STALE_WARN_MINUTOS = 30;
const COLETA_STALE_CRITICO_MINUTOS = 120;

async function invokePrintFunction<T>(action: string, payload?: Record<string, unknown>, timeoutMs = 25000) {
  let timeoutHandle: number | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = window.setTimeout(() => {
        reject(new Error(`Tempo esgotado ao executar ${action}.`));
      }, timeoutMs);
    });

    const invokePromise = supabase.functions.invoke("inventory-print", {
      body: { action, payload: payload ?? {} },
    });

    const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as {
      data: { ok?: boolean; data?: T; error?: string } | null;
      error: { message?: string } | null;
    };

    if (!error && data?.ok) {
      return data.data as T;
    }

    const reason = error?.message || data?.error || `Falha ao executar ${action}.`;
    throw new Error(reason);
  } finally {
    if (timeoutHandle !== undefined) {
      window.clearTimeout(timeoutHandle);
    }
  }
}

function toFiniteNullable(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolverNivelPercentualSuprimento(item: {
  nivel_percentual: number | null;
  quantidade_atual: number | null;
}) {
  const nivel = toFiniteNullable(item.nivel_percentual);
  if (nivel !== null && nivel >= 0 && nivel <= 100) return nivel;

  const quantidade = toFiniteNullable(item.quantidade_atual);
  if (quantidade !== null && quantidade >= 0 && quantidade <= 100) return quantidade;

  return null;
}

function classificarSuprimentos(
  menorNivel: number | null,
  resumo: ImpressoraVisao["resumo_suprimentos"]
) {
  const nivel = toFiniteNullable(menorNivel);
  const nivelReferencia =
    nivel !== null
      ? nivel
      : resumo
          .map((item) => resolverNivelPercentualSuprimento(item))
          .filter((v): v is number => v !== null)
          .reduce<number | null>((acc, cur) => (acc === null || cur < acc ? cur : acc), null);

  if (nivelReferencia !== null) {
    if (nivelReferencia <= 5) return "critico";
    if (nivelReferencia <= 15) return "baixo";
    return "ok";
  }

  const statusList = (resumo || []).map((item) => String(item.status_suprimento || "").toLowerCase());
  if (statusList.some((status) => ["critical", "empty", "offline"].includes(status))) return "critico";
  if (statusList.some((status) => ["low", "warning"].includes(status))) return "baixo";
  if (statusList.some((status) => status === "ok")) return "ok";
  return "desconhecido";
}

function formatarPercentualSuprimento(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

function formatarIndicadorSuprimento(value: number | null) {
  if (value !== null && !Number.isNaN(value)) return formatarPercentualSuprimento(value);
  return "-";
}

function classeNivelSuprimento(value: number | null) {
  if (value === null || Number.isNaN(value)) return "warn";
  if (value <= 5) return "danger";
  if (value <= 15) return "warn";
  return "ok";
}

function obterMenorSuprimentoInfo(
  suprimentos: ImpressoraVisao["resumo_suprimentos"]
) {
  let menor: (ImpressoraVisao["resumo_suprimentos"][number] & { nivelNumero: number; quantidadeNumero: number | null }) | null = null;
  let menorPorQuantidade:
    | (ImpressoraVisao["resumo_suprimentos"][number] & { nivelNumero: number; quantidadeNumero: number })
    | null = null;
  for (const item of suprimentos) {
    const nivel = resolverNivelPercentualSuprimento(item);
    if (nivel !== null) {
      if (!menor || nivel < menor.nivelNumero) {
        menor = {
          ...item,
          nivelNumero: nivel,
          quantidadeNumero: toFiniteNullable(item.quantidade_atual),
        };
      }
      continue;
    }

    const quantidade = toFiniteNullable(item.quantidade_atual);
    if (quantidade !== null) {
      if (!menorPorQuantidade || quantidade < menorPorQuantidade.quantidadeNumero) {
        menorPorQuantidade = {
          ...item,
          nivelNumero: Number.NaN,
          quantidadeNumero: quantidade,
        };
      }
    }
  }

  if (menor) return menor;
  if (menorPorQuantidade) return menorPorQuantidade;
  if (suprimentos.length) {
    return {
      ...suprimentos[0],
      nivelNumero: Number.NaN,
      quantidadeNumero: toFiniteNullable(suprimentos[0].quantidade_atual),
    };
  }
  return null;
}

function classePillStatus(status: string) {
  const s = String(status || "unknown").toLowerCase();
  if (s === "online") return "ok";
  if (s === "offline" || s === "error" || s === "nao_operacional") return "danger";
  return "warn";
}

function formatarDataHora(value: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(dt);
}

function minutosDesdeColeta(value: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
}

function formatarTempoRelativoColeta(value: string | null) {
  const minutos = minutosDesdeColeta(value);
  if (minutos === null) return "sem coleta";
  if (minutos < 1) return "agora";
  if (minutos < 60) return `ha ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `ha ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `ha ${dias} d`;
}

function classeAtualizacaoColeta(value: string | null) {
  const minutos = minutosDesdeColeta(value);
  if (minutos === null) return "danger";
  if (minutos >= COLETA_STALE_CRITICO_MINUTOS) return "danger";
  if (minutos >= COLETA_STALE_WARN_MINUTOS) return "warn";
  return "ok";
}

function obterValorOrdenacao(row: ImpressoraVisao, coluna: ColunaOrdenacao): string | number {
  switch (coluna) {
    case "operacional":
      return row.operacional ? 1 : 0;
    case "contador_paginas_atual":
      return row.contador_paginas_atual ?? -1;
    case "menor_nivel_suprimento":
      return row.menor_nivel_suprimento ?? -1;
    case "ultima_coleta_em":
      return row.ultima_coleta_em ? new Date(row.ultima_coleta_em).getTime() : 0;
    default: {
      const value = row[coluna];
      return String(value ?? "").toLowerCase();
    }
  }
}

export default function ImpressorasPage() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [registros, setRegistros] = useState<ImpressoraVisao[]>([]);
  const [naoOperacionaisCarregados, setNaoOperacionaisCarregados] = useState(false);

  const [filtroOperacional, setFiltroOperacional] = useState<FiltroOperacional>("todos");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>("todos");
  const [busca, setBusca] = useState("");
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [filtroSuprimento, setFiltroSuprimento] = useState("");
  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacao>("setor");
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>("asc");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [linhasPorPagina, setLinhasPorPagina] = useState(50);

  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [modoAdicionar, setModoAdicionar] = useState<"inventario" | "manual">("inventario");

  const [categorias, setCategorias] = useState<CategoriaInventario[]>([]);
  const [categoriaSelecionadaId, setCategoriaSelecionadaId] = useState("");
  const [linhasCategoria, setLinhasCategoria] = useState<LinhaInventario[]>([]);
  const [linhaSelecionadaId, setLinhaSelecionadaId] = useState("");
  const [linhaSelecionadaValores, setLinhaSelecionadaValores] = useState<LinhaValorDef[]>([]);

  const [manual, setManual] = useState({
    patrimonio: "",
    ip: "",
    setor: "",
    localizacao: "",
    modelo: "",
    fabricante: "",
    numero_serie: "",
    hostname: "",
    endereco_mac: "",
    ativo: true
  });

  function valorParaTexto(valor: LinhaValorDef["valor"]) {
    if (!valor) return "";
    if (valor.valor_texto != null) return String(valor.valor_texto);
    if (valor.valor_numero != null) return String(valor.valor_numero);
    if (valor.valor_booleano != null) return valor.valor_booleano ? "Sim" : "Nao";
    if (valor.valor_data != null) return String(valor.valor_data);
    if (valor.valor_ip != null) return String(valor.valor_ip).replace(/\/32$/, "");
    if (valor.valor_json != null) return JSON.stringify(valor.valor_json);
    return "";
  }

  const carregar = useCallback(async (incluirNaoOperacionais = false) => {
    setLoading(true);
    setErro(null);
    setSucesso(null);

    try {
      const dados = await invokePrintFunction<ImpressoraVisao[]>("visao_geral", {
        incluir_nao_operacionais: incluirNaoOperacionais,
      });

      const total = dados.length;
      const operacionais = dados.filter((item) => item.operacional).length;
      const naoOperacionais = total - operacionais;
      setRegistros(dados);
      setNaoOperacionaisCarregados(incluirNaoOperacionais);
      if (incluirNaoOperacionais) {
        setSucesso(
          `Impressoras carregadas: ${total} | Operacionais: ${operacionais} | Nao operacionais: ${naoOperacionais}`
        );
      } else {
        setSucesso(
          `Impressoras operacionais carregadas: ${operacionais} | Nao operacionais: sob demanda`
        );
      }
    } catch {
      setErro("Falha de conexao ao carregar impressoras.");
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarCategorias = useCallback(async () => {
    try {
      const dados = await invokePrintFunction<CategoriaInventario[]>(
        "categorias_opcoes",
        { ativo: true },
        12000
      );

      const ativas = (dados || []).filter((item) => item.ativo);
      setCategorias(ativas);
      setCategoriaSelecionadaId((atual) => {
        if (atual && ativas.some((item) => item.id === atual)) return atual;
        const catImpressoras = ativas.find((item) => item.nome.toLowerCase().includes("impress"));
        return catImpressoras?.id ?? ativas[0]?.id ?? "";
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar categorias.");
    }
  }, []);

  const carregarLinhasCategoria = useCallback(async (categoriaId: string) => {
    if (!categoriaId) {
      setLinhasCategoria([]);
      setLinhaSelecionadaId("");
      setLinhaSelecionadaValores([]);
      return;
    }

    try {
      const dados = await invokePrintFunction<{ linhas: LinhaInventario[] }>(
        "categorias_linhas",
        { categoria_id: categoriaId, pagina: 1, limite: 400 }
      );

      const linhas = dados?.linhas ?? [];
      setLinhasCategoria(linhas);
      setLinhaSelecionadaId((atual) => (atual && linhas.some((item) => item.id === atual) ? atual : ""));
      setLinhaSelecionadaValores([]);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar linhas.");
    }
  }, []);

  const carregarValoresLinha = useCallback(async (linhaId: string) => {
    if (!linhaId) {
      setLinhaSelecionadaValores([]);
      return;
    }

    try {
      const dados = await invokePrintFunction<LinhaValorDef[]>("linha_valores", { linha_id: linhaId });
      setLinhaSelecionadaValores(dados || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar valores.");
    }
  }, []);

  const adicionarManual = useCallback(async () => {
    if (!manual.patrimonio || !manual.ip || !manual.modelo || !manual.setor) {
      setErro("Preencha patrimonio, ip, modelo e setor.");
      return;
    }

    setLoading(true);
    setErro(null);
    setSucesso(null);
    try {
      await invokePrintFunction<unknown>("add_impressora_manual", {
        patrimonio: manual.patrimonio.trim(),
        ip: manual.ip.trim(),
        setor: manual.setor.trim(),
        localizacao: manual.localizacao.trim() || null,
        modelo: manual.modelo.trim(),
        fabricante: manual.fabricante.trim() || null,
        numero_serie: manual.numero_serie.trim() || null,
        hostname: manual.hostname.trim() || null,
        endereco_mac: manual.endereco_mac.trim() || null,
        ativo: manual.ativo,
      });

      setSucesso("Impressora adicionada manualmente.");
      setModalAdicionarAberto(false);
      await carregar(naoOperacionaisCarregados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao adicionar impressora.");
    } finally {
      setLoading(false);
    }
  }, [carregar, manual, naoOperacionaisCarregados]);

  const tornarOperacionalPorLinha = useCallback(
    async (linhaId: string) => {
      setLoading(true);
      setErro(null);
      setSucesso(null);

      try {
        await invokePrintFunction<unknown>("tornar_operacional_linha", { linha_id: linhaId });

        setSucesso("Linha sincronizada com impressoras operacionais.");
        await carregar(naoOperacionaisCarregados);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Falha ao sincronizar com operacional.");
      } finally {
        setLoading(false);
      }
    },
    [carregar, naoOperacionaisCarregados]
  );

  const sincronizarOperacionais = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setSucesso(null);

    try {
      const body = await invokePrintFunction<any>("sincronizar_operacionais_lote", {});

      const total = body.total_sincronizadas || 0;
      const erros = body.total_erros || 0;

      if (total > 0) {
        setSucesso(
          `${total} impressora(s) sincronizada(s) com sucesso${erros > 0 ? `. ${erros} erro(s).` : "."}`
        );
        await carregar(naoOperacionaisCarregados);
      } else {
        setSucesso(body.mensagem || "Nenhuma impressora para sincronizar.");
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao sincronizar operacionais.");
    } finally {
      setLoading(false);
    }
  }, [carregar, naoOperacionaisCarregados]);

  const adicionarDoInventario = useCallback(async () => {
    if (!linhaSelecionadaId) {
      setErro("Selecione uma linha do inventario.");
      return;
    }

    await tornarOperacionalPorLinha(linhaSelecionadaId);
    setModalAdicionarAberto(false);
  }, [linhaSelecionadaId, tornarOperacionalPorLinha]);

  useEffect(() => {
    void carregar(false);
  }, [carregar]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBusca(buscaDigitada), BUSCA_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [buscaDigitada]);

  useEffect(() => {
    const precisaNaoOperacionais =
      filtroOperacional === "nao_operacional" || filtroRapido === "nao_operacional";

    if (!precisaNaoOperacionais || naoOperacionaisCarregados || loading) {
      return;
    }

    void carregar(true);
  }, [carregar, filtroOperacional, filtroRapido, naoOperacionaisCarregados, loading]);

  useEffect(() => {
    if (modalAdicionarAberto) {
      void carregarCategorias();
    }
  }, [carregarCategorias, modalAdicionarAberto]);

  useEffect(() => {
    if (modalAdicionarAberto) {
      void carregarLinhasCategoria(categoriaSelecionadaId);
    }
  }, [carregarLinhasCategoria, categoriaSelecionadaId, modalAdicionarAberto]);

  useEffect(() => {
    if (modalAdicionarAberto) {
      void carregarValoresLinha(linhaSelecionadaId);
    }
  }, [carregarValoresLinha, linhaSelecionadaId, modalAdicionarAberto]);

  const aplicarFiltroRapido = useCallback((filtro: FiltroRapido) => {
    setFiltroRapido(filtro);
    if (filtro === "online") {
      setFiltroOperacional("operacional");
      setFiltroStatus("online");
      return;
    }
    if (filtro === "offline") {
      setFiltroOperacional("operacional");
      setFiltroStatus("offline");
      return;
    }
    if (filtro === "nao_operacional") {
      setFiltroOperacional("nao_operacional");
      setFiltroStatus("todos");
      return;
    }
    if (filtro === "todos") {
      setFiltroOperacional("todos");
      setFiltroStatus("todos");
    }
  }, []);

  const alternarOrdenacao = useCallback((coluna: ColunaOrdenacao) => {
    setColunaOrdenacao((anteriorColuna) => {
      if (anteriorColuna === coluna) {
        setDirecaoOrdenacao((dir) => (dir === "asc" ? "desc" : "asc"));
        return anteriorColuna;
      }
      setDirecaoOrdenacao("asc");
      return coluna;
    });
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltroOperacional("todos");
    setFiltroStatus("todos");
    setFiltroRapido("todos");
    setBuscaDigitada("");
    setBusca("");
    setFiltroSuprimento("");
    setPaginaAtual(1);
  }, []);

  const registrosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtroSup = filtroSuprimento.trim().toLowerCase();

    const filtrados = registros.filter((item) => {
      if (filtroOperacional === "operacional" && !item.operacional) return false;
      if (filtroOperacional === "nao_operacional" && item.operacional) return false;
      if (filtroStatus !== "todos" && String(item.status_atual).toLowerCase() !== filtroStatus) return false;

      if (filtroRapido === "sem_coleta" && !!item.ultima_coleta_em) return false;
      if (filtroRapido === "toner_baixo") {
        const nivel = item.menor_nivel_suprimento;
        if (nivel === null || nivel >= 20) return false;
      }
      if (filtroRapido === "toner_critico") {
        const nivel = item.menor_nivel_suprimento;
        if (nivel === null || nivel >= 10) return false;
      }

      if (filtroSup) {
        const encontrou = item.resumo_suprimentos.some((s) =>
          `${s.nome_suprimento} ${s.chave_suprimento}`.toLowerCase().includes(filtroSup)
        );
        if (!encontrou) return false;
      }

      if (!q) return true;
      const bag = [
        item.patrimonio,
        item.ip,
        item.modelo,
        item.setor ?? "",
        item.localizacao ?? "",
        item.hostname ?? "",
        item.numero_serie ?? "",
        item.fabricante ?? "",
        item.status_atual
      ]
        .join(" ")
        .toLowerCase();
      return bag.includes(q);
    });

    const mult = direcaoOrdenacao === "asc" ? 1 : -1;
    return filtrados.sort((a, b) => {
      const va = obterValorOrdenacao(a, colunaOrdenacao);
      const vb = obterValorOrdenacao(b, colunaOrdenacao);

      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
      return String(va).localeCompare(String(vb)) * mult;
    });
  }, [
    busca,
    filtroOperacional,
    filtroRapido,
    filtroStatus,
    filtroSuprimento,
    registros,
    colunaOrdenacao,
    direcaoOrdenacao
  ]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [
    filtroOperacional,
    filtroStatus,
    filtroRapido,
    busca,
    filtroSuprimento,
    colunaOrdenacao,
    direcaoOrdenacao,
    linhasPorPagina
  ]);

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(registrosFiltrados.length / linhasPorPagina)),
    [linhasPorPagina, registrosFiltrados.length]
  );

  useEffect(() => {
    if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas);
  }, [paginaAtual, totalPaginas]);

  const intervaloPaginacao = useMemo(() => {
    const inicio = (paginaAtual - 1) * linhasPorPagina;
    const fim = inicio + linhasPorPagina;
    return { inicio, fim };
  }, [linhasPorPagina, paginaAtual]);

  const registrosPaginados = useMemo(
    () => registrosFiltrados.slice(intervaloPaginacao.inicio, intervaloPaginacao.fim),
    [intervaloPaginacao.fim, intervaloPaginacao.inicio, registrosFiltrados]
  );

  const filtrosAtivos = useMemo(() => {
    let count = 0;
    if (filtroRapido !== "todos") count += 1;
    if (filtroOperacional !== "todos") count += 1;
    if (filtroStatus !== "todos") count += 1;
    if (filtroSuprimento.trim()) count += 1;
    if (busca.trim()) count += 1;
    return count;
  }, [busca, filtroOperacional, filtroRapido, filtroStatus, filtroSuprimento]);

  const inicioVisualPagina = registrosFiltrados.length ? intervaloPaginacao.inicio + 1 : 0;
  const fimVisualPagina = Math.min(intervaloPaginacao.fim, registrosFiltrados.length);

  const contagensRapidas = useMemo(() => {
    const todos = registros.length;
    const online = registros.filter((item) => item.operacional && item.status_atual === "online").length;
    const offline = registros.filter((item) => item.operacional && item.status_atual === "offline").length;
    const naoOperacional = registros.filter((item) => !item.operacional).length;
    const tonerBaixo = registros.filter(
      (item) =>
        item.operacional &&
        item.menor_nivel_suprimento !== null &&
        item.menor_nivel_suprimento < 20
    ).length;
    const tonerCritico = registros.filter(
      (item) =>
        item.operacional &&
        item.menor_nivel_suprimento !== null &&
        item.menor_nivel_suprimento < 10
    ).length;
    const semColeta = registros.filter((item) => !item.ultima_coleta_em).length;

    return {
      todos,
      online,
      offline,
      nao_operacional: naoOperacional,
      toner_baixo: tonerBaixo,
      toner_critico: tonerCritico,
      sem_coleta: semColeta
    };
  }, [registros]);

  const filtrosRapidos = useMemo<QuickFilterItem[]>(
    () => [
      { key: "todos", label: "Todos", count: contagensRapidas.todos, tone: "neutral" },
      { key: "online", label: "Online", count: contagensRapidas.online, tone: "online" },
      { key: "offline", label: "Offline", count: contagensRapidas.offline, tone: "offline" },
      {
        key: "nao_operacional",
        label: "Nao operacional",
        count: contagensRapidas.nao_operacional,
        tone: "offline"
      },
      { key: "toner_baixo", label: "Toner baixo", count: contagensRapidas.toner_baixo, tone: "warn" },
      {
        key: "toner_critico",
        label: "Toner critico",
        count: contagensRapidas.toner_critico,
        tone: "danger"
      },
      { key: "sem_coleta", label: "Sem coleta", count: contagensRapidas.sem_coleta, tone: "neutral" }
    ],
    [contagensRapidas]
  );

  const opcoesSuprimentos = useMemo(() => {
    const bag = new Set<string>();
    for (const row of registros) {
      for (const sup of row.resumo_suprimentos) {
        const label = sup.nome_suprimento?.trim();
        if (label) bag.add(label);
      }
    }
    return Array.from(bag).sort((a, b) => a.localeCompare(b));
  }, [registros]);

  const cardsPainel = useMemo(
    () => [
      { key: "todos" as FiltroRapido, titulo: "Total", valor: contagensRapidas.todos, tone: "neutral" as const },
      { key: "online" as FiltroRapido, titulo: "Online", valor: contagensRapidas.online, tone: "online" as const },
      { key: "offline" as FiltroRapido, titulo: "Offline", valor: contagensRapidas.offline, tone: "offline" as const },
      {
        key: "nao_operacional" as FiltroRapido,
        titulo: "Nao operacional",
        valor: contagensRapidas.nao_operacional,
        tone: "offline" as const
      },
      { key: "toner_baixo" as FiltroRapido, titulo: "Toner baixo", valor: contagensRapidas.toner_baixo, tone: "warn" as const },
      {
        key: "toner_critico" as FiltroRapido,
        titulo: "Toner critico",
        valor: contagensRapidas.toner_critico,
        tone: "danger" as const
      }
    ],
    [contagensRapidas]
  );

  return (
    <BasicPageShell
      title="Impressoras Operacionais"
      subtitle="Visao unica com operacionais e nao operacionais, filtros e acao direta de ativacao."
      actions={
        <div className="ui-row">
          <button
            className="ui-btn ui-btn-warning"
            onClick={() => void sincronizarOperacionais()}
            disabled={loading}
          >
            {loading ? "Sincronizando..." : "Sincronizar Operacionais"}
          </button>
          <button
            className="ui-btn ui-btn-primary"
            onClick={() =>
              void carregar(
                naoOperacionaisCarregados ||
                  filtroOperacional === "nao_operacional" ||
                  filtroRapido === "nao_operacional"
              )
            }
          >
            Atualizar lista
          </button>
        </div>
      }
    >
      <StatusFeedback loading={loading} error={erro} success={sucesso} />

      <section className="ui-card" style={{ padding: 0 }}>
        <div className="ui-table-wrap impressoras-table-wrap" style={{ border: 0, borderRadius: 14 }}>
          <div className="ui-table-toolbar">
            <div className="ui-kpi-grid">
              {cardsPainel.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={`ui-kpi-btn tone-${card.tone}${filtroRapido === card.key ? " active" : ""}`}
                  onClick={() => aplicarFiltroRapido(card.key)}
                >
                  <span className="ui-kpi-title">{card.titulo}</span>
                  <strong className="ui-kpi-value">{card.valor}</strong>
                </button>
              ))}
            </div>

            <div className="ui-grid-4">
              <label>
                <span className="ui-kv">Operacional</span>
                <select
                  className="ui-select"
                  value={filtroOperacional}
                  onChange={(e) => {
                    setFiltroRapido("todos");
                    setFiltroOperacional(e.target.value as FiltroOperacional);
                  }}
                >
                  <option value="todos">Todos</option>
                  <option value="operacional">Somente operacional</option>
                  <option value="nao_operacional">Somente nao operacional</option>
                </select>
              </label>
              <label>
                <span className="ui-kv">Status</span>
                <select className="ui-select" value={filtroStatus} onChange={(e) => {
                  setFiltroRapido("todos");
                  setFiltroStatus(e.target.value as FiltroStatus);
                }}>
                  <option value="todos">Todos</option>
                  <option value="online">online</option>
                  <option value="offline">offline</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                  <option value="unknown">unknown</option>
                  <option value="nao_operacional">nao_operacional</option>
                </select>
              </label>
              <label>
                <span className="ui-kv">Suprimento</span>
                <select
                  className="ui-select"
                  value={filtroSuprimento}
                  onChange={(e) => setFiltroSuprimento(e.target.value)}
                >
                  <option value="">Todos</option>
                  {opcoesSuprimentos.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="ui-kv">Busca</span>
                <input
                  className="ui-field"
                  value={buscaDigitada}
                  onChange={(e) => {
                    setFiltroRapido("todos");
                    setBuscaDigitada(e.target.value);
                  }}
                  placeholder="Patrimonio, IP, modelo, setor..."
                />
              </label>
            </div>

            <div className="ui-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="ui-kv" style={{ margin: 0 }}>
                Filtros ativos: <strong>{filtrosAtivos}</strong>
                {buscaDigitada.trim() ? " | buscando..." : ""}
              </span>
              <div className="ui-row">
                <label>
                  <span className="ui-kv">Linhas por pagina</span>
                  <select
                    className="ui-select"
                    value={linhasPorPagina}
                    onChange={(e) => setLinhasPorPagina(Number(e.target.value))}
                    style={{ minWidth: 120 }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <button className="ui-btn" onClick={limparFiltros} disabled={filtrosAtivos === 0}>
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>

          <table className="ui-table impressoras-table">
            <thead>
              <tr>
                <th className="sticky-col sticky-acoes">Acoes</th>
                <th className="sticky-col sticky-operacional">
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("operacional")}>
                    Operacional <span>{colunaOrdenacao === "operacional" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th className="sticky-col sticky-patrimonio">
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("patrimonio")}>
                    Patrimonio <span>{colunaOrdenacao === "patrimonio" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th className="sticky-col sticky-ip">
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("ip")}>
                    IP <span>{colunaOrdenacao === "ip" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("modelo")}>
                    Modelo <span>{colunaOrdenacao === "modelo" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("setor")}>
                    Setor <span>{colunaOrdenacao === "setor" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("localizacao")}>
                    Localizacao <span>{colunaOrdenacao === "localizacao" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("status_atual")}>
                    Status <span>{colunaOrdenacao === "status_atual" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("ultima_coleta_em")}>
                    Ultima coleta <span>{colunaOrdenacao === "ultima_coleta_em" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("contador_paginas_atual")}>
                    Total paginas <span>{colunaOrdenacao === "contador_paginas_atual" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>
                  <button className="ui-th-btn" onClick={() => alternarOrdenacao("menor_nivel_suprimento")}>
                    Menor suprimento <span>{colunaOrdenacao === "menor_nivel_suprimento" ? (direcaoOrdenacao === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
                <th>Classificacao</th>
                <th>Suprimentos agrupados</th>
              </tr>
            </thead>
            <tbody>
              {registrosPaginados.map((row) => {
                const classif = classificarSuprimentos(row.menor_nivel_suprimento, row.resumo_suprimentos);
                const menorSup = obterMenorSuprimentoInfo(row.resumo_suprimentos);
                const linhaCritica =
                  classif === "critico" ||
                  (row.menor_nivel_suprimento !== null && row.menor_nivel_suprimento <= 10);

                const classesLinha = [
                  "impressoras-row",
                  linhaCritica ? "row-critical" : ""
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <tr key={row.id} className={classesLinha}>
                    <td className="sticky-col sticky-acoes">
                      {!row.operacional && row.origem_linha_id ? (
                        <button
                          className="ui-btn ui-btn-sm ui-btn-warning"
                          onClick={() => void tornarOperacionalPorLinha(row.origem_linha_id as string)}
                        >
                          Tornar operacional
                        </button>
                      ) : (
                        <span className="ui-kv" style={{ margin: 0 }}>
                          -
                        </span>
                      )}
                    </td>
                    <td className="sticky-col sticky-operacional">
                      <span className={`ui-pill ${row.operacional ? "ok" : "warn"}`}>
                        {row.operacional ? "operacional" : "nao operacional"}
                      </span>
                    </td>
                    <td className="sticky-col sticky-patrimonio">{row.patrimonio || "-"}</td>
                    <td className="sticky-col sticky-ip">{row.ip || "-"}</td>
                    <td>{row.modelo || "-"}</td>
                    <td>{row.setor || "-"}</td>
                    <td>{row.localizacao || "-"}</td>
                    <td>
                      <span className={`ui-pill ${classePillStatus(row.status_atual)}`}>{row.status_atual}</span>
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: 3 }}>
                        <span>{formatarDataHora(row.ultima_coleta_em)}</span>
                        <span className={`ui-pill ${classeAtualizacaoColeta(row.ultima_coleta_em)}`}>
                          {formatarTempoRelativoColeta(row.ultima_coleta_em)}
                        </span>
                      </div>
                    </td>
                    <td>{row.contador_paginas_atual ?? "-"}</td>
                    <td>
                      {menorSup ? (
                        <div style={{ display: "grid", gap: 3 }}>
                          <span className={`ui-pill ${classeNivelSuprimento(menorSup.nivelNumero)}`}>
                            {formatarIndicadorSuprimento(
                              Number.isFinite(menorSup.nivelNumero) ? menorSup.nivelNumero : null
                            )}
                          </span>
                          <span className="ui-kv" style={{ margin: 0 }}>
                            {menorSup.nome_suprimento}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span
                        className={`ui-pill ${
                          classif === "ok"
                            ? "ok"
                            : classif === "baixo"
                              ? "warn"
                              : "danger"
                        }`}
                      >
                        {classif}
                      </span>
                    </td>
                    <td>
                      {row.operacional ? (
                        <SuprimentosLista
                          suprimentos={row.resumo_suprimentos}
                          filtroNome={filtroSuprimento}
                        />
                      ) : (
                        <span className="ui-kv" style={{ margin: 0 }}>
                          Sem snapshot operacional
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loading && registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={13}>Nenhuma impressora encontrada para os filtros atuais.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {!loading ? (
            <div className="ui-table-pagination">
              <span className="ui-kv" style={{ margin: 0 }}>
                Mostrando <strong>{inicioVisualPagina}</strong>-<strong>{fimVisualPagina}</strong> de{" "}
                <strong>{registrosFiltrados.length}</strong>
              </span>
              <div className="ui-row">
                <button
                  className="ui-btn"
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual <= 1}
                >
                  Anterior
                </button>
                <span className="ui-kv" style={{ margin: 0 }}>
                  Pagina <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
                </span>
                <button
                  className="ui-btn"
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual >= totalPaginas}
                >
                  Proxima
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

    </BasicPageShell>
  );
}
