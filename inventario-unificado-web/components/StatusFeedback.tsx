/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\StatusFeedback.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { useEffect, useRef, useState } from "react";

type StatusFeedbackProps = {
  loading?: boolean;
  error?: string | null;
  success?: string | null;
};

type ToastItem = {
  id: number;
  kind: "error" | "success";
  message: string;
};

/**
 * [DOC-FUNC] normalizarMensagemToast
 * O que faz: A funcao 'normalizarMensagemToast' padroniza dados de entrada para evitar ambiguidade. Ela limpa formato, converte tipos e devolve valores consistentes para comparacao, armazenamento ou exibicao.
 * Entradas: Recebe os parametros: input. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
function normalizarMensagemToast(input: string): string {
  const mensagem = String(input || "").trim();
  if (!mensagem) return "Operação finalizada.";
  return mensagem.replace(/^Falha ao executar inventory-core:\s*/i, "").trim() || mensagem;
}

/**
 * [DOC-FUNC] StatusFeedback
 * O que faz: A funcao 'StatusFeedback' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: { loading, error, success }. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) trata erros de forma explicita para facilitar diagnostico e operacao.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export function StatusFeedback({ loading, error, success }: StatusFeedbackProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(1);
  const prevErrorRef = useRef<string | null>(null);
  const prevSuccessRef = useRef<string | null>(null);

  /**
   * [DOC-FUNC] removerToast
   * O que faz: A funcao 'removerToast' remove ou inativa registros conforme as regras do sistema. O foco e preservar integridade e rastreabilidade durante a operacao.
   * Entradas: Recebe os parametros: id. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const removerToast = (id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  };

  useEffect(() => {
    if (!error || error === prevErrorRef.current) {
      prevErrorRef.current = error ?? null;
      return;
    }

    const id = nextToastIdRef.current++;
    setToasts((current) => {
      const next = [...current, { id, kind: "error" as const, message: normalizarMensagemToast(error) }];
      return next.slice(-4);
    });

    const timeout = window.setTimeout(() => {
      removerToast(id);
    }, 4600);

    prevErrorRef.current = error;

    return () => {
      window.clearTimeout(timeout);
    };
  }, [error]);

  useEffect(() => {
    if (!success || success === prevSuccessRef.current) {
      prevSuccessRef.current = success ?? null;
      return;
    }

    const id = nextToastIdRef.current++;
    setToasts((current) => {
      const next = [...current, { id, kind: "success" as const, message: normalizarMensagemToast(success) }];
      return next.slice(-4);
    });

    const timeout = window.setTimeout(() => {
      removerToast(id);
    }, 2800);

    prevSuccessRef.current = success;

    return () => {
      window.clearTimeout(timeout);
    };
  }, [success]);

  return (
    <>
      {loading ? (
        <div style={{ marginBottom: 12 }}>
          <div className="ui-loading-bar" aria-live="polite" aria-busy="true">
            <div className="ui-loading-bar-track">
              <div className="ui-loading-bar-fill" />
            </div>
          </div>
        </div>
      ) : null}

      {toasts.length ? (
        <div className="ui-toast-stack">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`ui-toast-card ${toast.kind === "error" ? "error" : "success"}`}
              role={toast.kind === "error" ? "alert" : "status"}
              aria-live={toast.kind === "error" ? "assertive" : "polite"}
            >
              <div className="ui-toast-header">
                <strong>{toast.kind === "error" ? "Erro" : "Sucesso"}</strong>
                <button
                  type="button"
                  className="ui-toast-close"
                  onClick={() => removerToast(toast.id)}
                  aria-label="Fechar notificação"
                >
                  x
                </button>
              </div>
              <p className="ui-toast-message">{toast.message}</p>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

