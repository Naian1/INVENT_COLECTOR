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
 * O que faz: Normaliza valores na funcao 'normalizarNivel', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function normalizarNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/**
 * [DOC-FUNC] resolverNivel
 * O que faz: Monta/comp?e estruturas na funcao 'resolverNivel', consolidando campos dispersos em um objeto util para o fluxo.
 * Entradas: Recebe parametros de origem (item) com dados parciais e metadados para composicao final.
 * Como executa: Seleciona campos relevantes, aplica regras de prioridade/fallback e organiza o resultado no formato esperado.
 * Retorno/Efeitos: Entrega payload consolidado para a proxima camada (API, servico, persistencia ou interface).
 */
function resolverNivel(item: SuprimentoItem) {
  const nivel = normalizarNivel(item.nivel_percentual);
  if (nivel !== null) return nivel;

  const quantidade = normalizarNivel(item.quantidade_atual);
  return quantidade;
}

/**
 * [DOC-FUNC] formatNivel
 * O que faz: Normaliza valores na funcao 'formatNivel', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function formatNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  const n = normalizarNivel(value);
  if (n === null) return "-";
  return `${Math.round(n)}%`;
}

/**
 * [DOC-FUNC] formatIndicador
 * O que faz: Normaliza valores na funcao 'formatIndicador', reduzindo variacoes de formato antes do processamento principal.
 * Entradas: Recebe dados possivelmente incompletos ou heterogeneos (value) e trata nulos, strings vazias e tipos mistos.
 * Como executa: Limpa ruido, converte tipos, aplica regras de padrao e define fallback para manter consistencia entre chamadas.
 * Retorno/Efeitos: Devolve dado padronizado para comparacao, persistencia e exibicao sem ambiguidade de formato.
 */
function formatIndicador(value: number | null) {
  const nivel = formatNivel(value);
  if (nivel !== "-") return nivel;
  return "-";
}

/**
 * [DOC-FUNC] tomPorNivel
 * O que faz: Orquestra a etapa 'tomPorNivel' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (value) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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
 * O que faz: Orquestra a etapa 'statusPorNivel' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (value) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, iteracao/transformacao de colecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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
 * O que faz: Orquestra a etapa 'classePillPorStatus' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (status) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, iteracao/transformacao de colecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
 */
function classePillPorStatus(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (["critico", "critical", "empty", "offline"].includes(s)) return "danger";
  if (["baixo", "low", "warning"].includes(s)) return "warn";
  return "ok";
}

/**
 * [DOC-FUNC] SuprimentosLista
 * O que faz: Orquestra a etapa 'SuprimentosLista' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados ({ suprimentos, filtroNome }) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia avaliacoes condicionais, iteracao/transformacao de colecoes, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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

