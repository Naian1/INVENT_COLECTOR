export type Impressora = {
  id: string;
  patrimonio: string;
  ip: string;
  setor: string;
  localizacao: string | null;
  modelo: string;
  fabricante: string | null;
  numero_serie: string | null;
  hostname: string | null;
  endereco_mac: string | null;
  ativo: boolean;
  ultima_coleta_em: string | null;
  criado_em: string;
  atualizado_em: string;
  display_name_legacy: string | null;
};

export type CriarImpressoraInput = {
  patrimonio: string;
  ip: string;
  setor: string;
  localizacao?: string | null;
  modelo: string;
  fabricante?: string | null;
  numero_serie?: string | null;
  hostname?: string | null;
  endereco_mac?: string | null;
  ativo?: boolean;
  display_name_legacy?: string | null;
};

export type AtualizarImpressoraInput = Partial<CriarImpressoraInput>;

export type SuprimentoResumo = {
  chave_suprimento: string;
  nome_suprimento: string;
  nivel_percentual: number | null;
  status_suprimento: string;
};

export type ImpressoraVisaoGeral = {
  id: string;
  patrimonio: string;
  ip: string;
  setor: string;
  localizacao: string | null;
  modelo: string;
  fabricante: string | null;
  numero_serie: string | null;
  hostname: string | null;
  ativo: boolean;
  ultima_coleta_em: string | null;
  status_atual: string;
  contador_paginas_atual: number | null;
  menor_nivel_suprimento: number | null;
  resumo_suprimentos: SuprimentoResumo[];
  operacional: boolean;
  origem_linha_id: string | null;
  display_name_legacy: string | null;
};

export type TelemetriaImpressora = {
  ingestao_id: string;
  coletor_id: string;
  status: string;
  tempo_resposta_ms: number | null;
  coletado_em: string;
  payload_bruto: Record<string, unknown>;
};

export type LeituraPaginasImpressora = {
  ingestao_id: string;
  coletado_em: string;
  contador_total_paginas: number;
  valido: boolean;
  motivo_invalido: string | null;
  reset_detectado: boolean;
};

export type SuprimentoImpressora = {
  ingestao_id: string;
  coletado_em: string;
  chave_suprimento: string;
  nome_suprimento: string;
  nivel_percentual: number | null;
  paginas_restantes: number | null;
  status_suprimento: string;
};

export type StatusSuprimentosImpressora = {
  impressora: ImpressoraVisaoGeral;
  status_atual: string;
  ultima_telemetria: TelemetriaImpressora | null;
  ultimo_contador_total_paginas: number | null;
  ultima_leitura_paginas: LeituraPaginasImpressora | null;
  ultimos_suprimentos: SuprimentoImpressora[];
  alertas_abertos: Record<string, unknown>[];
};

export type MetricasImpressora = {
  impressora_id: string;
  de: string;
  ate: string;
  total_paginas_impressas: number;
  quantidade_leituras: number;
  reset_detectado: boolean;
  dados_insuficientes: boolean;
};

export type ResumoDashboard = {
  gerado_em: string;
  total_impressoras: number;
  impressoras_ativas: number;
  impressoras_online: number;
  impressoras_offline: number;
  suprimentos_baixos_ou_criticos: number;
  paginas_impressas_mes_atual: number;
};

export type ResultadoIngestaoColetor = {
  coletor_id: string;
  eventos_recebidos: number;
  eventos_processados: number;
  gravacoes_telemetria: number;
  gravacoes_leituras_paginas: number;
  gravacoes_suprimentos: number;
  erros: Array<{ ingestao_id: string; erro: string }>;
};
