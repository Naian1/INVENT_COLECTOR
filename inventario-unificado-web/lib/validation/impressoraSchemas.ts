/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\lib\validation\impressoraSchemas.ts
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
import { z } from "zod";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

const termosInvalidos = new Set([
  "desconhecido",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "-",
  "sem setor"
]);

/**
 * [DOC-FUNC] textoObrigatorio
 * O que faz: Executa a rotina principal de 'texto obrigatorio' no contexto deste modulo.
 * Entradas: Parametros esperados: campo.
 * Como executa: Valida pre-condicoes, processa regras de negocio e trata excecoes do fluxo.
 * Retorno/Efeitos: Retorna resultado util para a camada chamadora (dados, status ou erro).
 */
const textoObrigatorio = (campo: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: `${campo} e obrigatorio` })
    .refine((value) => !termosInvalidos.has(value.toLowerCase()), {
      message: `${campo} invalido`
    });

const textoOpcionalNulo = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, { message: "Campo vazio" })
  .optional()
  .nullable();

export const criarImpressoraSchema = z.object({
  patrimonio: textoObrigatorio("patrimonio"),
  ip: z.string().trim().regex(ipv4Regex, "ip deve ser IPv4 valido"),
  setor: textoObrigatorio("setor"),
  localizacao: textoOpcionalNulo,
  modelo: textoObrigatorio("modelo"),
  fabricante: textoOpcionalNulo,
  numero_serie: textoOpcionalNulo,
  hostname: textoOpcionalNulo,
  endereco_mac: textoOpcionalNulo,
  ativo: z.boolean().optional(),
  display_name_legacy: textoOpcionalNulo
});

export const atualizarImpressoraSchema = criarImpressoraSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "Forneca ao menos um campo para atualizacao"
  }
);

