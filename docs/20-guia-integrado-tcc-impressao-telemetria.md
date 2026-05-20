# Guia Integrado TCC - Inventário, Impressoras e Telemetria

Este documento é o guia principal para estudar e apresentar o sistema no TCC. Ele separa claramente dois mundos que trabalham juntos:

1. **Inventário patrimonial**: cadastro oficial dos equipamentos, localização, status, movimentações e devoluções.
2. **Impressoras e telemetria**: coleta SNMP, identificação física das impressoras, pagecount, suprimentos, detecção de troca e dashboards.

A ideia central é simples: o inventário diz o que deveria existir e onde deveria estar; a telemetria verifica o que a rede realmente está mostrando.

---

# PARTE 1 - INVENTÁRIO

## 1. O Que É o Inventário Neste Sistema

Inventário é a base oficial de equipamentos do sistema. Ele responde perguntas como:

- qual equipamento existe;
- qual é o patrimônio;
- qual é o número de série;
- qual é o MAC cadastrado;
- qual IP está vinculado ao item, quando existir;
- em qual piso, setor e localização o item está;
- se o item está ativo, em manutenção, backup ou devolução;
- se o item é raiz ou filho de outro item.

No projeto, o inventário não é só uma lista. Ele é a fonte de verdade para o restante do sistema. O coletor de impressoras, por exemplo, não inventa uma impressora do nada. Ele consulta o inventário para saber quais IPs deve coletar.

Tabela principal:

```text
public.inventario
```

Campos importantes:

```text
nr_inventario       identificador interno único do item
cd_equipamento      tipo/modelo do equipamento cadastrado
cd_setor            setor atual do item
nr_patrimonio       número patrimonial usado pela instituição
nr_serie            número de série físico do equipamento
nr_ip               IP usado quando o equipamento é de rede
nm_mac              MAC address cadastrado
nm_hostname         nome de rede/hostname
nr_invent_sup       item superior, quando o item é filho de outro
tp_status           status operacional: ATIVO, MANUTENCAO, BACKUP, DEVOLUCAO
ie_situacao         situação lógica: A ativo, I inativo
```

## 2. Diferença Entre Inventário e Telemetria

- **Inventário** é cadastro administrativo. Ele diz o que o setor de TI registrou.
- **Telemetria** é dado coletado automaticamente na rede. Ela diz o que o equipamento respondeu naquele momento.

Exemplo prático:

- Inventário diz que o IP `172.18.132.191` pertence à impressora patrimônio `242077`.
- O SNMP responde que naquele IP está a série `460031742FCF1`, que pertence à impressora patrimônio `293273`.
- O sistema entende que existe divergência e abre uma pendência de substituição.

Isso evita que uma troca física seja registrada como se a impressora antiga continuasse no setor.

## 3. Organização Física: Piso, Setor e Localização

O sistema trabalha com três níveis de localização:

```text
Piso -> Setor -> Localização
```

Exemplo:

```text
Piso: 1º Andar
Setor: Ambulatório Oncologia - Sala Administrativa
Localização: Sala Administrativa
```

Na tela, esses dados aparecem como chips visuais para facilitar leitura. Essa organização ajuda o usuário a entender rapidamente onde o equipamento está fisicamente.

## 4. Status do Inventário

### ATIVO

Equipamento em uso. Para impressoras, significa que pode ser coletado pelo coletor SNMP se tiver IP válido.

### MANUTENCAO

Equipamento separado para manutenção. Normalmente não deve aparecer como equipamento operacional.

### BACKUP

Equipamento reserva. Ele existe no inventário, mas não está em produção naquele momento. Quando uma impressora quebra, uma impressora backup pode assumir o IP/local da impressora quebrada.

### DEVOLUCAO

Equipamento separado para devolução. A tela de devolução lista esses itens agrupados por empresa e permite exportação.

## 5. Fluxo Principal do Inventário no Frontend

Arquivo principal:

```text
inventario-unificado-web/app/inventario/page.tsx
```

Fluxo resumido:

1. Usuário abre a tela de inventário.
2. O frontend chama a Edge Function `inventory-core`.
3. A Edge busca itens, setores, pisos, empresas, tipos e modelos.
4. A tela monta os filtros.
5. O usuário filtra por patrimônio, IP, série, setor, piso, tipo, status ou relacionamento.
6. O sistema exibe os grupos por localização.
7. Se existirem pendências de substituição, elas aparecem no topo da tela.

O frontend não deve aplicar regra crítica sozinho. Ele exibe e envia ações para a API. A decisão final fica centralizada no backend.

## 6. Fluxo da Tela de Devolução

Arquivo principal:

```text
inventario-unificado-web/app/inventario/devolucao/page.tsx
```

Objetivo da tela:

- listar itens com status `DEVOLUCAO`;
- agrupar por empresa;
- permitir busca por patrimônio, modelo, setor ou chamado;
- exportar CSV, PDF ou planilha.

APIs usadas:

```text
inventory-core/list_devolucao
inventory-core/list_context
```

Mesmo quando não existe item em devolução, a tela precisa carregar as empresas. Isso evita a sensação de que a tela está quebrada quando o filtro está vazio.

## 7. Edge Function inventory-core

Arquivo principal:

```text
inventario-unificado-web/supabase/functions/inventory-core/index.ts
```

A `inventory-core` é uma Edge Function do Supabase. Ela funciona como uma API backend. Em vez de o navegador mexer diretamente no banco, o frontend chama essa função.

Responsabilidades principais:

- listar contexto do inventário;
- listar itens do inventário;
- listar itens em devolução;
- confirmar troca assistida;
- descartar alerta;
- corrigir dados cadastrais quando o equipamento real é o mesmo, mas o cadastro estava errado;
- aplicar regras de auditoria;
- centralizar validações antes de alterar o banco.

Por que isso é importante:

- diminui risco de alteração errada pelo frontend;
- facilita manutenção;
- mantém regra de negócio em um ponto único;
- ajuda a auditar quem fez cada alteração.

## 8. Triggers do Inventário

Triggers são funções automáticas do banco. Elas executam quando ocorre `INSERT`, `UPDATE` ou `DELETE` em uma tabela.

No inventário, elas servem para:

- registrar movimentações;
- impedir relações inválidas entre itens;
- atualizar campos derivados;
- manter histórico;
- proteger a hierarquia.

Exemplo de regra protegida:

- um item não pode ser pai dele mesmo;
- um item filho não deve criar ciclo na árvore;
- movimentações precisam registrar origem e destino.

## 9. Movimentação

Tabela relacionada:

```text
public.movimentacao
```

A movimentação guarda histórico de alterações importantes. Isso permite responder onde o equipamento estava antes, para onde foi, quando mudou, qual usuário alterou e qual status foi aplicado.

---
# PARTE 2 - IMPRESSORAS E TELEMETRIA

## 10. O Que É Telemetria de Impressoras

Telemetria é a coleta automática de dados operacionais. No caso das impressoras, o sistema coleta:

- status online/offline;
- contador total de páginas;
- número de série detectado;
- MAC address detectado;
- patrimônio informado pelo equipamento, quando disponível;
- modelo;
- hostname;
- suprimentos;
- níveis de toner, unidade de imagem e kit de manutenção.

A telemetria é usada para comparar o mundo real com o inventário cadastrado.

## 11. O Que É SNMP

SNMP significa **Simple Network Management Protocol**. Em português: Protocolo Simples de Gerenciamento de Rede.

Ele é um protocolo usado para consultar equipamentos de rede, como impressoras, switches, roteadores, nobreaks, servidores e access points.

No sistema, o SNMP é usado para perguntar à impressora:

- qual é seu contador de páginas;
- qual é seu número de série;
- qual é seu MAC;
- quais suprimentos existem;
- qual porcentagem resta em cada suprimento;
- qual é seu status.

## 12. Como o SNMP Funciona na Prática

O SNMP funciona com dois papéis:

### Manager

É quem pergunta. No nosso caso, o manager é o coletor Python.

### Agent

É quem responde. No nosso caso, o agent é a impressora.

Fluxo básico:

```text
Coletor Python -> envia pergunta SNMP -> Impressora
Impressora -> responde valor SNMP -> Coletor Python
```

Normalmente o SNMP usa:

```text
UDP porta 161
```

O coletor não varre a internet procurando qualquer coisa. Ele consulta os IPs vindos do inventário. Isso deixa o processo mais seguro, mais rápido e mais fácil de auditar.

## 13. O Que É OID

OID significa **Object Identifier**. É um endereço numérico usado pelo SNMP para identificar uma informação.

Exemplo conceitual:

```text
OID do contador de páginas -> retorna 35318
OID do número de série -> retorna 701732940Z7PX
OID do nível do toner -> retorna 68
```

Um OID é como uma chave de consulta. O coletor pergunta por aquela chave e a impressora responde o valor.

## 14. O Que É MIB

MIB significa **Management Information Base**. Ela é como um catálogo que explica o significado dos OIDs.

Sem MIB, o OID é só uma sequência de números. Com MIB, dá para saber que aquele OID representa, por exemplo, contador total de páginas ou nível de suprimento.

No sistema, a lógica prática fica no código: o coletor sabe quais OIDs tentar e como interpretar as respostas.

## 15. GET, GETNEXT e WALK

### GET

Consulta um OID específico.

```text
Pergunta: qual é o valor do OID X?
Resposta: 35318
```

### GETNEXT

Pede o próximo OID na árvore SNMP. É útil quando os itens são dinâmicos, como suprimentos.

### WALK

Faz várias chamadas `GETNEXT` para percorrer uma árvore de dados. Isso é útil para descobrir uma lista de suprimentos, porque cada impressora pode expor cartucho, unidade de imagem, kit de manutenção e outros itens em posições diferentes.

## 16. Bibliotecas Python Usadas no Coletor

Arquivo de dependências:

```text
coletor-snmp/requirements.txt
```

Dependência principal:

```text
pysnmp>=7.1.0
```

### pysnmp

`pysnmp` é a biblioteca Python usada para falar SNMP.

Ela permite:

- abrir comunicação SNMP com um IP;
- configurar versão e comunidade SNMP;
- fazer consultas GET;
- fazer WALK em árvores SNMP;
- tratar timeout;
- tratar erro de resposta;
- converter respostas SNMP para valores Python.

Em termos simples: sem `pysnmp`, o Python não saberia conversar com a impressora usando SNMP.

Arquivo principal que usa `pysnmp`:

```text
coletor-snmp/utils/snmp_client.py
```

Função do arquivo:

- esconder a complexidade do protocolo;
- receber IP e OID;
- chamar a biblioteca `pysnmp`;
- devolver valor limpo para o restante do coletor.

### urllib.request

O coletor usa `urllib.request`, biblioteca padrão do Python, para enviar dados para o Supabase Edge Function por HTTP.

Ela serve para:

- montar requisição POST;
- enviar JSON;
- mandar token no cabeçalho `Authorization`;
- ler resposta da API;
- capturar erro HTTP.

Ou seja: o projeto não depende de `supabase-py` no coletor. Ele envia para a Edge Function usando HTTP puro.

### json

Biblioteca padrão usada para ler arquivos locais, montar payloads, salvar pendências e converter dicionários Python em JSON para envio.

### logging

Biblioteca padrão usada para registrar logs de ciclo iniciado, impressora offline, falha SNMP, envio com sucesso, erro HTTP e replay de pendência.

Exemplo de arquivo de log:

```text
coletor-snmp/logs/collector_loop_runtime.log
```

### concurrent.futures

Usada para rodar coletas em paralelo com `ThreadPoolExecutor`. Coletar uma impressora por vez seria lento; com workers, o coletor consulta várias impressoras ao mesmo tempo.

### threading e tkinter

Usados na aplicação local com interface. `threading` evita travar a tela enquanto a coleta roda. `tkinter` cria a interface gráfica local.

### pystray e Pillow

São dependências opcionais para ícone na bandeja do Windows. Elas ajudam o coletor a ficar rodando de forma mais amigável, sem depender sempre de terminal aberto.

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

Responsável por consultar a impressora via SNMP. Recebe IP, comunidade, OID, timeout e tentativas. Devolve valor encontrado, erro, timeout ou informação de offline.

### cache_manager.py

Responsável por coordenar a coleta de cada ciclo. Ele:

- carrega configurações locais;
- busca a lista de impressoras remota quando permitido;
- salva `printers.json` com a última lista válida;
- filtra IPs elegíveis;
- chama SNMP para cada impressora;
- monta snapshots com status, pagecount e suprimentos;
- aciona o envio para a API;
- usa fila local quando o envio falha.

Esse arquivo é o "coração operacional" do coletor. O script de loop chama `atualizar_cache()`, e essa função decide o que será coletado naquele ciclo.

### telemetry_mapper.py

Responsável por transformar dados brutos coletados em payload padronizado. Ele pega SNMP bruto, cadastro da impressora e suprimentos e monta um objeto pronto para envio para `collector-telemetria`.

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

Responsável por falar com as APIs remotas. Ele:

- lê `.env`;
- busca lista de impressoras via `collector-impressoras`;
- opcionalmente consulta `public.inventario` por REST quando configurado;
- envia telemetria para `collector-telemetria`;
- manda token no cabeçalho `Authorization`;
- controla retry de envio;
- grava payload pendente em `collector_pending.jsonl` quando a API não aceita ou está indisponível.

Depois do incidente de sobrecarga, esse arquivo passou a ter proteção de "circuit breaker" no sync de impressoras: quando o Supabase começa a responder timeout, o coletor abre um intervalo de respiro e para de repetir sync remoto por alguns minutos.

### file_manager.py

Responsável por leitura e escrita de arquivos locais do coletor. Ele ajuda a manter dados persistidos como configurações, cache e arquivos JSON sem espalhar acesso a arquivo por todo o código.

### runtime_trace.py

Responsável por registrar rastros técnicos em JSONL. Esse arquivo é útil quando precisa auditar o que o coletor tentou fazer, qual URL chamou, qual status recebeu e onde ocorreu falha.

### run_collector_loop.py

Script que mantém o coletor rodando em ciclo. Ele:

- inicia o loop;
- chama `atualizar_cache()`;
- espera o intervalo configurado;
- registra erro quando um ciclo falha;
- permite execução contínua sem depender do usuário clicar manualmente.

### collector_control_app.py

Aplicação local com interface. Ela facilita iniciar, parar e acompanhar o coletor sem depender só do terminal. Também ajuda na apresentação do TCC, porque mostra que o coletor é um componente separado do site.

## 18. Como o Coletor Escolhe Quais Impressoras Coletar

Fluxo:

1. O coletor chama a Edge `collector-impressoras`.
2. A Edge consulta `public.inventario`.
3. Ela filtra itens do tipo impressora.
4. Ela considera status e situação.
5. Ela retorna as impressoras com IP válido.
6. O coletor percorre esses IPs.

Isso significa que o coletor depende do inventário. Se uma impressora não tem IP ou está como backup, ela pode não ser coletada como produção.

Configurações principais no `.env` do coletor:

```text
COLLECTOR_SYNC_PRINTERS_FROM_API=true
COLLECTOR_PRINTERS_SOURCE=api
COLLECTOR_REQUIRE_REMOTE_PRINTERS=false
COLLECTOR_SYNC_TIMEOUT=20
COLLECTOR_SYNC_RETRIES=2
COLLECTOR_SYNC_FAILURE_COOLDOWN=900
COLLECTOR_ALLOW_API_FALLBACK=false
```

O significado prático:

- `COLLECTOR_SYNC_PRINTERS_FROM_API=true`: o coletor tenta atualizar a lista de impressoras pelo backend.
- `COLLECTOR_PRINTERS_SOURCE=api`: a fonte normal é a Edge `collector-impressoras`, que consulta `public.inventario`.
- `COLLECTOR_REQUIRE_REMOTE_PRINTERS=false`: se o backend estiver fora, o coletor pode usar o cache local quando for seguro.
- `COLLECTOR_SYNC_RETRIES=2`: evita muitas tentativas seguidas.
- `COLLECTOR_SYNC_FAILURE_COOLDOWN=900`: se o sync remoto falhar, espera 15 minutos antes de tentar de novo.
- `COLLECTOR_ALLOW_API_FALLBACK=false`: evita dobrar a carga tentando outra rota quando o Supabase já está lento.

## 19. Como a Busca na Rede Acontece

O coletor não adivinha equipamentos. Ele recebe uma lista de IPs e consulta cada um.

Para cada IP:

1. tenta contato SNMP;
2. se não responder, marca offline ou erro;
3. se responder, coleta identificadores;
4. coleta contador de páginas;
5. coleta suprimentos;
6. monta payload;
7. envia para a Edge Function.

## 19.1. Proteção Contra Sobrecarga no Coletor

O coletor não deve se comportar como um "martelo" em cima do Supabase. Se o PostgREST, Auth ou Edge Functions começam a responder timeout, insistir várias vezes só piora a situação.

Regra atual:

1. O coletor tenta sincronizar a lista de impressoras.
2. Se o Supabase responde timeout, ele registra o erro.
3. Se as tentativas configuradas falham, abre um circuito de respiro.
4. Durante esse respiro, o coletor não fica chamando o backend a cada ciclo.
5. Depois do tempo configurado, ele tenta novamente.

Isso protege o projeto free contra rajadas de requisições e ajuda o Supabase a se recuperar.

Exemplo real de sintoma:

```text
Sync tentativa 1/3 falhou: The read operation timed out
Sync tentativa 2/3 falhou: The read operation timed out
Sync tentativa 3/3 falhou: The read operation timed out
```

Antes, o sistema ainda tentava outra rota de API depois desse erro. Agora, por padrão, ele não faz fallback automático para outra rota quando o problema parece ser timeout/conexão do Supabase.

Exemplo conceitual:

```text
IP 172.18.134.115
-> pergunta série via SNMP
-> pergunta MAC via SNMP
-> pergunta contador total
-> percorre suprimentos
-> monta JSON
-> envia para Supabase
```

## 20. Payload Enviado Pela Telemetria

O payload é o JSON enviado pelo coletor para a Edge Function `collector-telemetria`.

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
- procurar no inventário qual equipamento deveria estar no IP;
- comparar patrimônio, série e MAC;
- gravar pagecount quando a identidade bate;
- reter dados quando existe pendência;
- criar alerta de substituição quando a identidade diverge;
- gravar suprimentos;
- devolver resumo de processamento.

## 22. Como a Comparação de Identidade Funciona

A comparação usa identificadores fortes:

```text
IP
patrimônio
número de série
MAC address
```

Regra mental:

- IP diz onde a impressora respondeu na rede.
- Patrimônio diz qual item administrativo é aquele.
- Série diz qual equipamento físico é aquele.
- MAC diz qual placa de rede respondeu.

Se o IP é o mesmo, mas série ou MAC são diferentes, existe grande chance de troca física ou cadastro errado.

## 23. Troca Assistida de Impressora

Troca assistida significa que o sistema detecta a divergência, mas não altera tudo sozinho sem confirmação humana.

Motivo: existem dois cenários parecidos.

### Cenário 1 - Troca real

A impressora antiga saiu e outra entrou no lugar. Nesse caso, faz sentido confirmar troca.

### Cenário 2 - Cadastro errado

A impressora é a mesma, mas o inventário estava com MAC ou série errados. Nesse caso, faz sentido corrigir dados, não trocar equipamento.

Por isso o sistema oferece ações diferentes:

- confirmar troca;
- corrigir dados;
- descartar alerta.

## 24. Tabela de Pendência de Substituição

Tabela:

```text
public.telemetria_substituicao_pendente
```

Ela guarda alertas abertos quando a telemetria detecta divergência.

Campos importantes:

```text
ie_status                  PENDENTE, CONFIRMADO ou DESCARTADO
dt_detectado               primeira detecção
dt_ultima_detecao          última vez que aconteceu
nr_ocorrencias             quantas vezes o mesmo problema repetiu
nr_inventario_referencia   item que deveria estar no IP
nr_inventario_substituto   item encontrado, quando identificado
nr_ip_detectado            IP onde a divergência aconteceu
nr_patrimonio_esperado     patrimônio cadastrado no inventário
nr_patrimonio_detectado    patrimônio visto na telemetria
nr_serie_esperada          série cadastrada
nr_serie_detectada         série vista na telemetria
nr_mac_esperado            MAC cadastrado
nr_mac_detectado           MAC visto na telemetria
payload_evento             JSON original do evento
```

## 25. Por Que Não Gravar Pagecount Errado

Impressoras têm contador físico acumulado. Uma impressora reserva pode ter 500.000 páginas no histórico interno dela.

Se ela entra no lugar de uma impressora que imprimiu 20 páginas no dia, o sistema não pode dizer que o setor imprimiu 500.020 páginas.

Por isso existe proteção:

- se a identidade bate, grava normalmente;
- se existe divergência, não grava no item errado;
- enquanto a pendência está aberta, guarda produção diária retida;
- depois da decisão humana, aplica a regra correta.

## 26. Pagecount Bruto e Pagecount Diário

Existem dois conceitos diferentes.

### Contador bruto

Tabela:

```text
public.telemetria_pagecount
```

Esse número representa o contador total físico da impressora.

Exemplo:

```text
nr_paginas_total = 35318
```

Isso não significa que a impressora imprimiu 35.318 páginas hoje. Significa que o equipamento físico acumula esse total no histórico interno.

### Produção diária

Tabela:

```text
public.telemetria_pagecount_diaria
```

Essa tabela calcula produção por dia.

Exemplo:

```text
inicio_dia = 35318
fim_dia = 35368
paginas_dia = 50
```

Aqui sim o sistema entende que foram 50 páginas naquele dia.

## 27. Como Evita Explodir o Contador no Dia da Troca

A regra correta é trabalhar com delta, não com total bruto.

Exemplo ruim:

```text
impressora antiga tinha 20 páginas no dia
impressora reserva tem contador físico 500000
sistema soma 500000 no dashboard
```

Isso é errado.

Exemplo correto:

```text
impressora antiga imprimiu 20 antes da troca
impressora nova entra com contador físico 500000
primeira leitura da nova vira base
se depois ela vai para 500030, então a nova produziu 30
setor no dia mostra 20 + 30 = 50
impressora nova não herda as 20 da impressora antiga
```

Essa separação protege o histórico por equipamento e também mantém o total operacional do setor coerente.

## 28. Retenção Diária Enquanto a Pendência Está Aberta

Tabela:

```text
public.telemetria_substituicao_evento_retido
```

Objetivo:

- não perder dados enquanto a pendência não é resolvida;
- não floodar o banco com uma linha por ciclo;
- consolidar no máximo uma linha por pendência por dia;
- guardar início e fim do contador observado naquele dia.

Exemplo:

```text
ciclo 100 -> contador 200
ciclo 101 -> contador 250
```

O sistema não soma 200 + 250.

Ele grava:

```text
inicio_dia = 200
fim_dia = 250
paginas_dia = 50
```

Se a pendência durar cinco dias, o sistema guarda uma linha por dia, não centenas de linhas por ciclo.

## 29. O Que Acontece ao Confirmar, Corrigir ou Descartar

### Confirmar troca

Usado quando uma impressora realmente substituiu outra.

Resultado esperado:

- item substituto assume setor/IP/status correto;
- item antigo pode ir para backup, manutenção ou outro status definido pelo fluxo;
- produção retida é aplicada ao item correto;
- pendência fica como `CONFIRMADO`.

### Corrigir dados

Usado quando a impressora física é a mesma, mas o cadastro tinha MAC ou série errados.

Resultado esperado:

- inventário recebe MAC/série corretos;
- pendência é resolvida;
- próximas coletas passam a bater com o cadastro.

### Descartar alerta

Usado quando foi teste, ruído ou evento que não deve alterar cadastro.

Resultado esperado:

- pendência fica como `DESCARTADO`;
- o sistema não altera o inventário por causa daquele alerta.

## 30. Triggers de Pagecount

### trg_sync_telemetria_pagecount_diaria

Função relacionada:

```text
fn_sync_telemetria_pagecount_diaria
```

Responsabilidade:

- receber leitura nova de contador bruto;
- localizar o dia de referência;
- atualizar início e fim do dia;
- calcular páginas do dia;
- proteger contra queda de contador;
- proteger contra salto absurdo.

A trigger roda no banco. Então, mesmo que a gravação venha da Edge Function, a regra de consolidação diária continua centralizada.

## 31. Dashboard de Impressão

O dashboard usa principalmente dados consolidados.

Ele mostra:

- páginas por dia;
- custo estimado;
- páginas por modelo;
- equipamentos online/offline;
- suprimentos críticos;
- ranking de impressoras;
- alertas de troca.

A ideia é não depender de varrer todos os eventos brutos toda vez que a tela abre. O consolidado deixa a consulta mais leve.

## 32. Frontend da Operação de Impressoras

Arquivo principal:

```text
inventario-unificado-web/app/impressoras/page.tsx
```

API principal:

```text
inventory-print
```

A tela mostra patrimônio, IP, modelo, setor, localização, status online/offline, última coleta, contador total, menor suprimento, suprimentos agrupados e classificação.

## 33. Bibliotecas do Frontend

Arquivo:

```text
inventario-unificado-web/package.json
```

Principais bibliotecas:

### Next.js

Framework React usado para estruturar páginas, rotas e build do sistema web.

### React

Biblioteca usada para criar componentes visuais e estado das telas.

### @supabase/supabase-js

Cliente JavaScript usado no frontend e serviços para conversar com Supabase quando necessário.

### lucide-react

Biblioteca de ícones SVG usada na interface.

### @flaticon/flaticon-uicons

Biblioteca de ícones usada para elementos visuais como menu, piso, setor e localização.

### xlsx

Usada para exportar planilhas.

### jspdf e jspdf-autotable

Usadas para exportar relatórios em PDF.

### zod

Usada para validação de estruturas de dados quando aplicada no frontend/serviços.

## 34. Fluxo Completo da Impressora em Produção

1. Impressora está cadastrada em `public.inventario`.
2. Ela tem IP e status ativo.
3. Coletor consulta lista de impressoras elegíveis.
4. Coletor faz SNMP no IP.
5. Impressora responde série, MAC, contador e suprimentos.
6. Coletor monta payload JSON.
7. Coletor envia para `collector-telemetria`.
8. Edge valida token e payload.
9. Edge compara IP, patrimônio, série e MAC com o inventário.
10. Se bater, grava telemetria.
11. Trigger atualiza pagecount diário.
12. Dashboard lê dados consolidados.
13. Usuário acompanha operação no site.

## 35. Fluxo Completo de Troca Assistida

1. Impressora antiga está cadastrada no IP.
2. Técnico coloca outra impressora no lugar.
3. Nova impressora responde no mesmo IP.
4. Coletor SNMP captura série/MAC reais.
5. Edge compara com inventário.
6. Dados não batem.
7. Sistema cria pendência.
8. Pagecount não é gravado no item errado.
9. Produção fica retida por dia.
10. Usuário confirma troca, corrige cadastro ou descarta alerta.
11. Sistema aplica a ação correta.
12. Coletas seguintes passam a entrar no fluxo normal.

## 36. Como Explicar Isso no TCC

Uma forma simples de apresentar:

> O sistema une inventário patrimonial e monitoramento real de impressoras. O inventário define qual equipamento deveria estar em cada setor e IP. O coletor Python usa SNMP para consultar as impressoras reais na rede. A API compara o que foi detectado com o cadastro. Se estiver correto, grava pagecount e suprimentos. Se houver divergência, abre uma pendência de troca assistida para evitar histórico falso e explosão de páginas no dashboard.

## 37. Pontos Fortes Para Defender

- Integração entre cadastro administrativo e dados reais de rede.
- Coleta automática via SNMP.
- Proteção contra troca física sem registro.
- Separação entre contador bruto e produção diária.
- Retenção otimizada enquanto existe pendência.
- Uso de Edge Functions para centralizar regra de negócio.
- Uso de triggers SQL para manter cálculo consistente.
- Dashboard operacional para decisão rápida.
- Comentários e documentação para manutenção futura.

## 38. Perguntas Que Podem Aparecer na Banca

### Por que usar SNMP?

Porque SNMP é um protocolo padrão para consultar equipamentos de rede. Ele permite obter dados diretamente da impressora sem depender de preenchimento manual.

### Por que não gravar tudo direto no frontend?

Porque regras críticas precisam ficar no backend. Isso reduz erro, melhora segurança e facilita auditoria.

### Por que existe pendência de troca?

Porque uma divergência pode ser troca real ou cadastro errado. O sistema detecta automaticamente, mas pede decisão humana para não alterar patrimônio de forma perigosa.

### Por que separar contador total de páginas do volume diário?

Porque contador total é histórico físico da impressora. Volume diário é produção calculada por diferença. Misturar os dois causaria números falsos.

### O sistema inventa impressoras?

Não. Ele parte do inventário e compara com o que a rede responde. Quando detecta algo diferente, abre pendência em vez de cadastrar automaticamente sem validação.
