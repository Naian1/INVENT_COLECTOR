# INVENT_COLECTOR

Sistema de automacao operacional para inventario e monitoramento de impressoras em ambiente hospitalar.

## Quick Start

### Web (Next.js)

```bash
cd inventario-unificado-web
npm install
npm run dev
```

### Coletor (Python + SNMP)

```powershell
cd coletor-snmp
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts\run_collector_loop.py --interval 300 --log-level INFO
```

## Documentacao

Documentacao modular em `docs/`:

- [Visao Geral](docs/01-overview.md)
- [Arquitetura](docs/02-architecture.md)
- [Setup](docs/03-setup.md)
- [Banco de Dados](docs/04-database.md)
- [API Overview](docs/05-api/overview.md)
- [Coletor SNMP](docs/06-collector.md)
- [Deploy](docs/07-deploy.md)
- [Seguranca](docs/08-security.md)
- [Testes](docs/09-tests.md)
- [Troubleshooting](docs/10-troubleshooting.md)
- [Revisao de Documentacao por Release](docs/11-release-review.md)
- [Guia Geral de Versionamento no GitHub](docs/12-versionamento-github.md)
- [ADRs](docs/ADR/001-edge-first.md)

## Navegacao por publico

### Desenvolvimento

- [Setup](docs/03-setup.md)
- [Arquitetura](docs/02-architecture.md)
- [APIs](docs/05-api/overview.md)
- [Banco de Dados](docs/04-database.md)
- [Testes](docs/09-tests.md)

### Operacao TI

- [Visao Geral e Fluxos](docs/01-overview.md)
- [Coletor SNMP](docs/06-collector.md)
- [Troubleshooting](docs/10-troubleshooting.md)

### Arquitetura e Governanca

- [Arquitetura](docs/02-architecture.md)
- [ADRs](docs/ADR/001-edge-first.md)
- [Seguranca](docs/08-security.md)
- [Revisao continua por release](docs/11-release-review.md)

## Prioridades em andamento

As tres prioridades ja estao formalizadas na documentacao:

1. Completar migracao de rotas legadas para Edge Functions: [Plano de migracao](docs/02-architecture.md#migracao-de-legado-para-edge-functions)
2. Ampliar cobertura de testes automatizados: [Plano de testes](docs/09-tests.md#plano-de-ampliacao)
3. Manter revisao continua da documentacao a cada release: [Checklist de release](docs/11-release-review.md)
