# Arquitetura Event-Driven - SIMPLE SURGERY

## Entidade central

`operational_events` é o núcleo da operação.
Cada evento representa uma transição operacional da cirurgia.

## Fluxo principal

1. `rpa_entry`
2. `rpa_exit`
3. `room_entry`
4. `room_exit`
5. `cc_exit`

## Efeito do evento

Ao receber `POST /api/v1/events`:
- registra evento e timestamp,
- atualiza estado da cirurgia,
- atualiza marcos temporais,
- recalcula tempos operacionais,
- alimenta métricas de dashboard e analytics.

## Entidades iniciais

- `users`
- `patients`
- `operating_rooms`
- `surgeries`
- `operational_events`
- `documents`
- `audit_logs`
