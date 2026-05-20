# 10 - Troubleshooting
> **Leitura guiada para estudo:** este documento foi organizado para explicar o papel do módulo, o fluxo prático que ele executa e onde conferir o comportamento no código. Para estudar, leia primeiro o objetivo, depois acompanhe os arquivos/comandos citados e compare a entrada, o processamento e a saída descritos.

## Erro 401 ou 403 em Edge Function

Possiveis causas:

- Token invalido
- Project ref incorreto
- Variavel ausente no ambiente

Acoes:

1. Validar URL e project-ref.
2. Conferir token/chave carregada no ambiente.
3. Republicar function apos ajuste.

## Matrix nao salva

Possiveis causas:

- Competencia fora do formato MM/AAAA
- nr_carga invalido em append/finish
- Linha sem nr_linha valido

Acoes:

1. Reexecutar start com competencia valida.
2. Confirmar retorno de nr_carga.
3. Fazer append com lote pequeno para diagnostico.

## Tela em carregamento continuo

Possiveis causas:

- Function indisponivel
- Erro de CORS/autenticacao
- Erro JS nao tratado no frontend

Acoes:

1. Hard refresh no navegador.
2. Conferir logs no Supabase.
3. Validar chamada da action manualmente.

## Coletor sem envio

Possiveis causas:

- Endpoint indisponivel
- Token invalido
- Falha de rede

Acoes:

1. Rodar test_collector_push.py.
2. Validar COLLECTOR_API_BASE_URL e token.
3. Inspecionar arquivos em coletor-snmp/data.

## Pagecount nao atualiza no dashboard novo

Possiveis causas:

- Trigger `trg_sync_telemetria_pagecount_diaria` ausente.
- Upsert sem constraint unica em `telemetria_pagecount.nr_inventario`.
- Coletor ainda em versao antiga.

Acoes:

1. Validar constraint `uq_telemetria_pagecount_inventario`.
2. Validar trigger no banco:
   - `fn_sync_telemetria_pagecount_diaria`
   - `trg_sync_telemetria_pagecount_diaria`
3. Reimplantar `collector-telemetria`.
4. Rodar 1 ciclo do coletor e conferir dados nas duas tabelas.

## Horario da leitura aparece "de outro pais"

Possiveis causas:

- Coluna antiga em `TIMESTAMP` sem timezone.
- Leitura antiga sem offset sendo interpretada como UTC no frontend.

Acoes:

1. Garantir schema atualizado com `TIMESTAMPTZ`:
   - `telemetria_pagecount.dt_leitura`
   - `telemetria_pagecount_diaria.dt_primeira_leitura`
   - `telemetria_pagecount_diaria.dt_ultima_leitura`
2. Confirmar que a `dt_referencia` diaria continua em `America/Sao_Paulo`.
3. Reprocessar leitura recente apos deploy para validar exibicao no painel.

## Pico falso de paginas (ex.: 74 mil em 1 dia)

Possiveis causas:

- Coleta SNMP retornou `0` em um OID de contador e valor real em outro OID no mesmo ciclo.
- Consolidado diario considerou queda abrupta como valor minimo do dia.

Acoes:

1. Atualizar coletor com seletor de contador revisado (prioriza valor consistente > 0 quando houver multiplos OIDs validos).
2. Confirmar trigger com blindagem de queda abrupta (`>= 500` paginas).
3. Auditar no painel:
   - `Inicio` (primeira leitura do dia)
   - `Ultima` (ultima leitura do dia)

## Erro "Edge Function returned a non-2xx status code" no inventario

Possiveis causas:

- Validacao de regra de negocio no inventory-core (payload invalido, hierarquia invalida, etc.)
- Duplicidade de patrimonio/IP no inventario

Acoes:

1. Conferir mensagem detalhada no toast da tela (frontend agora tenta extrair o erro real retornado pela function).
2. Verificar validacoes de create/update em inventory-core.
3. Em caso de erro generico persistente, checar logs da function no dashboard Supabase.

## Duplicidade de patrimonio e IP no inventario

Como funciona:

- Patrimonio: protegido por indice unico no banco e por validacao explicita no inventory-core.
- IP: validacao explicita no inventory-core e validacao rapida no frontend antes do submit.

Onde fica:

1. Banco (indice unico de patrimonio): migration 20260402_migrate_daniel_to_public.sql.
2. Backend de regras: supabase/functions/inventory-core/index.ts.
3. Frontend de bloqueio imediato: app/inventario/page.tsx.

## Movimentacao herdando chamado antigo

Comportamento esperado (atual):

- Se `nr_chamado` vier vazio no payload, o backend nao deve reaproveitar chamado anterior.
- A observacao da movimentacao deve ficar apenas com:
  - `OBS: ...` (quando observacao foi informada), ou
  - texto padrao de movimentacao.

Se aparecer `CHAMADO:` mesmo sem preencher:

1. Verificar se a versao publicada da function `inventory-core` esta atualizada.
2. Republicar function:
   - `npx supabase functions deploy inventory-core --project-ref <ref>`
3. Confirmar no codigo publicado que `nrChamado = nrChamadoInformado` (sem fallback para historico).

## Importacao Matrix parcial (sem serie, descricao ou codigo)

Possiveis causas:

- Mudanca de nome de cabecalho entre competencias (ex.: `Serie do Equipamento` vs `N.Serie`).
- Colunas presentes na planilha, mas com alias diferente dos mapeados.

Acoes:

1. Reenviar arquivo e observar os avisos de colunas nao mapeadas na tela de importacao.
2. Conferir se os campos chave estao sendo reconhecidos: cliente, nome_cliente, patrimonio, serie, tipo, descricao.
3. Em caso de arquivo novo com cabecalho inedito, atualizar alias no parser em `app/inventario/importacoes/page.tsx`.

## Reset completo da Matrix antes de reimportar

Quando usar:

- Dados de cargas antigas inconsistentes.
- Necessidade de reprocessar competencias do zero.

SQL:

```sql
TRUNCATE TABLE public.inventario_consolidado_carga RESTART IDENTITY CASCADE;
```

Acoes recomendadas:

1. Executar backup rapido antes do truncate, se necessario.
2. Reimportar competencias em ordem cronologica (ex.: 02/2026 antes de 03/2026).
3. Validar total importado e cobertura de `nr_serie` apos a carga.

## Referencia de estudo (linhas de codigo)

- Quando precisar rastrear a origem tecnica de um problema, use:
  - `docs/18-mapa-codigo-linhas-tcc.md`
