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
 * O que faz: Padroniza dados de 'normalizar nivel' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: value.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizarNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/**
 * [DOC-FUNC] resolverNivel
 * O que faz: Monta estrutura de 'resolver nivel' a partir de dados intermediarios do modulo.
 * Entradas: Parametros esperados: item.
 * Como executa: Combina campos, aplica prioridade de regras e prepara payload final.
 * Retorno/Efeitos: Retorna estrutura consolidada para a proxima etapa do processo.
 */
function resolverNivel(item: SuprimentoItem) {
  const nivel = normalizarNivel(item.nivel_percentual);
  if (nivel !== null) return nivel;

  const quantidade = normalizarNivel(item.quantidade_atual);
  return quantidade;
}

/**
 * [DOC-FUNC] formatNivel
 * O que faz: Padroniza dados de 'format nivel' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: value.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function formatNivel(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  const n = normalizarNivel(value);
  if (n === null) return "-";
  return `${Math.round(n)}%`;
}

/**
 * [DOC-FUNC] formatIndicador
 * O que faz: Padroniza dados de 'format indicador' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: value.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function formatIndicador(value: number | null) {
  const nivel = formatNivel(value);
  if (nivel !== "-") return nivel;
  return "-";
}

/**
 * [DOC-FUNC] tomPorNivel
 * O que faz: Executa a rotina principal de 'tom por nivel' no contexto deste modulo.
 * Entradas: Parametros esperados: value.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * O que faz: Executa a rotina principal de 'status por nivel' no contexto deste modulo.
 * Entradas: Parametros esperados: value.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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
 * O que faz: Executa a rotina principal de 'classe pill por status' no contexto deste modulo.
 * Entradas: Parametros esperados: status.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
function classePillPorStatus(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (["critico", "critical", "empty", "offline"].includes(s)) return "danger";
  if (["baixo", "low", "warning"].includes(s)) return "warn";
  return "ok";
}

/**
 * [DOC-FUNC] SuprimentosLista
 * O que faz: Executa a rotina principal de 'suprimentos lista' no contexto deste modulo.
 * Entradas: Recebe parametros compostos/estruturados conforme assinatura da funcao.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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

