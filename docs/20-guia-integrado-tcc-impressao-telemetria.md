# Guia Integrado TCC - InventÃ¡rio, Impressoras e Telemetria

Este documento Ã© o guia principal para estudar e apresentar o sistema no TCC. Ele separa claramente dois mundos que trabalham juntos:

1. **InventÃ¡rio patrimonial**: cadastro oficial dos equipamentos, localizaÃ§Ã£o, status, movimentaÃ§Ãµes e devoluÃ§Ãµes.
2. **Impressoras e telemetria**: coleta SNMP, identificaÃ§Ã£o fÃ­sica das impressoras, pagecount, suprimentos, detecÃ§Ã£o de troca e dashboards.

A ideia central Ã© simples: o inventÃ¡rio diz o que deveria existir e onde deveria estar; a telemetria verifica o que a rede realmente estÃ¡ mostrando.

---

# PARTE 1 - INVENTÃRIO

## 1. O Que Ã‰ o InventÃ¡rio Neste Sistema

InventÃ¡rio Ã© a base oficial de equipamentos do sistema. Ele responde perguntas como:

- qual equipamento existe;
- qual Ã© o patrimÃ´nio;
- qual Ã© o nÃºmero de sÃ©rie;
- qual Ã© o MAC cadastrado;
- qual IP estÃ¡ vinculado ao item, quando existir;
- em qual piso, setor e localizaÃ§Ã£o o item estÃ¡;
- se o item estÃ¡ ativo, em manutenÃ§Ã£o, backup ou devoluÃ§Ã£o;
- se o item Ã© raiz ou filho de outro item.

No projeto, o inventÃ¡rio nÃ£o Ã© sÃ³ uma lista. Ele Ã© a fonte de verdade para o restante do sistema. O coletor de impressoras, por exemplo, nÃ£o inventa uma impressora do nada. Ele consulta o inventÃ¡rio para saber quais IPs deve coletar.

Tabela principal:

```text
public.inventario
```

Campos importantes:

```text
nr_inventario       identificador interno Ãºnico do item
cd_equipamento      tipo/modelo do equipamento cadastrado
cd_setor            setor atual do item
nr_patrimonio       nÃºmero patrimonial usado pela instituiÃ§Ã£o
nr_serie            nÃºmero de sÃ©rie fÃ­sico do equipamento
nr_ip               IP usado quando o equipamento Ã© de rede
nm_mac              MAC address cadastrado
nm_hostname         nome de rede/hostname
nr_invent_sup       item superior, quando o item Ã© filho de outro
tp_status           status operacional: ATIVO, MANUTENCAO, BACKUP, DEVOLUCAO
ie_situacao         situaÃ§Ã£o lÃ³gica: A ativo, I inativo
```

## 2. DiferenÃ§a Entre InventÃ¡rio e Telemetria

- **InventÃ¡rio** Ã© cadastro administrativo. Ele diz o que o setor de TI registrou.
- **Telemetria** Ã© dado coletado automaticamente na rede. Ela diz o que o equipamento respondeu naquele momento.

Exemplo prÃ¡tico:

- InventÃ¡rio diz que o IP `172.18.132.191` pertence Ã  impressora patrimÃ´nio `242077`.
- O SNMP responde que naquele IP estÃ¡ a sÃ©rie `460031742FCF1`, que pertence Ã  impressora patrimÃ´nio `293273`.
- O sistema entende que existe divergÃªncia e abre uma pendÃªncia de substituiÃ§Ã£o.

Isso evita que uma troca fÃ­sica seja registrada como se a impressora antiga continuasse no setor.

## 3. OrganizaÃ§Ã£o FÃ­sica: Piso, Setor e LocalizaÃ§Ã£o

O sistema trabalha com trÃªs nÃ­veis de localizaÃ§Ã£o:

```text
Piso -> Setor -> LocalizaÃ§Ã£o
```

Exemplo:

```text
Piso: 1Âº Andar
Setor: AmbulatÃ³rio Oncologia - Sala Administrativa
LocalizaÃ§Ã£o: Sala Administrativa
```

Na tela, esses dados aparecem como chips visuais para facilitar leitura. Essa organizaÃ§Ã£o ajuda o usuÃ¡rio a entender rapidamente onde o equipamento estÃ¡ fisicamente.

## 4. Status do InventÃ¡rio

### ATIVO

Equipamento em uso. Para impressoras, significa que pode ser coletado pelo coletor SNMP se tiver IP vÃ¡lido.

### MANUTENCAO

Equipamento separado para manutenÃ§Ã£o. Normalmente nÃ£o deve aparecer como equipamento operacional.

### BACKUP

Equipamento reserva. Ele existe no inventÃ¡rio, mas nÃ£o estÃ¡ em produÃ§Ã£o naquele momento. Quando uma impressora quebra, uma impressora backup pode assumir o IP/local da impressora quebrada.

### DEVOLUCAO

Equipamento separado para devoluÃ§Ã£o. A tela de devoluÃ§Ã£o lista esses itens agrupados por empresa e permite exportaÃ§Ã£o.

## 5. Fluxo Principal do InventÃ¡rio no Frontend

Arquivo principal:

```text
inventario-unificado-web/app/inventario/page.tsx
```

Fluxo resumido:

1. UsuÃ¡rio abre a tela de inventÃ¡rio.
2. O frontend chama a Edge Function `inventory-core`.
3. A Edge busca itens, setores, pisos, empresas, tipos e modelos.
4. A tela monta os filtros.
5. O usuÃ¡rio filtra por patrimÃ´nio, IP, sÃ©rie, setor, piso, tipo, status ou relacionamento.
6. O sistema exibe os grupos por localizaÃ§Ã£o.
7. Se existirem pendÃªncias de substituiÃ§Ã£o, elas aparecem no topo da tela.

O frontend nÃ£o deve aplicar regra crÃ­tica sozinho. Ele exibe e envia aÃ§Ãµes para a API. A decisÃ£o final fica centralizada no backend.

## 6. Fluxo da Tela de DevoluÃ§Ã£o

Arquivo principal:

```text
inventario-unificado-web/app/inventario/devolucao/page.tsx
```

Objetivo da tela:

- listar itens com status `DEVOLUCAO`;
- agrupar por empresa;
- permitir busca por patrimÃ´nio, modelo, setor ou chamado;
- exportar CSV, PDF ou planilha.

APIs usadas:

```text
inventory-core/list_devolucao
inventory-core/list_context
```

Mesmo quando nÃ£o existe item em devoluÃ§Ã£o, a tela precisa carregar as empresas. Isso evita a sensaÃ§Ã£o de que a tela estÃ¡ quebrada quando o filtro estÃ¡ vazio.

## 7. Edge Function inventory-core

Arquivo principal:

```text
inventario-unificado-web/supabase/functions/inventory-core/index.ts
```

A `inventory-core` Ã© uma Edge Function do Supabase. Ela funciona como uma API backend. Em vez de o navegador mexer diretamente no banco, o frontend chama essa funÃ§Ã£o.

Responsabilidades principais:

- listar contexto do inventÃ¡rio;
- listar itens do inventÃ¡rio;
- listar itens em devoluÃ§Ã£o;
- confirmar troca assistida;
- descartar alerta;
- corrigir dados cadastrais quando o equipamento real Ã© o mesmo, mas o cadastro estava errado;
- aplicar regras de auditoria;
- centralizar validaÃ§Ãµes antes de alterar o banco.

Por que isso Ã© importante:

- diminui risco de alteraÃ§Ã£o errada pelo frontend;
- facilita manutenÃ§Ã£o;
- mantÃ©m regra de negÃ³cio em um ponto Ãºnico;
- ajuda a auditar quem fez cada alteraÃ§Ã£o.

## 8. Triggers do InventÃ¡rio

Triggers sÃ£o funÃ§Ãµes automÃ¡ticas do banco. Elas executam quando ocorre `INSERT`, `UPDATE` ou `DELETE` em uma tabela.

No inventÃ¡rio, elas servem para:

- registrar movimentaÃ§Ãµes;
- impedir relaÃ§Ãµes invÃ¡lidas entre itens;
- atualizar campos derivados;
- manter histÃ³rico;
- proteger a hierarquia.

Exemplo de regra protegida:

- um item nÃ£o pode ser pai dele mesmo;
- um item filho nÃ£o deve criar ciclo na Ã¡rvore;
- movimentaÃ§Ãµes precisam registrar origem e destino.

## 9. MovimentaÃ§Ã£o

Tabela relacionada:

```text
public.movimentacao
```

A movimentaÃ§Ã£o guarda histÃ³rico de alteraÃ§Ãµes importantes. Isso permite responder onde o equipamento estava antes, para onde foi, quando mudou, qual usuÃ¡rio alterou e qual status foi aplicado.

---
# PARTE 2 - IMPRESSORAS E TELEMETRIA

## 10. O Que Ã‰ Telemetria de Impressoras

Telemetria Ã© a coleta automÃ¡tica de dados operacionais. No caso das impressoras, o sistema coleta:

- status online/offline;
- contador total de pÃ¡ginas;
- nÃºmero de sÃ©rie detectado;
- MAC address detectado;
- patrimÃ´nio informado pelo equipamento, quando disponÃ­vel;
- modelo;
- hostname;
- suprimentos;
- nÃ­veis de toner, unidade de imagem e kit de manutenÃ§Ã£o.

A telemetria Ã© usada para comparar o mundo real com o inventÃ¡rio cadastrado.

## 11. O Que Ã‰ SNMP

SNMP significa **Simple Network Management Protocol**. Em portuguÃªs: Protocolo Simples de Gerenciamento de Rede.

Ele Ã© um protocolo usado para consultar equipamentos de rede, como impressoras, switches, roteadores, nobreaks, servidores e access points.

No sistema, o SNMP Ã© usado para perguntar Ã  impressora:

- qual Ã© seu contador de pÃ¡ginas;
- qual Ã© seu nÃºmero de sÃ©rie;
- qual Ã© seu MAC;
- quais suprimentos existem;
- qual porcentagem resta em cada suprimento;
- qual Ã© seu status.

## 12. Como o SNMP Funciona na PrÃ¡tica

O SNMP funciona com dois papÃ©is:

### Manager

Ã‰ quem pergunta. No nosso caso, o manager Ã© o coletor Python.

### Agent

Ã‰ quem responde. No nosso caso, o agent Ã© a impressora.

Fluxo bÃ¡sico:

```text
Coletor Python -> envia pergunta SNMP -> Impressora
Impressora -> responde valor SNMP -> Coletor Python
```

Normalmente o SNMP usa:

```text
UDP porta 161
```

O coletor nÃ£o varre a internet procurando qualquer coisa. Ele consulta os IPs vindos do inventÃ¡rio. Isso deixa o processo mais seguro, mais rÃ¡pido e mais fÃ¡cil de auditar.

## 13. O Que Ã‰ OID

OID significa **Object Identifier**. Ã‰ um endereÃ§o numÃ©rico usado pelo SNMP para identificar uma informaÃ§Ã£o.

Exemplo conceitual:

```text
OID do contador de pÃ¡ginas -> retorna 35318
OID do nÃºmero de sÃ©rie -> retorna 701732940Z7PX
OID do nÃ­vel do toner -> retorna 68
```

Um OID Ã© como uma chave de consulta. O coletor pergunta por aquela chave e a impressora responde o valor.

## 14. O Que Ã‰ MIB

MIB significa **Management Information Base**. Ela Ã© como um catÃ¡logo que explica o significado dos OIDs.

Sem MIB, o OID Ã© sÃ³ uma sequÃªncia de nÃºmeros. Com MIB, dÃ¡ para saber que aquele OID representa, por exemplo, contador total de pÃ¡ginas ou nÃ­vel de suprimento.

No sistema, a lÃ³gica prÃ¡tica fica no cÃ³digo: o coletor sabe quais OIDs tentar e como interpretar as respostas.

## 15. GET, GETNEXT e WALK

### GET

Consulta um OID especÃ­fico.

```text
Pergunta: qual Ã© o valor do OID X?
Resposta: 35318
```

### GETNEXT

Pede o prÃ³ximo OID na Ã¡rvore SNMP. Ã‰ Ãºtil quando os itens sÃ£o dinÃ¢micos, como suprimentos.

### WALK

Faz vÃ¡rias chamadas `GETNEXT` para percorrer uma Ã¡rvore de dados. Isso Ã© Ãºtil para descobrir uma lista de suprimentos, porque cada impressora pode expor cartucho, unidade de imagem, kit de manutenÃ§Ã£o e outros itens em posiÃ§Ãµes diferentes.

## 16. Bibliotecas Python Usadas no Coletor

Arquivo de dependÃªncias:

```text
coletor-snmp/requirements.txt
```

DependÃªncia principal:

```text
pysnmp>=7.1.0
```

### pysnmp

`pysnmp` Ã© a biblioteca Python usada para falar SNMP.

Ela permite:

- abrir comunicaÃ§Ã£o SNMP com um IP;
- configurar versÃ£o e comunidade SNMP;
- fazer consultas GET;
- fazer WALK em Ã¡rvores SNMP;
- tratar timeout;
- tratar erro de resposta;
- converter respostas SNMP para valores Python.

Em termos simples: sem `pysnmp`, o Python nÃ£o saberia conversar com a impressora usando SNMP.

Arquivo principal que usa `pysnmp`:

```text
coletor-snmp/utils/snmp_client.py
```

FunÃ§Ã£o do arquivo:

- esconder a complexidade do protocolo;
- receber IP e OID;
- chamar a biblioteca `pysnmp`;
- devolver valor limpo para o restante do coletor.

### urllib.request

O coletor usa `urllib.request`, biblioteca padrÃ£o do Python, para enviar dados para o Supabase Edge Function por HTTP.

Ela serve para:

- montar requisiÃ§Ã£o POST;
- enviar JSON;
- mandar token no cabeÃ§alho `Authorization`;
- ler resposta da API;
- capturar erro HTTP.

Ou seja: o projeto nÃ£o depende de `supabase-py` no coletor. Ele envia para a Edge Function usando HTTP puro.

### json

Biblioteca padrÃ£o usada para ler arquivos locais, montar payloads, salvar pendÃªncias e converter dicionÃ¡rios Python em JSON para envio.

### logging

Biblioteca padrÃ£o usada para registrar logs de ciclo iniciado, impressora offline, falha SNMP, envio com sucesso, erro HTTP e replay de pendÃªncia.

Exemplo de arquivo de log:

```text
coletor-snmp/logs/collector_loop_runtime.log
```

### concurrent.futures

Usada para rodar coletas em paralelo com `ThreadPoolExecutor`. Coletar uma impressora por vez seria lento; com workers, o coletor consulta vÃ¡rias impressoras ao mesmo tempo.

### threading e tkinter

Usados na aplicaÃ§Ã£o local com interface. `threading` evita travar a tela enquanto a coleta roda. `tkinter` cria a interface grÃ¡fica local.

### pystray e Pillow

SÃ£o dependÃªncias opcionais para Ã­cone na bandeja do Windows. Elas ajudam o coletor a ficar rodando de forma mais amigÃ¡vel, sem depender sempre de terminal aberto.

## 17. Estrutura do Coletor Python

Pasta principal:

```text
coletor-snmp/
```

Arquivos importantes:

```text
coletor-snmp/utils/snmp_client.py
coletor-snmp/utils/telemetry_mapper.py
coletor-snmp/utils/cache_manager.py
coletor-snmp/utils/api_client.py
coletor-snmp/utils/file_manager.py
coletor-snmp/utils/runtime_trace.py
coletor-snmp/scripts/run_collector_loop.py
coletor-snmp/scripts/collector_control_app.py
```

### snmp_client.py

ResponsÃ¡vel por consultar a impressora via SNMP. Recebe IP, comunidade, OID, timeout e tentativas. Devolve valor encontrado, erro, timeout ou informaÃ§Ã£o de offline.

### cache_manager.py

ResponsÃ¡vel por coordenar a coleta de cada ciclo. Ele:

- carrega configuraÃ§Ãµes locais;
- busca a lista de impressoras remota quando permitido;
- salva `printers.json` com a Ãºltima lista vÃ¡lida;
- filtra IPs elegÃ­veis;
- chama SNMP para cada impressora;
- monta snapshots com status, pagecount e suprimentos;
- aciona o envio para a API;
- usa fila local quando o envio falha.

Esse arquivo Ã© o "coraÃ§Ã£o operacional" do coletor. O script de loop chama `atualizar_cache()`, e essa funÃ§Ã£o decide o que serÃ¡ coletado naquele ciclo.

### telemetry_mapper.py

ResponsÃ¡vel por transformar dados brutos coletados em payload padronizado. Ele pega SNMP bruto, cadastro da impressora e suprimentos e monta um objeto pronto para envio para `collector-telemetria`.

Exemplo conceitual do payload:

```json
{
  "coletor_id": "collector-hgg-01",
  "eventos": [
    {
      "ingestao_id": "evt-172-18-132-191-...",
      "status": "online",
      "contador_total_paginas": 521600,
      "impressora": {
        "ip": "172.18.132.191",
        "patrimonio": "293273",
        "numero_serie": "460031742FCF1",
        "endereco_mac": "788C774E3078"
      },
      "suprimentos": []
    }
  ]
}
```

### api_client.py

ResponsÃ¡vel por falar com as APIs remotas. Ele:

- lÃª `.env`;
- busca lista de impressoras via `collector-impressoras`;
- opcionalmente consulta `public.inventario` por REST quando configurado;
- envia telemetria para `collector-telemetria`;
- manda token no cabeÃ§alho `Authorization`;
- controla retry de envio;
- grava payload pendente em `collector_pending.jsonl` quando a API nÃ£o aceita ou estÃ¡ indisponÃ­vel.

Depois do incidente de sobrecarga, esse arquivo passou a ter proteÃ§Ã£o de "circuit breaker" no sync de impressoras: quando o Supabase comeÃ§a a responder timeout, o coletor abre um intervalo de respiro e para de repetir sync remoto por alguns minutos.

### file_manager.py

ResponsÃ¡vel por leitura e escrita de arquivos locais do coletor. Ele ajuda a manter dados persistidos como configuraÃ§Ãµes, cache e arquivos JSON sem espalhar acesso a arquivo por todo o cÃ³digo.

### runtime_trace.py

ResponsÃ¡vel por registrar rastros tÃ©cnicos em JSONL. Esse arquivo Ã© Ãºtil quando precisa auditar o que o coletor tentou fazer, qual URL chamou, qual status recebeu e onde ocorreu falha.

### run_collector_loop.py

Script que mantÃ©m o coletor rodando em ciclo. Ele:

- inicia o loop;
- chama `atualizar_cache()`;
- espera o intervalo configurado;
- registra erro quando um ciclo falha;
- permite execuÃ§Ã£o contÃ­nua sem depender do usuÃ¡rio clicar manualmente.

### collector_control_app.py

AplicaÃ§Ã£o local com interface. Ela facilita iniciar, parar e acompanhar o coletor sem depender sÃ³ do terminal. TambÃ©m ajuda na apresentaÃ§Ã£o do TCC, porque mostra que o coletor Ã© um componente separado do site.

## 18. Como o Coletor Escolhe Quais Impressoras Coletar

Fluxo:

1. O coletor chama a Edge `collector-impressoras`.
2. A Edge consulta `public.inventario`.
3. Ela filtra itens do tipo impressora.
4. Ela considera status e situaÃ§Ã£o.
5. Ela retorna as impressoras com IP vÃ¡lido.
6. O coletor percorre esses IPs.

Isso significa que o coletor depende do inventÃ¡rio. Se uma impressora nÃ£o tem IP ou estÃ¡ como backup, ela pode nÃ£o ser coletada como produÃ§Ã£o.

ConfiguraÃ§Ãµes principais no `.env` do coletor:

```text
COLLECTOR_SYNC_PRINTERS_FROM_API=true
COLLECTOR_PRINTERS_SOURCE=supabase
COLLECTOR_REQUIRE_REMOTE_PRINTERS=false
COLLECTOR_SYNC_TIMEOUT=20
COLLECTOR_SYNC_RETRIES=2
COLLECTOR_SYNC_FAILURE_COOLDOWN=900
COLLECTOR_ALLOW_API_FALLBACK=false
```

O significado prÃ¡tico:

- `COLLECTOR_SYNC_PRINTERS_FROM_API=true`: o coletor tenta atualizar a lista de impressoras pelo backend.
- `COLLECTOR_PRINTERS_SOURCE=supabase`: a fonte normal do coletor local e o Supabase REST/PostgREST, consultando diretamente `public.inventario`.
- `COLLECTOR_REQUIRE_REMOTE_PRINTERS=false`: se o backend estiver fora, o coletor pode usar o cache local quando for seguro.
- `COLLECTOR_SYNC_RETRIES=2`: evita muitas tentativas seguidas.
- `COLLECTOR_SYNC_FAILURE_COOLDOWN=900`: se o sync remoto falhar, espera 15 minutos antes de tentar de novo.
- `COLLECTOR_ALLOW_API_FALLBACK=false`: evita dobrar a carga tentando outra rota quando o Supabase jÃ¡ estÃ¡ lento.

## 19. Como a Busca na Rede Acontece

O coletor nÃ£o adivinha equipamentos. Ele recebe uma lista de IPs e consulta cada um.

Para cada IP:

1. tenta contato SNMP;
2. se nÃ£o responder, marca offline ou erro;
3. se responder, coleta identificadores;
4. coleta contador de pÃ¡ginas;
5. coleta suprimentos;
6. monta payload;
7. envia para a Edge Function.

## 19.1. ProteÃ§Ã£o Contra Sobrecarga no Coletor

O coletor nÃ£o deve se comportar como um "martelo" em cima do Supabase. Se o PostgREST, Auth ou Edge Functions comeÃ§am a responder timeout, insistir vÃ¡rias vezes sÃ³ piora a situaÃ§Ã£o.

Regra atual:

1. O coletor tenta sincronizar a lista de impressoras.
2. Se o Supabase responde timeout, ele registra o erro.
3. Se as tentativas configuradas falham, abre um circuito de respiro.
4. Durante esse respiro, o coletor nÃ£o fica chamando o backend a cada ciclo.
5. Depois do tempo configurado, ele tenta novamente.

Isso protege o projeto free contra rajadas de requisiÃ§Ãµes e ajuda o Supabase a se recuperar.

Exemplo real de sintoma:

```text
Sync tentativa 1/3 falhou: The read operation timed out
Sync tentativa 2/3 falhou: The read operation timed out
Sync tentativa 3/3 falhou: The read operation timed out
```

Antes, o sistema ainda tentava outra rota de API depois desse erro. Agora, por padrÃ£o, ele nÃ£o faz fallback automÃ¡tico para outra rota quando o problema parece ser timeout/conexÃ£o do Supabase.

Exemplo conceitual:

```text
IP 172.18.134.115
-> pergunta sÃ©rie via SNMP
-> pergunta MAC via SNMP
-> pergunta contador total
-> percorre suprimentos
-> monta JSON
-> envia para Supabase
```

## 20. Payload Enviado Pela Telemetria

O payload Ã© o JSON enviado pelo coletor para a Edge Function `collector-telemetria`.

Exemplo simplificado:

```json
{
  "coletor_id": "coletor-principal",
  "coletado_em": "2026-05-20T10:00:00Z",
  "eventos": [
    {
      "ingestao_id": "evt-172-18-134-115-20260520100000",
      "coletado_em": "2026-05-20T10:00:00Z",
      "status": "online",
      "tempo_resposta_ms": 42,
      "contador_total_paginas": 35318,
      "impressora": {
        "ip": "172.18.134.115",
        "patrimonio": "330731",
        "numero_serie": "701732940Z7PX",
        "endereco_mac": "788C77D88100",
        "modelo": "XM1246",
        "fabricante": "Lexmark",
        "hostname": "HGG-ICONTAS",
        "setor": "UI Maternidade",
        "localizacao": "UI Maternidade",
        "ativo": true
      },
      "suprimentos": [
        {
          "nome": "Cartucho Preto",
          "tipo": "toner",
          "nivel_percentual": 68,
          "status": "bom"
        },
        {
          "nome": "Unidade de Imagem",
          "tipo": "imagem",
          "nivel_percentual": 0,
          "status": "critico"
        }
      ]
    }
  ]
}
```

## 21. Edge Function collector-telemetria

Arquivo principal:

```text
inventario-unificado-web/supabase/functions/collector-telemetria/index.ts
```

Responsabilidades:

- receber payload do coletor;
- validar token do coletor;
- validar formato dos eventos;
- procurar no inventÃ¡rio qual equipamento deveria estar no IP;
- comparar patrimÃ´nio, sÃ©rie e MAC;
- gravar pagecount quando a identidade bate;
- reter dados quando existe pendÃªncia;
- criar alerta de substituiÃ§Ã£o quando a identidade diverge;
- gravar suprimentos;
- devolver resumo de processamento.

## 22. Como a ComparaÃ§Ã£o de Identidade Funciona

A comparaÃ§Ã£o usa identificadores fortes:

```text
IP
patrimÃ´nio
nÃºmero de sÃ©rie
MAC address
```

Regra mental:

- IP diz onde a impressora respondeu na rede.
- PatrimÃ´nio diz qual item administrativo Ã© aquele.
- SÃ©rie diz qual equipamento fÃ­sico Ã© aquele.
- MAC diz qual placa de rede respondeu.

Se o IP Ã© o mesmo, mas sÃ©rie ou MAC sÃ£o diferentes, existe grande chance de troca fÃ­sica ou cadastro errado.

## 23. Troca Assistida de Impressora

Troca assistida significa que o sistema detecta a divergÃªncia, mas nÃ£o altera tudo sozinho sem confirmaÃ§Ã£o humana.

Motivo: existem dois cenÃ¡rios parecidos.

### CenÃ¡rio 1 - Troca real

A impressora antiga saiu e outra entrou no lugar. Nesse caso, faz sentido confirmar troca.

### CenÃ¡rio 2 - Cadastro errado

A impressora Ã© a mesma, mas o inventÃ¡rio estava com MAC ou sÃ©rie errados. Nesse caso, faz sentido corrigir dados, nÃ£o trocar equipamento.

Por isso o sistema oferece aÃ§Ãµes diferentes:

- confirmar troca;
- corrigir dados;
- descartar alerta.

## 24. Tabela de PendÃªncia de SubstituiÃ§Ã£o

Tabela:

```text
public.telemetria_substituicao_pendente
```

Ela guarda alertas abertos quando a telemetria detecta divergÃªncia.

Campos importantes:

```text
ie_status                  PENDENTE, CONFIRMADO ou DESCARTADO
dt_detectado               primeira detecÃ§Ã£o
dt_ultima_detecao          Ãºltima vez que aconteceu
nr_ocorrencias             quantas vezes o mesmo problema repetiu
nr_inventario_referencia   item que deveria estar no IP
nr_inventario_substituto   item encontrado, quando identificado
nr_ip_detectado            IP onde a divergÃªncia aconteceu
nr_patrimonio_esperado     patrimÃ´nio cadastrado no inventÃ¡rio
nr_patrimonio_detectado    patrimÃ´nio visto na telemetria
nr_serie_esperada          sÃ©rie cadastrada
nr_serie_detectada         sÃ©rie vista na telemetria
nr_mac_esperado            MAC cadastrado
nr_mac_detectado           MAC visto na telemetria
payload_evento             JSON original do evento
```

## 25. Por Que NÃ£o Gravar Pagecount Errado

Impressoras tÃªm contador fÃ­sico acumulado. Uma impressora reserva pode ter 500.000 pÃ¡ginas no histÃ³rico interno dela.

Se ela entra no lugar de uma impressora que imprimiu 20 pÃ¡ginas no dia, o sistema nÃ£o pode dizer que o setor imprimiu 500.020 pÃ¡ginas.

Por isso existe proteÃ§Ã£o:

- se a identidade bate, grava normalmente;
- se existe divergÃªncia, nÃ£o grava no item errado;
- enquanto a pendÃªncia estÃ¡ aberta, guarda produÃ§Ã£o diÃ¡ria retida;
- depois da decisÃ£o humana, aplica a regra correta.

## 26. Pagecount Bruto e Pagecount DiÃ¡rio

Existem dois conceitos diferentes.

### Contador bruto

Tabela:

```text
public.telemetria_pagecount
```

Esse nÃºmero representa o contador total fÃ­sico da impressora.

Exemplo:

```text
nr_paginas_total = 35318
```

Isso nÃ£o significa que a impressora imprimiu 35.318 pÃ¡ginas hoje. Significa que o equipamento fÃ­sico acumula esse total no histÃ³rico interno.

### ProduÃ§Ã£o diÃ¡ria

Tabela:

```text
public.telemetria_pagecount_diaria
```

Essa tabela calcula produÃ§Ã£o por dia.

Exemplo:

```text
inicio_dia = 35318
fim_dia = 35368
paginas_dia = 50
```

Aqui sim o sistema entende que foram 50 pÃ¡ginas naquele dia.

## 27. Como Evita Explodir o Contador no Dia da Troca

A regra correta Ã© trabalhar com delta, nÃ£o com total bruto.

Exemplo ruim:

```text
impressora antiga tinha 20 pÃ¡ginas no dia
impressora reserva tem contador fÃ­sico 500000
sistema soma 500000 no dashboard
```

Isso Ã© errado.

Exemplo correto:

```text
impressora antiga imprimiu 20 antes da troca
impressora nova entra com contador fÃ­sico 500000
primeira leitura da nova vira base
se depois ela vai para 500030, entÃ£o a nova produziu 30
setor no dia mostra 20 + 30 = 50
impressora nova nÃ£o herda as 20 da impressora antiga
```

Essa separaÃ§Ã£o protege o histÃ³rico por equipamento e tambÃ©m mantÃ©m o total operacional do setor coerente.

## 28. RetenÃ§Ã£o DiÃ¡ria Enquanto a PendÃªncia EstÃ¡ Aberta

Tabela:

```text
public.telemetria_substituicao_evento_retido
```

Objetivo:

- nÃ£o perder dados enquanto a pendÃªncia nÃ£o Ã© resolvida;
- nÃ£o floodar o banco com uma linha por ciclo;
- consolidar no mÃ¡ximo uma linha por pendÃªncia por dia;
- guardar inÃ­cio e fim do contador observado naquele dia.

Exemplo:

```text
ciclo 100 -> contador 200
ciclo 101 -> contador 250
```

O sistema nÃ£o soma 200 + 250.

Ele grava:

```text
inicio_dia = 200
fim_dia = 250
paginas_dia = 50
```

Se a pendÃªncia durar cinco dias, o sistema guarda uma linha por dia, nÃ£o centenas de linhas por ciclo.

## 29. O Que Acontece ao Confirmar, Corrigir ou Descartar

### Confirmar troca

Usado quando uma impressora realmente substituiu outra.

Resultado esperado:

- item substituto assume setor/IP/status correto;
- item antigo pode ir para backup, manutenÃ§Ã£o ou outro status definido pelo fluxo;
- produÃ§Ã£o retida Ã© aplicada ao item correto;
- pendÃªncia fica como `CONFIRMADO`.

### Corrigir dados

Usado quando a impressora fÃ­sica Ã© a mesma, mas o cadastro tinha MAC ou sÃ©rie errados.

Resultado esperado:

- inventÃ¡rio recebe MAC/sÃ©rie corretos;
- pendÃªncia Ã© resolvida;
- prÃ³ximas coletas passam a bater com o cadastro.

### Descartar alerta

Usado quando foi teste, ruÃ­do ou evento que nÃ£o deve alterar cadastro.

Resultado esperado:

- pendÃªncia fica como `DESCARTADO`;
- o sistema nÃ£o altera o inventÃ¡rio por causa daquele alerta.

## 30. Triggers de Pagecount

### trg_sync_telemetria_pagecount_diaria

FunÃ§Ã£o relacionada:

```text
fn_sync_telemetria_pagecount_diaria
```

Responsabilidade:

- receber leitura nova de contador bruto;
- localizar o dia de referÃªncia;
- atualizar inÃ­cio e fim do dia;
- calcular pÃ¡ginas do dia;
- proteger contra queda de contador;
- proteger contra salto absurdo.

A trigger roda no banco. EntÃ£o, mesmo que a gravaÃ§Ã£o venha da Edge Function, a regra de consolidaÃ§Ã£o diÃ¡ria continua centralizada.

## 31. Dashboard de ImpressÃ£o

O dashboard usa principalmente dados consolidados.

Ele mostra:

- pÃ¡ginas por dia;
- custo estimado;
- pÃ¡ginas por modelo;
- equipamentos online/offline;
- suprimentos crÃ­ticos;
- ranking de impressoras;
- alertas de troca.

A ideia Ã© nÃ£o depender de varrer todos os eventos brutos toda vez que a tela abre. O consolidado deixa a consulta mais leve.

## 32. Frontend da OperaÃ§Ã£o de Impressoras

Arquivo principal:

```text
inventario-unificado-web/app/impressoras/page.tsx
```

API principal:

```text
inventory-print
```

A tela mostra patrimÃ´nio, IP, modelo, setor, localizaÃ§Ã£o, status online/offline, Ãºltima coleta, contador total, menor suprimento, suprimentos agrupados e classificaÃ§Ã£o.

## 33. Bibliotecas do Frontend

Arquivo:

```text
inventario-unificado-web/package.json
```

Principais bibliotecas:

### Next.js

Framework React usado para estruturar pÃ¡ginas, rotas e build do sistema web.

### React

Biblioteca usada para criar componentes visuais e estado das telas.

### @supabase/supabase-js

Cliente JavaScript usado no frontend e serviÃ§os para conversar com Supabase quando necessÃ¡rio.

### lucide-react

Biblioteca de Ã­cones SVG usada na interface.

### @flaticon/flaticon-uicons

Biblioteca de Ã­cones usada para elementos visuais como menu, piso, setor e localizaÃ§Ã£o.

### xlsx

Usada para exportar planilhas.

### jspdf e jspdf-autotable

Usadas para exportar relatÃ³rios em PDF.

### zod

Usada para validaÃ§Ã£o de estruturas de dados quando aplicada no frontend/serviÃ§os.

## 34. Fluxo Completo da Impressora em ProduÃ§Ã£o

1. Impressora estÃ¡ cadastrada em `public.inventario`.
2. Ela tem IP e status ativo.
3. Coletor consulta lista de impressoras elegÃ­veis.
4. Coletor faz SNMP no IP.
5. Impressora responde sÃ©rie, MAC, contador e suprimentos.
6. Coletor monta payload JSON.
7. Coletor envia para `collector-telemetria`.
8. Edge valida token e payload.
9. Edge compara IP, patrimÃ´nio, sÃ©rie e MAC com o inventÃ¡rio.
10. Se bater, grava telemetria.
11. Trigger atualiza pagecount diÃ¡rio.
12. Dashboard lÃª dados consolidados.
13. UsuÃ¡rio acompanha operaÃ§Ã£o no site.

## 35. Fluxo Completo de Troca Assistida

1. Impressora antiga estÃ¡ cadastrada no IP.
2. TÃ©cnico coloca outra impressora no lugar.
3. Nova impressora responde no mesmo IP.
4. Coletor SNMP captura sÃ©rie/MAC reais.
5. Edge compara com inventÃ¡rio.
6. Dados nÃ£o batem.
7. Sistema cria pendÃªncia.
8. Pagecount nÃ£o Ã© gravado no item errado.
9. ProduÃ§Ã£o fica retida por dia.
10. UsuÃ¡rio confirma troca, corrige cadastro ou descarta alerta.
11. Sistema aplica a aÃ§Ã£o correta.
12. Coletas seguintes passam a entrar no fluxo normal.

## 36. Como Explicar Isso no TCC

Uma forma simples de apresentar:

> O sistema une inventÃ¡rio patrimonial e monitoramento real de impressoras. O inventÃ¡rio define qual equipamento deveria estar em cada setor e IP. O coletor Python usa SNMP para consultar as impressoras reais na rede. A API compara o que foi detectado com o cadastro. Se estiver correto, grava pagecount e suprimentos. Se houver divergÃªncia, abre uma pendÃªncia de troca assistida para evitar histÃ³rico falso e explosÃ£o de pÃ¡ginas no dashboard.

## 37. Pontos Fortes Para Defender

- IntegraÃ§Ã£o entre cadastro administrativo e dados reais de rede.
- Coleta automÃ¡tica via SNMP.
- ProteÃ§Ã£o contra troca fÃ­sica sem registro.
- SeparaÃ§Ã£o entre contador bruto e produÃ§Ã£o diÃ¡ria.
- RetenÃ§Ã£o otimizada enquanto existe pendÃªncia.
- Uso de Edge Functions para centralizar regra de negÃ³cio.
- Uso de triggers SQL para manter cÃ¡lculo consistente.
- Dashboard operacional para decisÃ£o rÃ¡pida.
- ComentÃ¡rios e documentaÃ§Ã£o para manutenÃ§Ã£o futura.

## 38. Perguntas Que Podem Aparecer na Banca

### Por que usar SNMP?

Porque SNMP Ã© um protocolo padrÃ£o para consultar equipamentos de rede. Ele permite obter dados diretamente da impressora sem depender de preenchimento manual.

### Por que nÃ£o gravar tudo direto no frontend?

Porque regras crÃ­ticas precisam ficar no backend. Isso reduz erro, melhora seguranÃ§a e facilita auditoria.

### Por que existe pendÃªncia de troca?

Porque uma divergÃªncia pode ser troca real ou cadastro errado. O sistema detecta automaticamente, mas pede decisÃ£o humana para nÃ£o alterar patrimÃ´nio de forma perigosa.

### Por que separar contador total de pÃ¡ginas do volume diÃ¡rio?

Porque contador total Ã© histÃ³rico fÃ­sico da impressora. Volume diÃ¡rio Ã© produÃ§Ã£o calculada por diferenÃ§a. Misturar os dois causaria nÃºmeros falsos.

### O sistema inventa impressoras?

NÃ£o. Ele parte do inventÃ¡rio e compara com o que a rede responde. Quando detecta algo diferente, abre pendÃªncia em vez de cadastrar automaticamente sem validaÃ§Ã£o.
