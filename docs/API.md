# API - SIMPLE SURGERY

Base URL local:
- http://localhost:8000

Prefixo:
- /api/v1

## Auth

### POST /api/v1/auth/login
Body:
{
  "email": "admin@simplesurgery.com.br",
  "password": "Admin@123"
}

### GET /api/v1/auth/me
Header:
- Authorization: Bearer <jwt>

## Referencias operacionais

### GET /api/v1/patients

### GET /api/v1/operating-rooms

## Surgeries

### GET /api/v1/surgeries

### POST /api/v1/surgeries
Body:
{
  "patient_id": "uuid",
  "room_id": "uuid",
  "surgeon_name": "Dr. Nome",
  "procedure_name": "Artroplastia",
  "scheduled_start": "2026-06-09T09:00:00Z"
}

## Event Engine

### POST /api/v1/events
Header:
- Authorization: Bearer <jwt>

Body:
{
  "surgery_id": "uuid",
  "event_type": "rpa_entry",
  "occurred_at": "2026-06-09T09:05:00Z",
  "payload": {
    "source": "mv"
  }
}

Eventos aceitos:
- rpa_entry
- rpa_exit
- room_entry
- room_exit
- cc_exit

## Dashboard

### GET /api/v1/dashboard/overview
Header:
- Authorization: Bearer <jwt>

### GET /api/v1/dashboard/rooms
Header:
- Authorization: Bearer <jwt>

## Timeline e Analytics

### GET /api/v1/surgeries/{id}/timeline
Header:
- Authorization: Bearer <jwt>

### GET /api/v1/analytics/idle-time
Header:
- Authorization: Bearer <jwt>

Query params opcionais:
- room_id=<uuid>
- period_days=<1..365>

Exemplo:
- /api/v1/analytics/idle-time?room_id=uuid&period_days=7
