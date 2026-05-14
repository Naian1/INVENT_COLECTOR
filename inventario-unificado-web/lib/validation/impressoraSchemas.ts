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
 * O que faz: A funcao 'textoObrigatorio' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: campo. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
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

