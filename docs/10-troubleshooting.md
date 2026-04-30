# 10 - Troubleshooting

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
