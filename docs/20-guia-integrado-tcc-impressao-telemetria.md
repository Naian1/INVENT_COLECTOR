# Guia Integrado TCC - Impressao, Telemetria e Inventario

Este documento junta o fluxo completo que sera mais importante para apresentacao do TCC: como o sistema descobre impressoras, coleta dados reais, compara com o inventario, grava pagecount/suprimentos e trata troca de equipamento sem poluir os indicadores.

## 1. Ideia Central

O projeto resolve um problema comum em ambiente hospitalar: impressoras sao trocadas, movidas, entram como backup, ficam sem toner ou mudam de IP, mas o inventario precisa continuar confiavel.

A solucao tem quatro camadas:

1. Frontend web para operacao e visualizacao.
2. Coletor Python para falar com impressoras via SNMP.
3. Edge Functions para validar e processar dados.
4. Banco Supabase/PostgreSQL para guardar inventario, telemetria e regras automaticas.

## 2. Fluxo do Inventario

1. O usuario cadastra ou importa equipamentos.
2. Cada equipamento fica em `inventario`.
3. Impressoras possuem patrimonio, serie, IP, MAC, modelo, status e setor.
4. A hierarquia fisica e formada por `piso`, `setor` e `localizacao`.
5. Status definem operacao:
   - `ATIVO`: pode ser coletado.
   - `BACKUP`: esta reservado e nao deve entrar na coleta normal.
   - `MANUTENCAO`: existe no inventario, mas nao esta em producao normal.
   - `DEVOLUCAO`: sai da operacao e aparece na tela de devolucao.

Funcoes envolvidas:

- `inventory-core/list_context`: monta os dados base para a tela.
- `inventory-core/list_devolucao`: filtra itens em devolucao.
- `inventory-core` tambem executa acoes de edicao, movimentacao e resolucao de pendencias.

## 3. Fluxo do Coletor SNMP

1. O coletor chama `collector-impressoras`.
2. A Edge devolve impressoras ativas com IP valido.
3. O coletor percorre cada impressora.
4. Para cada IP, ele busca via SNMP:
   - numero de serie;
   - MAC address;
   - hostname;
   - contador total de paginas;
   - suprimentos;
   - status online/offline.
5. O coletor monta payload com `telemetry_mapper.py`.
6. O payload e enviado para `collector-telemetria`.

Arquivos principais:

- `coletor-snmp/utils/cache_manager.py`
- `coletor-snmp/utils/snmp_client.py`
- `coletor-snmp/utils/telemetry_mapper.py`
- `coletor-snmp/utils/api_client.py`

## 4. Fluxo da Edge collector-telemetria

A Edge Function `collector-telemetria` e o ponto de decisao.

Ela recebe o evento e pergunta:

1. O token do coletor e valido?
2. Existe impressora no inventario com esse IP?
3. A serie detectada bate com a esperada?
4. O MAC detectado bate com o esperado?
5. O patrimonio detectado bate com o esperado, quando disponivel?
6. O evento pode gravar pagecount e suprimentos normalmente?

Se estiver tudo certo:

- Atualiza `telemetria_pagecount`.
- Atualiza `telemetria_pagecount_diaria` via trigger.
- Atualiza `suprimentos`.
- O dashboard passa a mostrar o novo estado.

Se houver divergencia:

- Cria ou atualiza `telemetria_substituicao_pendente`.
- Nao grava pagecount no inventario errado.
- Consolida a producao em `telemetria_substituicao_evento_retido`.

## 5. Troca Assistida de Impressora

A troca assistida existe para evitar automatismo perigoso.

Exemplo:

- Impressora A esta no setor e imprime 20 paginas no dia.
- Impressora A quebra.
- Impressora B, que era backup, entra no mesmo IP.
- Impressora B pode ter 500.000 paginas no contador fisico.

Sem protecao, o sistema poderia achar que o setor imprimiu 500.020 paginas. Isso seria falso.

Regra do sistema:

1. Detectou IP igual, mas serie/MAC diferente.
2. Abre pendencia.
3. Retem apenas deltas diarios seguros.
4. Usuario confirma se foi troca real, erro de cadastro ou falso positivo.
5. So depois disso o sistema aplica os dados no destino correto.

## 6. Retencao Otimizada Enquanto a Pendencia Esta Aberta

A retencao nao grava uma linha por ciclo. Ela trabalha parecida com o pagecount diario:

- Uma linha por pendencia + dia.
- Guarda contador de inicio e fim.
- Calcula `nr_paginas_dia` por delta seguro.
- Evita flood no Supabase.

Exemplo:

```text
ciclo 100: contador = 200
ciclo 101: contador = 250

retencao do dia:
inicio = 200
fim = 250
paginas_dia = 50
```

Ela nao soma 200 + 250.

## 7. Pagecount e Triggers

### Contador total

Fica em `telemetria_pagecount.nr_paginas_total`.

Ele representa o ultimo contador bruto coletado da impressora.

### Producao diaria

Fica em `telemetria_pagecount_diaria.nr_paginas_dia`.

Ele representa o delta seguro do dia.

### Trigger `trg_guardar_pagecount_consistente`

Funcao: `fn_guardar_pagecount_consistente`

Objetivo:

- Evitar que o contador total volte para tras por erro de leitura.
- Proteger contra queda abrupta.
- Manter integridade do snapshot atual.

### Trigger `trg_sync_telemetria_pagecount_diaria`

Funcao: `fn_sync_telemetria_pagecount_diaria`

Objetivo:

- Receber mudancas do contador bruto.
- Atualizar o consolidado diario.
- Somar apenas delta positivo seguro.
- Ignorar salto muito grande para nao contar historico de impressora trocada.

## 8. Suprimentos

O coletor identifica itens como:

- Cartucho Preto.
- Kit de Manutencao.
- Unidade de Imagem.

A tela de impressoras mostra:

- menor suprimento;
- classificacao `ok`, `baixo` ou `critico`;
- suprimentos agrupados;
- notificacoes quando ha itens criticos.

## 9. Telas Usadas Na Apresentacao

### Inventario

Mostra equipamentos organizados por piso, setor e localizacao. Tambem mostra pendencias de substituicao.

### Impressoras

Mostra operacao em tempo real:

- online/offline;
- patrimonio/IP/modelo/setor;
- total de paginas;
- menor suprimento;
- suprimentos agrupados;
- filtros por status e suprimento.

### Painel

Mostra volume diario, custo, equipamentos, alertas e ranking.

## 10. O Que Falar No TCC

Uma forma simples de explicar:

> O sistema nao apenas cadastra impressoras. Ele verifica se a impressora fisica conectada na rede e realmente a impressora esperada no inventario. Para isso, o coletor pega serie, MAC, IP, contador e suprimentos via SNMP. A Edge Function compara esses dados com o banco. Se estiver tudo certo, grava telemetria. Se houver divergencia, abre uma troca assistida para aprovacao humana. Isso evita que uma troca de equipamento gere dados falsos de impressao no dashboard.

## 11. Prompt Para Fluxograma

```text
Desenhe um fluxograma detalhado do modulo de impressoras do sistema INVENT_COLECTOR. Use raias para Usuario, Frontend Next.js, Coletor Python SNMP, Supabase Edge Functions e Banco PostgreSQL. Inclua: cadastro no inventario; sincronizacao de impressoras ativas pelo collector-impressoras; coleta SNMP de IP, serie, MAC, hostname, contador total e suprimentos; envio para collector-telemetria; validacao do token; comparacao com inventario; gravacao normal em telemetria_pagecount, telemetria_pagecount_diaria e suprimentos; deteccao de divergencia de identidade; criacao de telemetria_substituicao_pendente; retencao diaria em telemetria_substituicao_evento_retido; confirmacao/descarte/correcao pela tela de inventario; aplicacao segura do pagecount retido; exibicao no dashboard e na tela de impressoras. Mostre tambem as triggers fn_guardar_pagecount_consistente e fn_sync_telemetria_pagecount_diaria como protecoes contra queda e salto falso de contador.
```
