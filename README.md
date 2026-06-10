# SIMPLE SURGERY

MVP web app responsivo para eficiência operacional do centro cirúrgico.
Este projeto é um módulo da plataforma **SIMPLE SOLUTIONS**.

## Estrutura

- `frontend/`
- `backend/`
- `database/`
- `docs/`

## Event Engine

- Endpoint principal: `POST /api/v1/events`
- Tabela central: `operational_events`
- Eventos principais: `rpa_entry`, `rpa_exit`, `room_entry`, `room_exit`, `cc_exit`

## Stack alvo

- Frontend: Next.js + TypeScript + Tailwind + Shadcn/UI
- Backend: FastAPI + PostgreSQL + SQLAlchemy + Alembic
- Arquitetura: Event-driven

## Status atual

- Backend MVP implementado com event engine e endpoints principais.
- Frontend Next.js inicializado com identidade SIMPLE SURGERY.
- Banco PostgreSQL preparado com docker-compose e migracao inicial Alembic.

## Execucao Windows isolada

- `start-database.ps1`
- `bootstrap-backend.ps1`
- `start-backend.ps1`
- `start-frontend.ps1`

## Producao

- Checklist e arquitetura de deploy: `docs/DEPLOYMENT.md`
- Backend Render: `backend/render.yaml`
- Frontend Vercel: `frontend/vercel.json`
