# Deploy de Producao - SIMPLE SURGERY

Este documento define o deploy do projeto SIMPLE SURGERY de forma separada do ORTOGUIA.

## Topologia recomendada

- Frontend: Vercel
- Backend FastAPI: Render Web Service
- Banco PostgreSQL: Render PostgreSQL ou Neon
- Dominio principal: `www.simplesurgery.com.br`
- API publica: `api.simplesurgery.com.br`

## Identidade e separacao obrigatorias

- Nao reutilizar servicos, bancos, variaveis ou dominios do ORTOGUIA.
- Nao compartilhar banco PostgreSQL com ORTOGUIA.
- Nao compartilhar `JWT secret`, usuarios, seeds ou CORS com ORTOGUIA.
- Nao apontar frontend do SIMPLE SURGERY para `api.ortoguia.com.br` ou `api.ortopguia.com.br`.

## Checklist de deploy

1. Criar subdominios DNS:
   - `www.simplesurgery.com.br`
   - `api.simplesurgery.com.br`
2. Criar banco PostgreSQL dedicado ao SIMPLE SURGERY.
3. Provisionar backend FastAPI no Render.
4. Configurar variaveis de ambiente do backend.
5. Executar migracoes Alembic no banco de producao.
6. Provisionar frontend Next.js na Vercel.
7. Configurar variaveis de ambiente do frontend.
8. Conectar dominios customizados.
9. Validar HTTPS nos dois dominios.
10. Rodar smoke test minimo em login, health e homepage.

## DNS recomendado

Para `www.simplesurgery.com.br` (frontend na Vercel):
- Preferir CNAME `www` -> `cname.vercel-dns.com`.
- Evitar usar IP fixo para `www`, pois aumenta risco de mismatch de certificado.

Para `api.simplesurgery.com.br` (backend no Render):
- Criar CNAME `api` apontando para o hostname publico do servico no Render.
- Confirmar emissao do certificado gerenciado apos propagacao DNS.

## Backend - variaveis de producao

- `APP_NAME=SIMPLE SURGERY API`
- `APP_ENV=production`
- `DATABASE_URL=<postgres production url>`
- `SECRET_KEY=<random strong secret>`
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`
- `API_PORT=10000`
- `FRONTEND_ORIGIN=https://www.simplesurgery.com.br`

## Frontend - variaveis de producao

- `NEXT_PUBLIC_API_BASE_URL=https://api.simplesurgery.com.br/api/v1`
- `NEXT_PUBLIC_PROJECT_NAME=SIMPLE SURGERY`
- `NEXT_PUBLIC_PROJECT_DOMAIN=www.simplesurgery.com.br`

## Ordem recomendada de go-live

1. Subir banco.
2. Subir backend.
3. Rodar migracoes.
4. Executar seed controlado apenas se necessario.
5. Validar `https://api.simplesurgery.com.br/health`.
6. Subir frontend.
7. Publicar `www.simplesurgery.com.br`.
8. Validar integracao frontend -> backend.

## Cutover definitivo no Render (obrigatorio)

Se `api.simplesurgery.com.br` responder em `/api/health` com `service=ortoguia-backend`, o dominio ainda esta apontando para backend legado.

Passos no Render:

1. Abrir o servico correto do SIMPLE SURGERY (FastAPI) e confirmar:
   - Runtime Python
   - Start command com `uvicorn app.main:app`
   - Health check path `/health`
2. Em `Settings -> Custom Domains`, anexar `api.simplesurgery.com.br` nesse servico.
3. Remover `api.simplesurgery.com.br` de qualquer servico legado Node/ORTOGUIA.
4. Aguardar deploy + certificado TLS concluirem.
5. Revalidar com smoke test.

Assinaturas esperadas apos cutover:

- `GET /health` => 200
- `POST /api/v1/auth/login` => 200 (usuario valido)
- `GET /api/health` => 404 (ou indisponivel)

## Smoke test minimo

- `GET /health` retorna `ok`
- `POST /api/v1/auth/login` responde 200 para usuario valido
- `GET /api/v1/dashboard/overview` responde 200 autenticado
- homepage carrega em `https://www.simplesurgery.com.br`
- frontend nao referencia dominios do ORTOGUIA

Script util:
- `backend/scripts/smoke-prod.ps1`

Exemplo de execucao:

```powershell
cd backend
.\scripts\smoke-prod.ps1
```

Se houver bloqueio de politica de execucao no Windows:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd backend
.\scripts\smoke-prod.ps1
```

## Riscos a bloquear antes de publicar

- CORS apontando para localhost em producao
- `SECRET_KEY=change-me`
- banco de homologacao usado em producao
- credenciais seed expostas em ambiente publico
- frontend ainda apontando para `localhost:8010`
