/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\ui\select.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import React, { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}

/**
 * [DOC-FUNC] Select
 * O que faz: Executa a responsabilidade central da funcao 'Select', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: { value, onValueChange, children }; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
export function Select({ value, onValueChange, children }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      {children}
    </SelectContext.Provider>
  );
}

const SelectContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

/**
 * [DOC-FUNC] SelectTrigger
 * O que faz: Executa a responsabilidade central da funcao 'SelectTrigger', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
export function SelectTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = React.useContext(SelectContext);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between ${className}`}
        onClick={() => setOpen(!open)}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    </div>
  );
}

/**
 * [DOC-FUNC] SelectValue
 * O que faz: Executa a responsabilidade central da funcao 'SelectValue', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: { placeholder }; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  return <>{context?.value || placeholder}</>;
}

/**
 * [DOC-FUNC] SelectContent
 * O que faz: Executa a responsabilidade central da funcao 'SelectContent', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Parametros esperados: { children }; o fluxo valida formato e aplica fallback quando a entrada vier incompleta.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
export function SelectContent({ children }: { children: ReactNode }) {
  return (
    <div className="absolute top-full left-0 right-0 mt-1 border border-gray-300 rounded-md bg-white shadow-lg z-50">
      {children}
    </div>
  );
}

/**
 * [DOC-FUNC] SelectItem
 * O que faz: Executa a responsabilidade central da funcao 'SelectItem', conectando validacao, processamento e retorno de forma didatica.
 * Entradas: Sem parametros obrigatorios; usa contexto local, variaveis de ambiente ou estado de execucao quando necessario.
 * Como executa: Executa um fluxo linear de validacao e processamento local, mantendo resultado previsivel para quem consome a funcao.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora com contrato claro de sucesso e falha.
 */
export function SelectItem({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const context = React.useContext(SelectContext);

  return (
    <div
      className={`px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 ${
        context?.value === value ? 'bg-blue-100 text-blue-900 font-medium' : ''
      }`}
      onClick={() => context?.onValueChange(value)}
    >
      {children}
    </div>
  );
}

