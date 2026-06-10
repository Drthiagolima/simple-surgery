# SIMPLE SURGERY Backend

Backend FastAPI com PostgreSQL, SQLAlchemy e Alembic.

## Estrutura limpa

- `app/models`
- `app/schemas`
- `app/routes`
- `app/services`
- `app/database`

## Endpoints MVP

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/patients`
- `GET /api/v1/operating-rooms`
- `GET /api/v1/surgeries`
- `POST /api/v1/surgeries`
- `POST /api/v1/events`
- `GET /api/v1/dashboard/overview`
- `GET /api/v1/dashboard/rooms`
- `GET /api/v1/surgeries/{id}/timeline`
- `GET /api/v1/analytics/idle-time`

## Regra principal de eventos

Ao criar evento operacional, o sistema:
1. Registra timestamp do evento.
2. Atualiza status da cirurgia.
3. Atualiza marcos temporais na cirurgia (`rpa_entry_at`, etc.).
4. Recalcula tempos operacionais (`rpa_duration_minutes`, `room_duration_minutes`, `total_operational_minutes`).
5. Atualiza status da sala (`occupied`/`available`) quando aplicável.

## Autenticacao

- `POST /api/v1/auth/login` retorna JWT e dados do usuario autenticado.
- `GET /api/v1/auth/me` valida a sessao atual.
- Rotas de dashboard, cirurgias, eventos e analytics exigem `Authorization: Bearer <token>`.

## Rodando local

1. Suba PostgreSQL com Docker (opcional):

```bash
cd ../database
docker compose up -d
```

Porta local dedicada do PostgreSQL do SIMPLE SURGERY: `5434`

2. Ou crie manualmente banco PostgreSQL:
   - database: `simple_surgery`
3. Configure variáveis:
   - copie `.env.example` para `.env`
   - configuração padrão isolada: PostgreSQL `5434`, API `8010`, frontend local `3010`
4. Instale dependências:

```bash
pip install -r requirements.txt
```

5. Rode migrações:

```bash
alembic upgrade head
```

6. Rode seed inicial (usuário, salas e pacientes):

```bash
python -m scripts.seed
```

O seed cria ambiente demonstravel com:

- 1 usuario administrador
- 3 salas cirurgicas
- 3 pacientes
- 3 cirurgias exemplo
- trilha de eventos para cirurgia concluida e cirurgia em andamento

7. Suba a API:

```bash
uvicorn app.main:app --reload --port 8010
```

Ou, a partir da raiz `simple-surgery/`:

```powershell
.\start-backend.ps1
```

8. Abra documentação interativa:

- http://localhost:8010/docs

## Isolamento local do projeto

- PostgreSQL SIMPLE SURGERY: `localhost:5434`
- API SIMPLE SURGERY: `localhost:8010`
- Frontend SIMPLE SURGERY: `localhost:3010`

Esse isolamento evita colisao com ORTOGUIA em `5432`, `8000` ou `3000`.

## Credencial inicial de desenvolvimento

- Email: `admin@simplesurgery.com.br`
- Senha: `Admin@123`
- Email: `centrocirurgico@simplesurgery.com.br`
- Senha: `simplesurgery`
