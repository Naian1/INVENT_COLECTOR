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
  onSelecionarNome?: (nome: string) => void;
};

/**
 * [DOC-FUNC] normalizarNivel
 * O que faz: A funcao 'normalizarNivel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/**
 * [DOC-FUNC] resolverNivel
 * O que faz: A funcao 'resolverNivel' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
 * Entradas: Recebe os parametros: item. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function resolverNivel(item: SuprimentoItem) {
  const nivel = normalizarNivel(item.nivel_percentual);
  if (nivel !== null) return nivel;

  const quantidade = normalizarNivel(item.quantidade_atual);
  return quantidade;
}

/**
 * [DOC-FUNC] formatNivel
 * O que faz: A funcao 'formatNivel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  const n = normalizarNivel(value);
  if (n === null) return "-";
  return `${Math.round(n)}%`;
}

/**
 * [DOC-FUNC] formatIndicador
 * O que faz: A funcao 'formatIndicador' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function formatIndicador(value: number | null) {
  const nivel = formatNivel(value);
  if (nivel !== "-") return nivel;
  return "-";
}

/**
 * [DOC-FUNC] tomPorNivel
 * O que faz: A funcao 'tomPorNivel' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'statusPorNivel' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: value. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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
 * O que faz: A funcao 'classePillPorStatus' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: status. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function classePillPorStatus(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (["critico", "critical", "empty", "offline"].includes(s)) return "danger";
  if (["baixo", "low", "warning"].includes(s)) return "warn";
  return "ok";
}

/**
 * [DOC-FUNC] SuprimentosLista
 * O que faz: A funcao 'SuprimentosLista' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: { suprimentos, filtroNome }. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export function SuprimentosLista({ suprimentos, filtroNome, onSelecionarNome }: SuprimentosListaProps) {
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
            {onSelecionarNome ? (
              <button
                type="button"
                className="ui-supply-name-button"
                title={`Filtrar por ${s.nome_suprimento}`}
                onClick={() => onSelecionarNome(s.nome_suprimento)}
              >
                <span className="ui-supply-name">{s.nome_suprimento}</span>
              </button>
            ) : (
              <span className="ui-supply-name" title={s.nome_suprimento}>
                {s.nome_suprimento}
              </span>
            )}
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
