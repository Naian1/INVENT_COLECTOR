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
 * O que faz: Normaliza entradas na funcao 'normalizarMensagemToast', reduzindo ambiguidade antes da regra principal.
 * Entradas: Parametros esperados: input; com validacao de formato e fallback quando necessario.
 * Como executa: Valida condicoes e decide caminhos; padroniza formato e fallback de campos.
 * Retorno/Efeitos: Retorna valor padronizado para comparacao, persistencia e exibicao sem ruido de formato.
 */
function normalizarMensagemToast(input: string): string {
  const mensagem = String(input || "").trim();
  if (!mensagem) return "Operação finalizada.";
  return mensagem.replace(/^Falha ao executar inventory-core:\s*/i, "").trim() || mensagem;
}

/**
 * [DOC-FUNC] StatusFeedback
 * O que faz: Executa a responsabilidade principal da funcao 'StatusFeedback' com fluxo previsivel para estudo.
 * Entradas: Parametros esperados: { loading, error, success }; com validacao de formato e fallback quando necessario.
 * Como executa: Executa processamento local em sequencia previsivel.
 * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
 */
export function StatusFeedback({ loading, error, success }: StatusFeedbackProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(1);
  const prevErrorRef = useRef<string | null>(null);
  const prevSuccessRef = useRef<string | null>(null);

  /**
   * [DOC-FUNC] removerToast
   * O que faz: Executa a responsabilidade principal da funcao 'removerToast' com fluxo previsivel para estudo.
   * Entradas: Parametros esperados: id; com validacao de formato e fallback quando necessario.
   * Como executa: Valida condicoes e decide caminhos; itera colecoes para montar/filtrar dados.
   * Retorno/Efeitos: Retorna resultado util com contrato claro de sucesso/falha para quem consome.
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

