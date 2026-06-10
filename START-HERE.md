# SIMPLE SURGERY - START HERE

Projeto isolado do ORTOGUIA.

## Portas dedicadas

- PostgreSQL: 5434
- API FastAPI: 8010
- Frontend Next.js: 3010

## Subir banco

```bash
cd database
docker compose up -d
```

Ou use o script dedicado:

```powershell
.\start-database.ps1
```

## Subir backend

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload --port 8010
```

Ou use os scripts dedicados:

```powershell
.\bootstrap-backend.ps1
.\start-backend.ps1
```

O bootstrap do backend prepara dados demo para painel operacional e fila cirurgica.

## Subir frontend

```bash
cd frontend
npm install
npm run dev
```

Ou use o script dedicado:

```powershell
.\start-frontend.ps1
```

## URLs locais

- Frontend: http://localhost:3010
- API: http://localhost:8010
- Swagger: http://localhost:8010/docs

## Fluxo atual do frontend

- Login JWT pela tela inicial
- Sessao local persistida no navegador
- Dashboard, salas e fila carregados apenas com token valido
- Formulario de criacao de cirurgia autenticada
- Formulario de registro de evento operacional autenticado

## Identidade do projeto

- Nome: SIMPLE SURGERY
- Plataforma: SIMPLE SOLUTIONS
- Dominio alvo: www.simplesurgery.com.br

## Arquivos de producao

- Backend Render: `backend/render.yaml`
- Backend env producao: `backend/.env.production.example`
- Frontend Vercel: `frontend/vercel.json`
- Frontend env producao: `frontend/.env.production.example`
- Checklist de deploy: `docs/DEPLOYMENT.md`
- Smoke test de producao: `backend/scripts/smoke-prod.ps1`

## Separacao operacional

- Scripts dedicados do SIMPLE SURGERY ficam apenas nesta pasta raiz.
- Portas locais nao reutilizam o padrao do ORTOGUIA.
- O frontend conversa apenas com `http://localhost:8010/api/v1` no ambiente local do novo projeto.
