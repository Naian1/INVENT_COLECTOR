# 21 - Estrutura de Pastas e Organizacao de CSS

Este documento explica a estrutura do repositorio e orienta como manter o frontend mais limpo, principalmente em relacao a CSS inline, `globals.css` e classes reutilizaveis.

Para uma lista arquivo por arquivo, use tambem:

```text
docs/22-mapa-completo-arquivos.md
```

Esse outro documento e o catalogo completo dos arquivos versionados: ele agrupa por pasta e descreve individualmente o papel de cada arquivo.

## 1. Visao Geral do Repositorio

O projeto e dividido em tres blocos grandes:

```text
INVENT_COLECTOR/
├─ inventario-unificado-web/   Sistema web Next.js, Edge Functions e SQL do Supabase
├─ coletor-snmp/               Aplicacao Python que coleta impressoras via SNMP
├─ docs/                       Documentacao tecnica, TCC, deploy, banco e troubleshooting
├─ .venv/                      Ambiente virtual Python local
├─ .vscode/                    Configuracoes locais do editor
├─ README.md                   Porta de entrada do projeto no GitHub
├─ .gitignore                  Regras do que nao deve ir para o Git
├─ projeto.zip                 Arquivo compactado legado/local
└─ inventario-unificado-web.zip Arquivo compactado legado/local grande
```

Regra mental:

- `inventario-unificado-web` e o sistema web e backend serverless.
- `coletor-snmp` e o agente local que conversa com as impressoras.
- `docs` e a memoria tecnica do projeto.

## 2. Pasta `inventario-unificado-web`

Esta pasta contem o frontend em Next.js, servicos TypeScript, funcoes Supabase e SQL.

```text
inventario-unificado-web/
├─ app/
├─ components/
├─ lib/
├─ services/
├─ supabase/
├─ scripts/
├─ types/
├─ public/
├─ node_modules/
├─ .next/
└─ .vercel/
```

### `app/`

Pasta principal do Next.js App Router.

Ela contem as paginas e rotas do sistema.

Subpastas importantes:

```text
app/api/           Rotas HTTP internas do Next.js
app/impressoras/   Tela operacional de impressoras
app/inventario/    Tela de inventario, devolucao, categorias, importacoes e conciliacao
app/login/         Tela de autenticacao
app/usuarios/      Tela de administracao de usuarios
```

Arquivos importantes:

```text
app/layout.tsx     Layout raiz do Next.js; importa globals.css
app/globals.css    CSS global do sistema
app/page.tsx       Pagina inicial/painel principal
```

### `components/`

Componentes reutilizaveis de interface.

Exemplos:

```text
BasicPageShell.tsx         Estrutura visual comum das paginas protegidas
PainelDashboard.tsx        Dashboard analitico de impressoras
ResumoTelemetriaDiaria.tsx Painel operacional com graficos e indicadores
StatusFeedback.tsx         Mensagens de sucesso, erro e carregamento
SuprimentosLista.tsx       Renderizacao padronizada de suprimentos
components/ui/             Componentes pequenos de UI, como Dialog
```

Boa pratica: se um trecho visual aparece em mais de uma tela, ele deve virar componente aqui.

### `lib/`

Funcoes de apoio e configuracoes compartilhadas.

Subpastas atuais:

```text
lib/printers/      Utilitarios ligados a impressoras
lib/security/      Validacoes de seguranca/autenticacao/autorizacao
lib/supabase/      Cliente Supabase e helpers de Edge Functions
lib/validation/    Validacoes de dados
```

Exemplo importante:

```text
lib/supabase/invokeEdge.ts
```

Esse helper impede chamadas a Edge Functions protegidas quando nao existe sessao Supabase valida. Ele evita rajadas de `401`.

### `services/`

Camada de servicos TypeScript.

Ela concentra leitura, escrita e regras intermediarias de dados usadas pelas APIs e telas.

Exemplos:

```text
inventarioService.ts                    Operacoes de inventario
empresaService.ts                       Empresas
setorService.ts                         Setores
movimentacaoService.ts                  Historico de movimentacao
impressorasService.ts                   Dados de impressoras
telemetriaDiariaService.ts              Consolidacao diaria de pagecount
statusSuprimentosImpressorasService.ts  Estado de suprimentos
metricasImpressorasService.ts           Metricas operacionais
```

Boa pratica: regra que envolve dados deve ficar em `services`, nao espalhada dentro do JSX da pagina.

### `supabase/`

Tudo que pertence ao Supabase.

```text
supabase/functions/   Edge Functions Deno/TypeScript
supabase/migrations/  SQL do banco, incluindo SQL Sistema.sql
supabase/.temp/       Arquivos temporarios locais da CLI Supabase
```

Functions principais:

```text
collector-impressoras  Lista impressoras para cenarios de API protegida
collector-telemetria   Recebe payload do coletor Python
inventory-core         Regras principais de inventario
inventory-print        Dashboard e operacao de impressoras
inventory-admin        Administracao
inventory-matrix       Importacao/matriz/conciliacao
_shared/               Utilitarios compartilhados entre functions
```

### `scripts/`

Scripts auxiliares do projeto web.

Geralmente usados para importacao, backfill, extracao de dados ou manutencao pontual.

### `types/`

Tipos TypeScript compartilhados.

Usado para evitar repetir interfaces em varias telas/servicos.

### `public/`

Arquivos estaticos servidos pelo Next.js.

Exemplos comuns: imagens, logos, icones, fontes ou arquivos publicos.

### Historico: pasta `legacy/` removida

A pasta `legacy/` existia como referencia historica de services e schemas antigos de impressoras. Na sanitizacao final, ela foi removida porque nao havia imports reais fora dela e o sistema atual usa as rotas, services e Edge Functions modernas.

### `.next/`, `.vercel/` e `node_modules/`

Pastas geradas por ferramentas.

- `.next`: build/cache local do Next.js.
- `.vercel`: configuracoes locais da Vercel CLI.
- `node_modules`: dependencias npm.

Normalmente nao entram no Git.

## 3. Pasta `coletor-snmp`

Esta pasta contem o aplicativo Python que coleta dados das impressoras.

```text
coletor-snmp/
├─ scripts/
├─ utils/
├─ data/
├─ logs/
├─ build/
└─ dist/
```

### `scripts/`

Scripts executaveis.

```text
collector_control_app.py  Aplicativo visual para iniciar/parar o coletor
run_collector_loop.py     Loop continuo de coleta
test_collector_push.py    Teste manual de payload e envio
```

### `utils/`

Biblioteca interna do coletor.

```text
api_client.py        Le .env, consulta Supabase, envia telemetria e faz replay
cache_manager.py     Coordena o ciclo de coleta SNMP por impressora
file_manager.py      Le e salva JSONs locais
runtime_trace.py     Registra eventos tecnicos em JSONL
snmp_client.py       Executa SNMP GET/WALK com pysnmp
telemetry_mapper.py  Monta payload final para a Edge collector-telemetria
```

### `data/`

Dados locais do coletor.

Exemplos:

```text
printers.json                    Ultima lista valida de impressoras
collector_pending.jsonl          Payloads aguardando reenvio
collector_pending_invalid.jsonl  Payloads descartados/invalidos para auditoria
quick_supply_scan_result.json    Resultado de varreduras pontuais
```

### `logs/`

Logs locais do coletor.

Exemplos:

```text
collector_loop_runtime.log      Log humano do ciclo
collector_backend_trace.jsonl   Log tecnico estruturado
collector.pid                   PID do processo ativo
```

### `build/` e `dist/`

Pastas geradas por empacotamento/build do aplicativo Python.

Nao devem ser editadas manualmente como fonte principal.

## 4. Pasta `docs`

Documentacao tecnica e material de estudo.

Arquivos principais:

```text
01-overview.md                         Visao geral
02-architecture.md                     Arquitetura
03-setup.md                            Setup local
04-database.md                         Banco de dados
06-collector.md                        Coletor Python SNMP detalhado
07-deploy.md                           Deploy
08-security.md                         Seguranca
10-troubleshooting.md                  Problemas comuns
15-visao-geral-tcc-impressoras.md      Visao TCC impressoras
20-guia-integrado-tcc-impressao-telemetria.md Guia completo TCC
21-estrutura-pastas-css.md             Este documento
```

Subpastas:

```text
docs/05-api/  Documentacao por Edge Function/API
docs/ADR/     Registros de decisoes arquiteturais
```

## 5. CSS Atual do Projeto

O CSS global fica em:

```text
inventario-unificado-web/app/globals.css
```

Esse arquivo concentra tokens, tema claro/escuro, classes `ui-*`, cards, tabelas, botoes, layout e estilos reutilizaveis.

Hoje ainda existe bastante CSS inline no JSX, especialmente em:

```text
components/PainelDashboard.tsx
app/inventario/categorias/page.tsx
app/impressoras/page.tsx
components/ui/dialog.tsx
app/inventario/devolucao/page.tsx
```

Isso nao e automaticamente errado, mas pode atrapalhar manutencao quando vira estilo fixo repetido.

Observacao: a antiga tela `app/operacional/page.tsx` foi removida na sanitizacao. O acompanhamento operacional atual fica em `app/impressoras/page.tsx`.

## 6. Inline CSS: Quando Pode e Quando Evitar

### Inline faz sentido quando o valor e dinamico

Exemplos bons:

```tsx
<span style={{ width: `${percentual}%` }} />
```

Esse caso depende de dado em tempo real. Colocar todas as larguras possiveis no CSS nao faz sentido.

Outro exemplo aceitavel:

```tsx
<div style={{ '--nivel': `${percentual}%` } as React.CSSProperties} />
```

Aqui o CSS pode usar variavel customizada.

### Inline deve ser evitado quando e estilo fixo

Exemplo que deve virar classe:

```tsx
<section className="ui-card" style={{ marginBottom: 12 }}>
```

Melhor:

```tsx
<section className="ui-card ui-mb-12">
```

Ou uma classe especifica da pagina:

```tsx
<section className="dashboard-section-card">
```

## 7. Nao Jogar Tudo no `globals.css` Sem Regra

A resposta curta: sim, devemos reduzir inline CSS, mas nao simplesmente jogar tudo no `globals.css` sem organizacao.

Se tudo for para `globals.css` sem criterio, ele vira um arquivo enorme, dificil de mexer e cheio de classes globais que podem bater uma na outra.

Melhor estrategia:

```text
globals.css
├─ 1. Tokens e temas
├─ 2. Reset/base
├─ 3. Layout geral
├─ 4. Componentes reutilizaveis ui-*
├─ 5. Tabelas e formularios
├─ 6. Pagina inventario
├─ 7. Pagina impressoras
├─ 8. Dashboard
├─ 9. Utilitarios pequenos
└─ 10. Responsividade
```

## 8. Convencao Recomendada de Classes

### Classes globais reutilizaveis

Usar prefixo `ui-`:

```css
.ui-card {}
.ui-button {}
.ui-table-wrap {}
.ui-status-pill {}
.ui-field {}
```

### Classes por pagina

Usar prefixo da pagina:

```css
.inventory-filter-panel {}
.inventory-location-chip {}
.printers-table-wrap {}
.printers-supply-stack {}
.dashboard-chart-card {}
.dashboard-kpi-grid {}
```

### Utilitarios pequenos

Usar prefixo `u-`:

```css
.u-mb-12 {}
.u-mt-0 {}
.u-grid-gap-12 {}
.u-text-muted {}
```

Sem exagero. Utilitario demais vira outro problema.

## 9. Plano Seguro Para Limpar CSS

Nao recomendo refatorar todo CSS de uma vez antes de apresentacao/importantes entregas.

Plano seguro:

1. Mapear os inline styles fixos.
2. Manter inline somente onde o valor e dinamico.
3. Criar secoes comentadas no `globals.css`.
4. Migrar primeiro componentes pequenos, como `Dialog` e `StatusFeedback`.
5. Depois migrar paginas maiores, como `PainelDashboard` e `impressoras/page.tsx`.
6. Rodar `npm run build` depois de cada bloco.
7. Testar tema claro e escuro visualmente.

## 10. Exemplo de Organizacao no `globals.css`

```css
/* =========================================================
   1. Tokens de tema
   Variaveis globais de cor, borda, sombra e espacamento.
   ========================================================= */
:root {
  --surface: #ffffff;
  --text: #0f172a;
}

/* =========================================================
   2. Componentes base
   Blocos reutilizaveis em varias telas.
   ========================================================= */
.ui-card {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 16px;
}

/* =========================================================
   3. Pagina de impressoras
   Estilos especificos da tela /impressoras.
   ========================================================= */
.printers-table-wrap {
  overflow-x: auto;
}
```

## 11. Recomendacao Final

Para este projeto, a melhor pratica e:

- manter `globals.css` para tema, tokens, componentes e classes reutilizaveis;
- criar classes por pagina dentro do proprio `globals.css`, bem separadas por comentario;
- evitar CSS inline fixo;
- manter inline apenas para valores calculados em runtime;
- nao criar centenas de arquivos CSS pequenos agora, para nao aumentar complexidade antes do TCC.

Resumo:

```text
CSS fixo e repetido -> classe no globals.css
CSS especifico de pagina -> classe com prefixo da pagina
CSS dinamico por dado -> inline ou CSS variable
```
