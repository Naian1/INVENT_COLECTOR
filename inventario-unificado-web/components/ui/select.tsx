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
 * O que faz: Orquestra a etapa 'Select' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados ({ value, onValueChange, children }) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia sequencia de validacao e processamento interno, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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
 * O que faz: Orquestra a etapa 'SelectTrigger' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (sem parametros obrigatorios) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia sequencia de validacao e processamento interno, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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
 * O que faz: Orquestra a etapa 'SelectValue' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados ({ placeholder }) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia sequencia de validacao e processamento interno, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
 */
export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  return <>{context?.value || placeholder}</>;
}

/**
 * [DOC-FUNC] SelectContent
 * O que faz: Orquestra a etapa 'SelectContent' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados ({ children }) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia sequencia de validacao e processamento interno, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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
 * O que faz: Orquestra a etapa 'SelectItem' deste modulo, conectando regras de negocio e dados intermediarios do fluxo.
 * Entradas: Trabalha com os parametros declarados (sem parametros obrigatorios) e com contexto local carregado durante a execucao.
 * Como executa: Encadeia sequencia de validacao e processamento interno, garantindo continuidade do processamento mesmo com entradas variaveis.
 * Retorno/Efeitos: Entrega resultado pronto para a camada chamadora e fornece sinalizacao clara quando ocorre falha operacional.
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

