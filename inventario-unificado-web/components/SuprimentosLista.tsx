/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\SuprimentosLista.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
type SuprimentoItem = {
  chave_suprimento: string;
  nome_suprimento: string;
  nivel_percentual: number | null;
  quantidade_atual: number | null;
  status_suprimento: string;
};

type SuprimentosListaProps = {
  suprimentos: SuprimentoItem[];
  filtroNome?: string;
};

/**
 * [DOC-FUNC] normalizarNivel
 * O que faz: Normaliza entradas na funcao 'normalizarNivel', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizarNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/**
 * [DOC-FUNC] resolverNivel
 * O que faz: Monta estrutura/payload na funcao 'resolverNivel', consolidando dados para a proxima camada.
 * Entradas: Parametros esperados: item; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna estrutura consolidada pronta para API, servico, banco ou interface.
 */
function resolverNivel(item: SuprimentoItem) {
  const nivel = normalizarNivel(item.nivel_percentual);
  if (nivel !== null) return nivel;

  const quantidade = normalizarNivel(item.quantidade_atual);
  return quantidade;
}

/**
 * [DOC-FUNC] formatNivel
 * O que faz: Normaliza entradas na funcao 'formatNivel', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function formatNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  const n = normalizarNivel(value);
  if (n === null) return "-";
  return `${Math.round(n)}%`;
}

/**
 * [DOC-FUNC] formatIndicador
 * O que faz: Normaliza entradas na funcao 'formatIndicador', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function formatIndicador(value: number | null) {
  const nivel = formatNivel(value);
  if (nivel !== "-") return nivel;
  return "-";
}

/**
 * [DOC-FUNC] tomPorNivel
 * O que faz: Executa a responsabilidade principal da funcao 'tomPorNivel' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function tomPorNivel(value: number | null) {
  const n = normalizarNivel(value);
  if (n === null) return "unknown";
  if (n <= 5) return "danger";
  if (n <= 15) return "warn";
  return "ok";
}

/**
 * [DOC-FUNC] statusPorNivel
 * O que faz: Executa a responsabilidade principal da funcao 'statusPorNivel' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: value; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function statusPorNivel(value: number | null) {
  const n = normalizarNivel(value);
  if (n === null) return "indefinido";
  if (n <= 5) return "critico";
  if (n <= 15) return "baixo";
  return "bom";
}

/**
 * [DOC-FUNC] classePillPorStatus
 * O que faz: Executa a responsabilidade principal da funcao 'classePillPorStatus' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: status; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
function classePillPorStatus(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (["critico", "critical", "empty", "offline"].includes(s)) return "danger";
  if (["baixo", "low", "warning"].includes(s)) return "warn";
  return "ok";
}

/**
 * [DOC-FUNC] SuprimentosLista
 * O que faz: Executa a responsabilidade principal da funcao 'SuprimentosLista' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: { suprimentos, filtroNome }; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
export function SuprimentosLista({ suprimentos, filtroNome }: SuprimentosListaProps) {
  const filtro = String(filtroNome ?? "")
    .trim()
    .toLowerCase();

  const itens = filtro
    ? suprimentos.filter((item) => {
        const bag = `${item.nome_suprimento} ${item.chave_suprimento}`.toLowerCase();
        return bag.includes(filtro);
      })
    : suprimentos;

  if (!itens.length) return <span>-</span>;

  return (
    <div className="ui-supply-list">
      {itens.map((s) => {
        const nivel = resolverNivel(s);
        const largura = nivel === null ? 8 : Math.max(4, Math.round(nivel));
        const tom = tomPorNivel(nivel);
        const statusExibicao = statusPorNivel(nivel);

        return (
          <div className="ui-supply-item" key={`${s.chave_suprimento}-${s.nome_suprimento}`}>
            <span className="ui-supply-name" title={s.nome_suprimento}>
              {s.nome_suprimento}
            </span>
            <div
              className="ui-supply-track"
              role="img"
              aria-label={`${s.nome_suprimento}: ${formatIndicador(nivel)}`}
            >
              <span className={`ui-supply-fill tone-${tom}`} style={{ width: `${largura}%` }} />
            </div>
            <span className="ui-supply-value">{formatIndicador(nivel)}</span>
            <span className={`ui-pill ${classePillPorStatus(statusExibicao)}`}>
              {statusExibicao}
            </span>
          </div>
        );
      })}
    </div>
  );
}

