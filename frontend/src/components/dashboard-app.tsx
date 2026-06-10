"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  CircleAlert,
  Clock3,
  DoorClosed,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  API_BASE_URL,
  type AuthUser,
  type DashboardPayload,
  type EventCreatePayload,
  type IdleTimeResponse,
  type OperatingRoom,
  type Patient,
  type SurgeryCreatePayload,
  type SurgeryTimelineResponse,
  createOperationalEvent,
  createSurgery,
  getCurrentUser,
  getDashboardPayload,
  getIdleTimeAnalytics,
  getOperatingRooms,
  getPatients,
  getSurgeryTimeline,
  loginRequest,
} from "@/lib/api";

const SESSION_STORAGE_KEY = "simple-surgery:auth-session";

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  in_rpa: "Em RPA",
  ready_for_room: "Pronta para sala",
  in_room: "Em sala",
  room_released: "Sala liberada",
  completed: "Concluída",
  available: "Disponível",
  occupied: "Ocupada",
};

type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

type LoginFormState = {
  email: string;
  password: string;
};

type SurgeryFormState = {
  patient_id: string;
  room_id: string;
  surgeon_name: string;
  procedure_name: string;
  scheduled_start: string;
};

type EventFormState = {
  surgery_id: string;
  event_type: string;
  occurred_at: string;
};

const emptyPayload: DashboardPayload = {
  overview: null,
  rooms: [],
  surgeries: [],
  apiAvailable: false,
};

const defaultEventType = "rpa_entry";
const eventOptions = ["rpa_entry", "rpa_exit", "room_entry", "room_exit", "cc_exit"];
const analyticsPeriodOptions = [
  { value: "1", label: "Último dia" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
];

export function DashboardApp() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [payload, setPayload] = useState<DashboardPayload>(emptyPayload);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [roomsCatalog, setRoomsCatalog] = useState<OperatingRoom[]>([]);
  const [idleAnalytics, setIdleAnalytics] = useState<IdleTimeResponse | null>(null);
  const [timelineData, setTimelineData] = useState<SurgeryTimelineResponse | null>(null);
  const [selectedTimelineSurgeryId, setSelectedTimelineSurgeryId] = useState<string>("");
  const [analyticsPeriodDays, setAnalyticsPeriodDays] = useState<string>("7");
  const [analyticsRoomId, setAnalyticsRoomId] = useState<string>("");

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isSavingSurgery, setIsSavingSurgery] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "centrocirurgico@simplesurgery.com.br",
    password: "simplesurgery",
  });

  const [surgeryForm, setSurgeryForm] = useState<SurgeryFormState>({
    patient_id: "",
    room_id: "",
    surgeon_name: "",
    procedure_name: "",
    scheduled_start: "",
  });

  const [eventForm, setEventForm] = useState<EventFormState>({
    surgery_id: "",
    event_type: defaultEventType,
    occurred_at: "",
  });

  useEffect(() => {
    const serialized = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!serialized) {
      if (!autoLoginAttempted) {
        setAutoLoginAttempted(true);
        void autoLoginWithDefaultCredentials();
      } else {
        setIsBootstrapping(false);
      }
      return;
    }

    try {
      const parsed = JSON.parse(serialized) as AuthSession;
      setSession(parsed);
      void hydrateAll(parsed.accessToken, parsed.user);
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      setIsBootstrapping(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoginAttempted]);

  async function autoLoginWithDefaultCredentials() {
    setIsBootstrapping(true);
    setIsSubmittingLogin(true);
    setLoadError(null);

    try {
      const response = await loginRequest({
        email: "centrocirurgico@simplesurgery.com.br",
        password: "simplesurgery",
      });
      const nextSession = {
        accessToken: response.access_token,
        user: response.user,
      };
      setSession(nextSession);
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      await hydrateAll(nextSession.accessToken, nextSession.user);
    } catch {
      setIsBootstrapping(false);
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  useEffect(() => {
    if (!surgeryForm.patient_id && patients.length > 0) {
      setSurgeryForm((current) => ({ ...current, patient_id: patients[0].id }));
    }
    if (!surgeryForm.room_id && roomsCatalog.length > 0) {
      setSurgeryForm((current) => ({ ...current, room_id: roomsCatalog[0].id }));
    }
  }, [patients, roomsCatalog, surgeryForm.patient_id, surgeryForm.room_id]);

  useEffect(() => {
    if (!eventForm.surgery_id && payload.surgeries.length > 0) {
      setEventForm((current) => ({ ...current, surgery_id: payload.surgeries[0].id }));
    }
  }, [payload.surgeries, eventForm.surgery_id]);

  useEffect(() => {
    if (!selectedTimelineSurgeryId && payload.surgeries.length > 0) {
      setSelectedTimelineSurgeryId(payload.surgeries[0].id);
    }
  }, [payload.surgeries, selectedTimelineSurgeryId]);

  useEffect(() => {
    if (!session) {
      setIdleAnalytics(null);
      return;
    }

    void loadIdleAnalytics(session.accessToken, analyticsRoomId, analyticsPeriodDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, analyticsRoomId, analyticsPeriodDays]);

  useEffect(() => {
    if (!session || !selectedTimelineSurgeryId) {
      setTimelineData(null);
      return;
    }

    void loadTimeline(session.accessToken, selectedTimelineSurgeryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimelineSurgeryId, session?.accessToken]);

  const overview = payload.overview ?? {
    total_surgeries: payload.surgeries.length,
    surgeries_in_progress: payload.surgeries.filter((item) => item.status !== "completed").length,
    surgeries_completed: payload.surgeries.filter((item) => item.status === "completed").length,
    avg_rpa_minutes: 0,
    avg_room_minutes: 0,
  };

  const roomsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of roomsCatalog) {
      map.set(room.id, room.name);
    }
    return map;
  }, [roomsCatalog]);

  const validatedTimeline = useMemo(
    () => buildTimelineValidation(timelineData?.timeline ?? []),
    [timelineData?.timeline],
  );

  async function hydrateAll(accessToken: string, fallbackUser?: AuthUser) {
    setIsBootstrapping(true);
    setLoadError(null);

    const [user, dashboard, nextPatients, nextRooms] = await Promise.all([
      getCurrentUser(accessToken),
      getDashboardPayload(accessToken),
      getPatients(accessToken),
      getOperatingRooms(accessToken),
    ]);

    if (!user) {
      handleLogout();
      setLoadError("Sua sessão expirou. Entre novamente para acessar o painel.");
      setIsBootstrapping(false);
      return;
    }

    const nextSession = { accessToken, user: user ?? fallbackUser! };
    setSession(nextSession);
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setPayload(dashboard);
    setPatients(nextPatients);
    setRoomsCatalog(nextRooms);
    await loadIdleAnalytics(accessToken, analyticsRoomId, analyticsPeriodDays);
    setIsBootstrapping(false);
  }

  async function loadIdleAnalytics(accessToken: string, roomId: string, periodDays: string) {
    setIsLoadingAnalytics(true);
    const response = await getIdleTimeAnalytics(accessToken, {
      roomId: roomId || undefined,
      periodDays: Number(periodDays),
    });
    setIdleAnalytics(response);
    setIsLoadingAnalytics(false);
  }

  async function loadTimeline(accessToken: string, surgeryId: string) {
    setIsLoadingTimeline(true);
    const timeline = await getSurgeryTimeline(accessToken, surgeryId);
    setTimelineData(timeline);
    setIsLoadingTimeline(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingLogin(true);
    setLoadError(null);

    try {
      const response = await loginRequest(loginForm);
      const nextSession = {
        accessToken: response.access_token,
        user: response.user,
      };
      setSession(nextSession);
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      await hydrateAll(nextSession.accessToken, nextSession.user);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível autenticar.");
      setPayload(emptyPayload);
    } finally {
      setIsSubmittingLogin(false);
      setIsBootstrapping(false);
    }
  }

  async function handleCreateSurgery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setActionError(null);
    setActionMessage(null);
    setIsSavingSurgery(true);

    const payloadToSend: SurgeryCreatePayload = {
      patient_id: surgeryForm.patient_id,
      room_id: surgeryForm.room_id,
      surgeon_name: surgeryForm.surgeon_name,
      procedure_name: surgeryForm.procedure_name,
      scheduled_start: surgeryForm.scheduled_start ? new Date(surgeryForm.scheduled_start).toISOString() : null,
    };

    try {
      const surgery = await createSurgery(session.accessToken, payloadToSend);
      setActionMessage(`Cirurgia criada com sucesso (${shortId(surgery.id)}).`);
      setSurgeryForm((current) => ({
        ...current,
        surgeon_name: "",
        procedure_name: "",
        scheduled_start: "",
      }));
      await hydrateAll(session.accessToken, session.user);
      setEventForm((current) => ({ ...current, surgery_id: surgery.id }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível criar cirurgia.");
    } finally {
      setIsSavingSurgery(false);
    }
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setActionError(null);
    setActionMessage(null);
    setIsSavingEvent(true);

    const payloadToSend: EventCreatePayload = {
      surgery_id: eventForm.surgery_id,
      event_type: eventForm.event_type,
      occurred_at: eventForm.occurred_at ? new Date(eventForm.occurred_at).toISOString() : null,
      payload: { source: "frontend" },
    };

    try {
      await createOperationalEvent(session.accessToken, payloadToSend);
      setActionMessage(`Evento ${eventForm.event_type} registrado com sucesso.`);
      setEventForm((current) => ({ ...current, occurred_at: "" }));
      await hydrateAll(session.accessToken, session.user);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível registrar evento.");
    } finally {
      setIsSavingEvent(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setPayload(emptyPayload);
    setPatients([]);
    setRoomsCatalog([]);
    setIdleAnalytics(null);
    setTimelineData(null);
    setSelectedTimelineSurgeryId("");
    setAnalyticsRoomId("");
    setAnalyticsPeriodDays("7");
    setActionMessage(null);
    setActionError(null);
  }

  if (!session) {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(46,141,139,0.20),transparent_25%),radial-gradient(circle_at_85%_5%,rgba(255,138,79,0.22),transparent_22%),linear-gradient(180deg,#f9fdfd_0%,#eef4f4_100%)]" />
        <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-[2rem] border border-border/80 bg-card/90 p-8 shadow-sm backdrop-blur">
              <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                SIMPLE SOLUTIONS
              </p>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">SIMPLE SURGERY</h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground">
                Painel autenticado para operação do centro cirúrgico com controle por eventos, leitura de salas e fila
                cirúrgica em tempo real.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <FeatureTile icon={<Activity className="h-4 w-4" />} title="Eventos" text="Trilha RPA e sala" />
                <FeatureTile icon={<DoorClosed className="h-4 w-4" />} title="Salas" text="Ocupação e ociosidade" />
                <FeatureTile icon={<ShieldCheck className="h-4 w-4" />} title="JWT" text="Acesso protegido" />
              </div>
            </section>

            <section className="rounded-[2rem] border border-border/80 bg-card/95 p-8 shadow-sm">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Acesso operacional
                </p>
                <h2 className="mt-3 text-2xl font-bold">Entrar no painel</h2>
                <p className="mt-2 text-sm text-muted-foreground">API alvo: {API_BASE_URL}</p>
              </div>

              <form className="space-y-4" onSubmit={handleLogin}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <input
                  id="email"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                />

                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <input
                  id="password"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                />

                {loadError ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {loadError}
                  </div>
                ) : null}

                <Button className="h-12 w-full text-sm font-semibold" disabled={isSubmittingLogin} type="submit">
                  {isSubmittingLogin ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {isSubmittingLogin ? "Autenticando" : "Entrar com JWT"}
                </Button>
              </form>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(46,141,139,0.20),transparent_25%),radial-gradient(circle_at_85%_5%,rgba(255,138,79,0.22),transparent_22%),linear-gradient(180deg,#f9fdfd_0%,#eef4f4_100%)]" />
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16 pt-10 sm:px-10 lg:px-12">
        <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Simple Solutions Platform
            </p>
            <h1 className="text-balance text-3xl font-extrabold leading-tight sm:text-5xl">SIMPLE SURGERY</h1>
            <p className="mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
              Dashboard autenticado com JWT para monitorar salas, fila cirúrgica e eficiência operacional.
            </p>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Sessão ativa</p>
            <p className="mt-1 text-sm font-semibold">{session.user.full_name}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {session.user.role}
              </span>
              <Button onClick={() => void hydrateAll(session.accessToken, session.user)} size="sm" variant="secondary">
                Atualizar
              </Button>
              <Button onClick={handleLogout} size="sm" variant="outline">
                Sair
              </Button>
            </div>
          </div>
        </header>

        {isBootstrapping ? (
          <section className="mb-8 rounded-3xl border border-border/80 bg-card/95 p-5 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando dados operacionais protegidos...
            </div>
          </section>
        ) : null}

        {actionMessage ? <InfoBanner variant="success">{actionMessage}</InfoBanner> : null}
        {actionError ? <InfoBanner variant="error">{actionError}</InfoBanner> : null}

        {!payload.apiAvailable && !isBootstrapping ? (
          <section className="mb-8 rounded-3xl border border-amber-300/70 bg-amber-50/90 p-5 text-amber-950 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">API autenticada ainda não respondeu com dados.</p>
                <p className="mt-1 text-sm text-amber-900/80">
                  A sessão JWT foi aceita, mas o dashboard ainda não recebeu overview, salas ou cirurgias da API.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={<Activity className="h-4 w-4" />} label="Cirurgias totais" value={String(overview.total_surgeries)} hint="Volume monitorado pelo event engine" />
          <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Tempo médio RPA" value={formatMinutes(overview.avg_rpa_minutes)} hint="Tempo médio entre entrada e saída da RPA" />
          <MetricCard icon={<DoorClosed className="h-4 w-4" />} label="Salas monitoradas" value={String(payload.rooms.length)} hint="Ocupação e sala parada por ambiente" />
          <MetricCard icon={<Stethoscope className="h-4 w-4" />} label="Cirurgias em curso" value={String(overview.surgeries_in_progress)} hint="Casos ativos na trilha operacional" />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Painel de salas</h2>
                <p className="mt-2 text-sm text-muted-foreground">Visão de disponibilidade, ocupação do dia e janela de ociosidade por sala.</p>
              </div>
              <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {payload.rooms.filter((room) => room.status === "occupied").length} ocupadas agora
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {payload.rooms.length > 0 ? (
                payload.rooms.map((room) => (
                  <article key={room.room_id} className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold">{room.room_name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Status atual: {statusLabels[room.status] ?? room.status}</p>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <RoomStat label="Ocupação" value={formatMinutes(room.occupancy_minutes_today)} />
                        <RoomStat label="Ociosidade" value={formatMinutes(room.idle_minutes_today)} />
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(room.occupancy_minutes_today, 100)}%` }} />
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Nenhuma sala encontrada" description="As salas aparecerão aqui quando o backend receber dados operacionais." />
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm">
            <h2 className="text-xl font-bold">Indicadores de eficiência</h2>
            <p className="mt-2 text-sm text-muted-foreground">A tabela central operational_events alimenta status, tempos e auditoria do centro cirúrgico.</p>
            <div className="mt-5 space-y-4">
              <KpiRow label="Concluídas" value={String(overview.surgeries_completed)} />
              <KpiRow label="Tempo médio de sala" value={formatMinutes(overview.avg_room_minutes)} />
              <KpiRow label="API base" value="/api/v1" mono />
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4 font-mono text-xs leading-relaxed text-foreground/90">
              <pre>{`GET /api/v1/auth/me
Authorization: Bearer <jwt>

POST /api/v1/events
{
  "surgery_id": "uuid",
  "event_type": "room_entry"
}`}</pre>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Criar cirurgia</h2>
                <p className="mt-1 text-sm text-muted-foreground">Cadastro operacional protegido por JWT.</p>
              </div>
              <Plus className="h-5 w-5 text-primary" />
            </div>

            <form className="space-y-4" onSubmit={handleCreateSurgery}>
              <div>
                <FieldLabel htmlFor="patient_id">Paciente</FieldLabel>
                <select id="patient_id" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={surgeryForm.patient_id} onChange={(event) => setSurgeryForm((current) => ({ ...current, patient_id: event.target.value }))}>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="room_id">Sala</FieldLabel>
                <select id="room_id" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={surgeryForm.room_id} onChange={(event) => setSurgeryForm((current) => ({ ...current, room_id: event.target.value }))}>
                  {roomsCatalog.map((room) => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="surgeon_name">Cirurgião</FieldLabel>
                <input id="surgeon_name" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={surgeryForm.surgeon_name} onChange={(event) => setSurgeryForm((current) => ({ ...current, surgeon_name: event.target.value }))} required />
              </div>

              <div>
                <FieldLabel htmlFor="procedure_name">Procedimento</FieldLabel>
                <input id="procedure_name" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={surgeryForm.procedure_name} onChange={(event) => setSurgeryForm((current) => ({ ...current, procedure_name: event.target.value }))} required />
              </div>

              <div>
                <FieldLabel htmlFor="scheduled_start">Início previsto</FieldLabel>
                <input id="scheduled_start" type="datetime-local" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={surgeryForm.scheduled_start} onChange={(event) => setSurgeryForm((current) => ({ ...current, scheduled_start: event.target.value }))} />
              </div>

              <Button className="w-full" type="submit" disabled={isSavingSurgery || !surgeryForm.patient_id || !surgeryForm.room_id}>
                {isSavingSurgery ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isSavingSurgery ? "Salvando" : "Criar cirurgia"}
              </Button>
            </form>
          </section>

          <section className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Registrar evento</h2>
                <p className="mt-1 text-sm text-muted-foreground">Atualiza status e tempos operacionais automaticamente.</p>
              </div>
              <Activity className="h-5 w-5 text-primary" />
            </div>

            <form className="space-y-4" onSubmit={handleCreateEvent}>
              <div>
                <FieldLabel htmlFor="event_surgery_id">Cirurgia</FieldLabel>
                <select id="event_surgery_id" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={eventForm.surgery_id} onChange={(event) => setEventForm((current) => ({ ...current, surgery_id: event.target.value }))}>
                  {payload.surgeries.map((surgery) => (
                    <option key={surgery.id} value={surgery.id}>
                      {`${surgery.procedure_name} - ${roomsById.get(surgery.room_id) ?? shortId(surgery.room_id)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="event_type">Evento</FieldLabel>
                <select id="event_type" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={eventForm.event_type} onChange={(event) => setEventForm((current) => ({ ...current, event_type: event.target.value }))}>
                  {eventOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="occurred_at">Horário do evento (opcional)</FieldLabel>
                <input id="occurred_at" type="datetime-local" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={eventForm.occurred_at} onChange={(event) => setEventForm((current) => ({ ...current, occurred_at: event.target.value }))} />
              </div>

              <Button className="w-full" type="submit" disabled={isSavingEvent || !eventForm.surgery_id}>
                {isSavingEvent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isSavingEvent ? "Registrando" : "Registrar evento"}
              </Button>
            </form>
          </section>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Fila cirúrgica</h2>
                <p className="mt-2 text-sm text-muted-foreground">Lista operacional de cirurgias para acompanhamento do dia.</p>
              </div>
              <Button onClick={() => void hydrateAll(session.accessToken, session.user)} variant="secondary">Atualizar leitura</Button>
            </div>

            <div className="mt-5 space-y-3">
              {payload.surgeries.length > 0 ? (
                payload.surgeries.slice(0, 6).map((surgery) => (
                  <article key={surgery.id} className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold">{surgery.procedure_name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{surgery.surgeon_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{statusLabels[surgery.status] ?? surgery.status}</span>
                        <span className="font-mono text-xs text-muted-foreground">{shortId(surgery.id)}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                      <span>Início previsto: {formatDateTime(surgery.scheduled_start)}</span>
                      <span>Tempo RPA: {formatMinutes(surgery.rpa_duration_minutes)}</span>
                      <span>Tempo total: {formatMinutes(surgery.total_operational_minutes)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Sem cirurgias carregadas" description="Assim que o backend tiver registros, a fila operacional aparecerá aqui." />
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/95 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Timeline e analytics</h2>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="analytics_period_days">Período</FieldLabel>
                  <select
                    id="analytics_period_days"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={analyticsPeriodDays}
                    onChange={(event) => setAnalyticsPeriodDays(event.target.value)}
                  >
                    {analyticsPeriodOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor="analytics_room_id">Sala</FieldLabel>
                  <select
                    id="analytics_room_id"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={analyticsRoomId}
                    onChange={(event) => setAnalyticsRoomId(event.target.value)}
                  >
                    <option value="">Todas as salas</option>
                    {roomsCatalog.map((room) => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Sala parada total</p>
              <p className="mt-1 text-2xl font-extrabold">{formatMinutes(idleAnalytics?.total_idle_minutes ?? null)}</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {isLoadingAnalytics ? (
                  <div className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Atualizando analytics...
                  </div>
                ) : null}
                {(idleAnalytics?.rooms ?? []).slice(0, 3).map((room) => (
                  <div key={room.room_id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                    <span>{room.room_name}</span>
                    <span className="font-semibold text-foreground">{formatMinutes(room.idle_minutes)}</span>
                  </div>
                ))}
                {(idleAnalytics?.rooms ?? []).length === 0 ? <span>Sem dados de ociosidade ainda.</span> : null}
              </div>
            </div>

            <div className="mt-4">
              <FieldLabel htmlFor="timeline_surgery_id">Timeline da cirurgia</FieldLabel>
              <select
                id="timeline_surgery_id"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={selectedTimelineSurgeryId}
                onChange={(event) => setSelectedTimelineSurgeryId(event.target.value)}
              >
                {payload.surgeries.map((surgery) => (
                  <option key={surgery.id} value={surgery.id}>
                    {`${surgery.procedure_name} - ${shortId(surgery.id)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-2">
              {isLoadingTimeline ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando timeline...
                </div>
              ) : null}
              {validatedTimeline.length ? (
                validatedTimeline.map((entry, index) => (
                  <div key={`${entry.item.event_type}-${entry.item.occurred_at}-${index}`} className="rounded-xl border border-border bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{entry.item.event_type}</p>
                      <span className={entry.isValid ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800" : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800"}>
                        {entry.isValid ? "sequência ok" : "fora de ordem"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(entry.item.occurred_at)}</p>
                    {!entry.isValid ? (
                      <p className="mt-1 text-xs text-muted-foreground">Esperado: <strong>{entry.expectedEvent}</strong></p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background/60 px-3 py-3 text-sm text-muted-foreground">
                  Sem eventos para a cirurgia selecionada.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoBanner({ children, variant }: { children: ReactNode; variant: "success" | "error" }) {
  const classes = variant === "success"
    ? "mb-6 rounded-2xl border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    : "mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive";
  return <div className={classes}>{children}</div>;
}

function FeatureTile({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-3xl border border-border/70 bg-background/75 p-4 shadow-sm">
      <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </article>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-medium text-foreground" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function MetricCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <article className="rounded-3xl border border-border/70 bg-card/95 p-5 shadow-sm">
      <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

function RoomStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function KpiRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm font-semibold" : "text-sm font-semibold"}>{value}</span>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background/60 p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function formatMinutes(value: number | null | undefined): string {
  if (value == null) return "--";
  return `${Math.round(value)} min`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "--";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function buildTimelineValidation(timeline: { event_type: string; occurred_at: string; payload: Record<string, unknown> | null }[]) {
  let previousIndex = -1;

  return timeline.map((item) => {
    const expectedIndex = Math.min(previousIndex + 1, eventOptions.length - 1);
    const currentIndex = eventOptions.indexOf(item.event_type);
    const isValid = currentIndex === expectedIndex;
    const expectedEvent = eventOptions[expectedIndex] ?? eventOptions[0];

    if (currentIndex >= 0) {
      previousIndex = currentIndex;
    }

    return { item, isValid, expectedEvent };
  });
}
