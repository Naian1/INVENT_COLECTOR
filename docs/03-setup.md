# 03 - Setup

## Pre requisitos

- Node.js 20+
- npm 10+
- Python 3.11+
- Conta Supabase com acesso ao projeto
- CLI do Supabase

## Setup rapido da web

```bash
cd inventario-unificado-web
npm install
npm run dev
```

## Variaveis da web

Arquivo: inventario-unificado-web/.env.local

Base recomendada:

- Copiar de `inventario-unificado-web/.env.example` para `.env.local`.

Obrigatorias:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Recomendadas:

- SUPABASE_SERVICE_ROLE_KEY
- COLLECTOR_API_TOKEN
- COLLECTOR_DEFAULT_SNMP_COMMUNITY

## Setup rapido do coletor

```powershell
cd coletor-snmp
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts\run_collector_loop.py --interval 300 --log-level INFO
```

## Variaveis do coletor

Arquivo: coletor-snmp/.env

Base recomendada:

- Copiar de `coletor-snmp/.env.example` para `.env`.

Obrigatorias:

- COLLECTOR_API_BASE_URL
- COLLECTOR_API_TOKEN
- COLLECTOR_ID
- COLLECTOR_LOOP_INTERVAL

Opcionais:

- COLLECTOR_SYNC_PRINTERS_FROM_API
- COLLECTOR_IP_FILTERS
- COLLECTOR_MAX_WORKERS
- COLLECTOR_API_TIMEOUT

## Banco e migrations

```bash
cd inventario-unificado-web
npx supabase login
npx supabase link --project-ref tcxaktsleilbdgxcstqo
npx supabase db push
```

## Validacao inicial

1. Abrir tela web local e validar carregamento.
2. Rodar chamada de teste para uma Edge Function.
3. Executar coletor com check de conexao antes do loop continuo.
