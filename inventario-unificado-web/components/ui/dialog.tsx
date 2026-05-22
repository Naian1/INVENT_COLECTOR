/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\ui\dialog.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import React, { ReactNode, useEffect } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * [DOC-FUNC] Dialog
 * O que faz: renderiza um modal centralizado somente quando `open` for verdadeiro.
 * Entradas: `open` controla se o modal aparece, `onOpenChange` avisa a tela pai quando deve fechar
 * e `children` carrega o conteudo real do modal.
 * Como executa: quando abre, registra um listener de teclado para fechar com ESC; renderiza um
 * fundo escuro clicavel e um painel central; o clique dentro do painel usa `stopPropagation` para
 * nao fechar o modal sem querer.
 * Retorno/Efeitos: retorna `null` quando fechado; quando aberto, cria a camada visual do modal e
 * remove o listener de teclado automaticamente ao desmontar.
 */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;

    /**
     * [DOC-FUNC] handleKeyDown
     * O que faz: escuta teclas pressionadas enquanto o modal esta aberto.
     * Entradas: recebe o evento nativo do teclado disparado pelo navegador.
     * Como executa: se a tecla for ESC, cancela o comportamento padrao e chama `onOpenChange(false)`.
     * Retorno/Efeitos: nao retorna dados; apenas fecha o modal de forma previsivel para o usuario.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div
        className="ui-dialog-backdrop"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="ui-dialog-shell"
      >
        <div
          className="ui-dialog-panel"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * [DOC-FUNC] DialogContent
 * O que faz: mantem compatibilidade com o padrao de composicao de modais.
 * Entradas: recebe `children` e aceita `className`, mesmo que hoje o componente nao use a classe.
 * Como executa: devolve os filhos em um `div` simples; a estrutura visual fica no componente `Dialog`.
 * Retorno/Efeitos: nao altera estado, apenas organiza o JSX da tela chamadora.
 */
export function DialogContent({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div>{children}</div>;
}

/**
 * [DOC-FUNC] DialogHeader
 * O que faz: cria o cabecalho padrao do modal, separando titulo/descricao do corpo.
 * Entradas: recebe qualquer conteudo React como `children`.
 * Como executa: aplica padding, borda inferior e fundo suave por CSS global.
 * Retorno/Efeitos: padroniza visualmente todos os modais que usam este componente.
 */
export function DialogHeader({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="ui-dialog-header">
      {children}
    </div>
  );
}

/**
 * [DOC-FUNC] DialogTitle
 * O que faz: renderiza o titulo principal do modal com hierarquia visual consistente.
 * Entradas: recebe o texto ou JSX do titulo.
 * Como executa: usa uma classe global para manter margem zerada, tamanho e cor padronizados.
 * Retorno/Efeitos: melhora leitura e acessibilidade visual do modal.
 */
export function DialogTitle({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className="ui-dialog-title">{children}</h2>;
}

/**
 * [DOC-FUNC] DialogDescription
 * O que faz: exibe um texto auxiliar abaixo do titulo do modal.
 * Entradas: recebe a descricao em texto ou JSX.
 * Como executa: aplica margem superior pequena, cor secundaria e fonte menor.
 * Retorno/Efeitos: ajuda o usuario a entender o objetivo do modal antes de preencher os campos.
 */
export function DialogDescription({
  children,
  className: _className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className="ui-dialog-description">
      {children}
    </p>
  );
}
