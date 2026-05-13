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
 * O que faz: Padroniza dados de 'normalizar mensagem toast' para formato previsivel no restante do fluxo.
 * Entradas: Parametros esperados: input.
 * Como executa: Converte tipos, remove ruido e aplica fallback para valores invalidos.
 * Retorno/Efeitos: Retorna valor saneado pronto para comparacao, armazenamento ou exibicao.
 */
function normalizarMensagemToast(input: string): string {
  const mensagem = String(input || "").trim();
  if (!mensagem) return "Operação finalizada.";
  return mensagem.replace(/^Falha ao executar inventory-core:\s*/i, "").trim() || mensagem;
}

/**
 * [DOC-FUNC] StatusFeedback
 * O que faz: Executa a rotina principal de 'status feedback' no contexto deste modulo.
 * Entradas: Recebe parametros compostos/estruturados conforme assinatura da funcao.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
export function StatusFeedback({ loading, error, success }: StatusFeedbackProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(1);
  const prevErrorRef = useRef<string | null>(null);
  const prevSuccessRef = useRef<string | null>(null);

  /**
   * [DOC-FUNC] removerToast
   * O que faz: Executa a rotina principal de 'remover toast' no contexto deste modulo.
   * Entradas: Parametros esperados: id.
   * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
   * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
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

