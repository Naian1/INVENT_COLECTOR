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
 * O que faz: Normaliza entradas na funcao 'normalizarNivel', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function normalizarNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/**
 * [DOC-FUNC] resolverNivel
 * O que faz: Monta a estrutura central na funcao 'resolverNivel', combinando dados brutos em payload coerente.
 * Entradas: Parametros esperados: item; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna estrutura consolidada (payload/objeto) pronta para API, banco, servico ou camada de UI.
 */
function resolverNivel(item: SuprimentoItem) {
  const nivel = normalizarNivel(item.nivel_percentual);
  if (nivel !== null) return nivel;

  const quantidade = normalizarNivel(item.quantidade_atual);
  return quantidade;
}

/**
 * [DOC-FUNC] formatNivel
 * O que faz: Normaliza entradas na funcao 'formatNivel', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function formatNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  const n = normalizarNivel(value);
  if (n === null) return "-";
  return `${Math.round(n)}%`;
}

/**
 * [DOC-FUNC] formatIndicador
 * O que faz: Normaliza entradas na funcao 'formatIndicador', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function formatIndicador(value: number | null) {
  const nivel = formatNivel(value);
  if (nivel !== "-") return nivel;
  return "-";
}

/**
 * [DOC-FUNC] tomPorNivel
 * O que faz: Executa a responsabilidade central da funcao 'tomPorNivel', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
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
 * O que faz: Executa a responsabilidade central da funcao 'statusPorNivel', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: value; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
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
 * O que faz: Normaliza entradas na funcao 'classePillPorStatus', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: status; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
 */
function classePillPorStatus(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (["critico", "critical", "empty", "offline"].includes(s)) return "danger";
  if (["baixo", "low", "warning"].includes(s)) return "warn";
  return "ok";
}

/**
 * [DOC-FUNC] SuprimentosLista
 * O que faz: Normaliza entradas na funcao 'SuprimentosLista', reduzindo variacoes de formato antes da regra principal.
 * Entradas: Parametros esperados: { suprimentos, filtroNome }; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Valida pre-condicoes e regras de negocio; padroniza campos para evitar divergencia de formato; itera listas/objetos para consolidar calculos e mapeamentos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao com menos ruido semantico.
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

