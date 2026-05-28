/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\AuthLoadingScreen.tsx
 * [DOC-CODEMAP] Papel: Tela visual reutilizavel para o estado de validacao de sessao.
 */
"use client";

import Image from "next/image";

/**
 * [DOC-FUNC] AuthLoadingScreen
 * Objetivo: exibir um carregamento profissional enquanto o sistema valida a sessao do usuario.
 * Entradas: nao recebe parametros; usa apenas os assets publicos da marca NTECH.
 * Como executa: renderiza um card central com logo, mensagem curta e spinner circular animado.
 * Retorno/Efeitos: retorna JSX visual; nao altera sessao, banco, API ou estado global.
 */
export function AuthLoadingScreen() {
  return (
    <div className="ui-auth-loading">
      <div className="ui-auth-loading-orb ui-auth-loading-orb-a" />
      <div className="ui-auth-loading-orb ui-auth-loading-orb-b" />
      <div className="ui-auth-loading-card" role="status" aria-live="polite">
        <div className="ui-auth-loading-brand">
          <Image
            src="/brand/ntech-black.png"
            alt="NTECH"
            width={156}
            height={34}
            className="ui-auth-loading-logo ui-auth-loading-logo-light"
            priority
          />
          <Image
            src="/brand/ntech-white.png"
            alt="NTECH"
            width={156}
            height={34}
            className="ui-auth-loading-logo ui-auth-loading-logo-dark"
            priority
          />
        </div>
        <div className="ui-auth-loading-copy">
          <h1>Validando sessão</h1>
          <p>Conferindo acesso e preparando o painel com segurança.</p>
        </div>
        <div className="ui-auth-loading-spinner" aria-hidden="true">
          <span />
          <strong />
        </div>
      </div>
    </div>
  );
}
