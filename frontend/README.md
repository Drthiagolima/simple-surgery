# SIMPLE SURGERY Frontend

Frontend oficial do modulo SIMPLE SURGERY da plataforma SIMPLE SOLUTIONS.

Stack:
- Next.js
- TypeScript
- Tailwind CSS
- Shadcn/UI

## Execucao local

1. Copie variaveis de ambiente:

```bash
cp .env.example .env.local
```

2. Rode em desenvolvimento:

```bash
npm run dev
```

3. Acesse:

- http://localhost:3010

## Variaveis principais

- NEXT_PUBLIC_API_BASE_URL
- NEXT_PUBLIC_PROJECT_NAME
- NEXT_PUBLIC_PROJECT_DOMAIN

## Isolamento local do projeto

- Frontend SIMPLE SURGERY: `localhost:3010`
- API SIMPLE SURGERY: `localhost:8010`
- PostgreSQL SIMPLE SURGERY: `localhost:5434`

## Objetivo da interface MVP

- Operacao por eventos em tempo real
- Visao de salas e cirurgias
- Timeline operacional por cirurgia
- Analytics de ociosidade de sala
