"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarDays,
  ChartColumnBig,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DoorClosed,
  FileText,
  History,
  House,
  LucideDot,
  LoaderCircle,
  Plus,
  QrCode,
  Route,
  ScanLine,
  ScanSearch,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
const THEME_STORAGE_KEY = "simple-surgery:theme-mode";

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

type ThemeMode = "dark" | "light";

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

type NavSection = "dashboard" | "rooms" | "patients" | "timeline" | "scanner" | "analytics" | "documents" | "settings";

const scannerEventOptions = [
  { key: "rpa_entry", label: "Entrada RPA" },
  { key: "rpa_exit", label: "Saída RPA" },
  { key: "room_entry", label: "Entrada Sala" },
  { key: "room_exit", label: "Saída Sala" },
  { key: "cc_exit", label: "Saída CC" },
];

const scannerFeedbackDetails = {
  success: {
    title: "Sucesso operacional",
    subtitle: "Evento registrado com timestamp e auditoria completa.",
    chipClass: "border-lime-400/45 bg-lime-300/18 text-foreground",
  },
  attention: {
    title: "Atenção no fluxo",
    subtitle: "Evento fora da sequência padrão. Revisar antes de confirmar.",
    chipClass: "border-amber-400/45 bg-amber-300/18 text-foreground",
  },
  error: {
    title: "Erro de leitura",
    subtitle: "QR não reconhecido. Reposicione a câmera e tente novamente.",
    chipClass: "border-rose-400/45 bg-rose-300/18 text-foreground",
  },
} as const;

const dashboardNav: { key: NavSection; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: House },
  { key: "rooms", label: "Salas", icon: BedDouble },
  { key: "patients", label: "Pacientes", icon: Users },
  { key: "timeline", label: "Timeline", icon: Route },
  { key: "scanner", label: "Scanner", icon: ScanLine },
  { key: "analytics", label: "Analytics", icon: ChartColumnBig },
  { key: "documents", label: "Documentos", icon: FileText },
  { key: "settings", label: "Configurações", icon: Settings },
];

export function DashboardApp() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [payload, setPayload] = useState<DashboardPayload>(emptyPayload);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [roomsCatalog, setRoomsCatalog] = useState<OperatingRoom[]>([]);
  const [idleAnalytics, setIdleAnalytics] = useState<IdleTimeResponse | null>(null);
  const [timelineData, setTimelineData] = useState<SurgeryTimelineResponse | null>(null);
  const [selectedTimelineSurgeryId, setSelectedTimelineSurgeryId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
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
  const [scannerStep, setScannerStep] = useState<string>("rpa_entry");
  const [scannerFeedback, setScannerFeedback] = useState<"success" | "attention" | "error">("success");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");

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

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setThemeMode(storedTheme);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

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
    if (!selectedRoomId && payload.rooms.length > 0) {
      setSelectedRoomId(payload.rooms[0].room_id);
      return;
    }

    if (!selectedRoomId && roomsCatalog.length > 0) {
      setSelectedRoomId(roomsCatalog[0].id);
    }
  }, [payload.rooms, roomsCatalog, selectedRoomId]);

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

  const timelineSurgery = timelineData?.surgery ?? payload.surgeries.find((item) => item.id === selectedTimelineSurgeryId) ?? null;
  const timelinePatient = patients.find((item) => item.id === timelineSurgery?.patient_id) ?? null;

  const selectedRoomSnapshot = payload.rooms.find((room) => room.room_id === selectedRoomId) ?? null;
  const selectedRoomName = selectedRoomSnapshot?.room_name ?? roomsCatalog.find((room) => room.id === selectedRoomId)?.name ?? "Sala";
  const roomSurgeries = payload.surgeries.filter((surgery) => surgery.room_id === selectedRoomId);
  const activeRoomSurgery = roomSurgeries.find((surgery) => surgery.status !== "completed") ?? roomSurgeries[0] ?? null;
  const nextRoomSurgery = roomSurgeries.find((surgery) => surgery.id !== activeRoomSurgery?.id) ?? null;
  const roomPatient = patients.find((patient) => patient.id === activeRoomSurgery?.patient_id) ?? null;

  const roomTimelineSteps = [
    { label: "Entrada RPA", occurredAt: activeRoomSurgery?.rpa_entry_at },
    { label: "Entrada Sala", occurredAt: activeRoomSurgery?.room_entry_at },
    { label: "Início cirurgia", occurredAt: activeRoomSurgery?.room_entry_at },
    { label: "Saída Sala", occurredAt: activeRoomSurgery?.room_exit_at },
    { label: "Saída CC", occurredAt: activeRoomSurgery?.cc_exit_at },
  ];

  const dashboardDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date());

  const sectionTitle = activeSection === "scanner"
    ? "Scanner QR Code"
    : activeSection === "rooms"
      ? selectedRoomName
    : activeSection === "timeline"
      ? "Timeline do Paciente"
      : activeSection === "settings"
        ? "Configurações"
      : "Dashboard";

  const sectionSubtitle = activeSection === "scanner"
    ? "Registro rápido de eventos operacionais com feedback visual imediato para o fluxo da cirurgia."
    : activeSection === "rooms"
      ? "Painel detalhado da sala com status atual, paciente e cronologia operacional."
    : activeSection === "timeline"
      ? "Rastreamento completo do fluxo cirúrgico com sequência de eventos e tempos operacionais."
      : activeSection === "settings"
        ? "Personalize aparência e preferências visuais mantendo a mesma identidade cromática da plataforma."
      : "Centro Cirúrgico - visão operacional do dia com salas, fila e eventos em tempo real.";

  const sectionBadge = activeSection === "scanner"
    ? "Ambiente de captura"
    : activeSection === "timeline"
      ? "Rastreabilidade cirúrgica"
      : activeSection === "rooms"
        ? "Operacao por sala"
      : activeSection === "settings"
        ? "Preferências"
        : "Visão geral";

  function handleThemeChange(nextTheme: ThemeMode) {
    setThemeMode(nextTheme);
  }

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
      <div className="relative flex min-h-screen flex-col overflow-hidden text-foreground">
        <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="ss-panel rounded-[2rem] p-8">
              <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                SIMPLE SOLUTIONS
              </p>
              <h1 className="ss-title mt-5">SIMPLE SURGERY</h1>
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

            <section className="ss-panel rounded-[2rem] p-8">
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
                  className="h-12 w-full rounded-2xl border border-border bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                />

                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <input
                  id="password"
                  className="h-12 w-full rounded-2xl border border-border bg-background/70 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                />

                {loadError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {loadError}
                  </div>
                ) : null}

                <Button className="h-12 w-full border border-amber-300/30 bg-amber-400/80 text-sm font-semibold text-neutral-950 hover:bg-amber-300" disabled={isSubmittingLogin} type="submit">
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
    <div className="relative min-h-screen text-foreground">
      <div className="mx-auto grid w-full max-w-[1680px] gap-4 px-3 py-3 lg:grid-cols-[244px_1fr] lg:px-5">
        <aside className="ss-panel hidden p-4 lg:flex lg:flex-col">
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-5">
            <p className="font-heading text-4xl tracking-[0.18em] text-amber-200">SIMPLE</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-amber-300/85">Surgery</p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Copiloto Operacional</p>
          </div>

          <nav className="mt-5 space-y-1.5">
            {dashboardNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.label}
                  className={isActive
                    ? (themeMode === "light"
                      ? "flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/15 px-3 py-2.5 text-sm font-semibold text-foreground shadow-[inset_0_0_0_1px_rgba(120,150,80,0.18)]"
                      : "flex w-full items-center gap-3 rounded-xl border border-lime-300/30 bg-lime-300/20 px-3 py-2.5 text-sm font-semibold text-lime-100 shadow-[inset_0_0_0_1px_rgba(180,224,120,0.16)]")
                    : "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition duration-200 hover:border-border hover:bg-background/70 hover:text-foreground"}
                  onClick={() => setActiveSection(item.key)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Sessão ativa</p>
            <p className="mt-2 text-sm font-semibold">{session.user.full_name}</p>
            <p className="text-xs text-muted-foreground">{session.user.role}</p>
          </div>
        </aside>

        <main className="space-y-6 pb-6 ss-fade-in">
        <header className="ss-panel mb-1 flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-3 ss-chip">
              Simple Solutions Platform
            </p>
            <h1 className="ss-title text-balance leading-tight">{sectionTitle}</h1>
            <p className="mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
              {sectionSubtitle}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <LucideDot className="h-4 w-4 text-lime-300" />
              Atualização em tempo real
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto] lg:items-start">
            <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Data</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-amber-300" />{dashboardDate}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Profissional</p>
              <p className="mt-1 text-sm font-semibold">{session.user.full_name}</p>
              <p className="text-xs text-muted-foreground">{session.user.email}</p>
            </div>
            <div className="mt-1 flex items-center gap-2 sm:col-span-2">
              <span className="ss-chip">{sectionBadge}</span>
              <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
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

        <nav className="ss-panel flex gap-2 overflow-x-auto p-2 lg:hidden">
          {dashboardNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={`mobile-${item.key}`}
                className={isActive
                  ? (themeMode === "light"
                    ? "inline-flex shrink-0 items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-3 py-2 text-xs font-semibold text-foreground"
                    : "inline-flex shrink-0 items-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/20 px-3 py-2 text-xs font-semibold text-lime-100")
                  : "inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground"}
                onClick={() => setActiveSection(item.key)}
                type="button"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {activeSection === "dashboard" ? (
          <>
            {isBootstrapping ? (
              <section className="ss-panel mb-8 p-5">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Carregando dados operacionais protegidos...
                </div>
              </section>
            ) : null}

            {actionMessage ? <InfoBanner variant="success">{actionMessage}</InfoBanner> : null}
            {actionError ? <InfoBanner variant="error">{actionError}</InfoBanner> : null}

            {!payload.apiAvailable && !isBootstrapping ? (
              <section className={themeMode === "light"
                ? "mb-8 rounded-3xl border border-amber-400/40 bg-amber-100/70 p-5 text-amber-950 shadow-sm"
                : "mb-8 rounded-3xl border border-amber-300/40 bg-amber-300/10 p-5 text-amber-100 shadow-sm"}
              >
                <div className="flex items-start gap-3">
                  <CircleAlert className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">API autenticada ainda não respondeu com dados.</p>
                    <p className={themeMode === "light" ? "mt-1 text-sm text-amber-900/80" : "mt-1 text-sm text-amber-100/80"}>
                      A sessão JWT foi aceita, mas o dashboard ainda não recebeu overview, salas ou cirurgias da API.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<Activity className="h-4 w-4" />} label="Cirurgias totais" value={String(overview.total_surgeries)} hint="Volume monitorado pelo event engine" />
              <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Tempo médio RPA" value={formatMinutes(overview.avg_rpa_minutes)} hint="Tempo médio entre entrada e saída da RPA" />
              <MetricCard icon={<DoorClosed className="h-4 w-4" />} label="Salas monitoradas" value={String(payload.rooms.length)} hint="Ocupação e sala parada por ambiente" />
              <MetricCard icon={<Stethoscope className="h-4 w-4" />} label="Cirurgias em curso" value={String(overview.surgeries_in_progress)} hint="Casos ativos na trilha operacional" />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="ss-panel p-6">
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
                      <article key={room.room_id} className="rounded-2xl border border-border bg-background/65 p-4">
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

              <div className="ss-panel p-6">
                <h2 className="text-xl font-bold">Indicadores de eficiência</h2>
                <p className="mt-2 text-sm text-muted-foreground">A tabela central operational_events alimenta status, tempos e auditoria do centro cirúrgico.</p>
                <div className="mt-5 space-y-4">
                  <KpiRow label="Concluídas" value={String(overview.surgeries_completed)} />
                  <KpiRow label="Tempo médio de sala" value={formatMinutes(overview.avg_room_minutes)} />
                  <KpiRow label="API base" value="/api/v1" mono />
                </div>
                <div className="mt-6 rounded-2xl border border-border bg-background/65 p-4 font-mono text-xs leading-relaxed text-foreground/90">
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
              <section className="ss-panel p-6">
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

              <section className="ss-panel p-6">
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
              <div className="ss-panel p-6">
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
                      <article key={surgery.id} className="rounded-2xl border border-border bg-background/65 p-4">
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

              <div className="ss-panel p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Timeline e analytics</h2>
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-background/65 p-4">
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
                      <div key={room.room_id} className="flex items-center justify-between rounded-xl bg-secondary/70 px-3 py-2">
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
                      <div key={`${entry.item.event_type}-${entry.item.occurred_at}-${index}`} className="rounded-xl border border-border bg-background/65 px-3 py-2">
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
                    <div className="rounded-xl border border-dashed border-border bg-background/55 px-3 py-3 text-sm text-muted-foreground">
                      Sem eventos para a cirurgia selecionada.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {activeSection === "scanner" ? (
          <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="ss-panel p-5 sm:p-6 ss-stagger">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scanner QR Code</p>
                  <h2 className="mt-2 text-2xl font-semibold">Apontar para pulseira do paciente</h2>
                </div>
                <Button size="sm" variant="outline">
                  <History className="h-4 w-4" /> Histórico
                </Button>
              </div>

              <div className="rounded-3xl border border-border bg-background/70 p-4 ss-gridline">
                <div className="relative overflow-hidden rounded-2xl border border-lime-300/20 bg-[linear-gradient(135deg,#252a24_0%,#1e231e_100%)] p-5">
                  <div className="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-lime-300/60" />
                  <div className="absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-lime-300/60" />
                  <div className="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-lime-300/60" />
                  <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-lime-300/60" />

                  <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-white/90 px-4 py-3 text-neutral-900">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <div>
                        <p className="text-2xl font-semibold">M.S.</p>
                        <p className="text-sm">Maria de Souza</p>
                        <p className="text-xs text-neutral-600">Prontuário: 456789 | Sala: 01</p>
                      </div>
                      <QrCode className="h-16 w-16" />
                    </div>
                  </div>

                  <p className="mt-8 text-center text-sm text-muted-foreground">Centralize o QR Code na área indicada</p>
                </div>

                <div className={`mt-4 rounded-2xl border p-4 ${scannerFeedbackDetails[scannerFeedback].chipClass}`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-foreground">Paciente identificado</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-2xl font-semibold text-foreground">M.S.</div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">Maria de Souza</p>
                      <p className="text-sm text-muted-foreground">Cirurgião: Dr. Thiago Lima | Sala 01</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">Selecionar evento</p>
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {scannerEventOptions.map((option) => {
                      const isActive = scannerStep === option.key;
                      return (
                        <button
                          key={option.key}
                          className={isActive
                            ? "rounded-xl border border-amber-400/45 bg-amber-300/20 px-3 py-3 text-sm font-semibold text-foreground"
                            : "rounded-xl border border-border bg-background/65 px-3 py-3 text-sm text-muted-foreground hover:border-border/90 hover:text-foreground"}
                          onClick={() => setScannerStep(option.key)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button className="mt-5 h-12 w-full border border-amber-300/35 bg-amber-300/80 font-semibold text-neutral-950 hover:bg-amber-300">
                  Confirmar evento
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="ss-panel p-5 ss-stagger" style={{ animationDelay: "80ms" }}>
                <p className="rounded-xl border border-border bg-background/65 px-3 py-2 text-sm text-muted-foreground">
                  <strong className="text-foreground">{scannerFeedbackDetails[scannerFeedback].title}</strong>
                  <br />
                  {scannerFeedbackDetails[scannerFeedback].subtitle}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Estados visuais</p>
                <div className="mt-3 space-y-3">
                  <button className="w-full text-left" onClick={() => setScannerFeedback("success")} type="button">
                    <ScannerStatusCard active={scannerFeedback === "success"} icon={<CheckCircle2 className="h-5 w-5" />} title="Sucesso" text="Evento registrado com sucesso" tone="success" />
                  </button>
                  <button className="w-full text-left" onClick={() => setScannerFeedback("attention")} type="button">
                    <ScannerStatusCard active={scannerFeedback === "attention"} icon={<AlertTriangle className="h-5 w-5" />} title="Atenção" text="Sequência inesperada no fluxo" tone="warning" />
                  </button>
                  <button className="w-full text-left" onClick={() => setScannerFeedback("error")} type="button">
                    <ScannerStatusCard active={scannerFeedback === "error"} icon={<XCircle className="h-5 w-5" />} title="Erro" text="QR Code não reconhecido" tone="error" />
                  </button>
                </div>
              </div>

              <div className="ss-panel p-5 ss-stagger" style={{ animationDelay: "120ms" }}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Próximo evento sugerido</p>
                <div className="mt-3 rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-sm text-muted-foreground">Próximo passo</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xl font-semibold">Saída RPA</p>
                    <ArrowRight className="h-5 w-5 text-lime-200" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <span className="h-2 w-10 rounded-full bg-lime-300" />
                    <span className="h-2 w-10 rounded-full bg-lime-300/40" />
                    <span className="h-2 w-10 rounded-full bg-lime-300/20" />
                  </div>
                </div>
              </div>

              <div className="ss-panel p-5 ss-stagger" style={{ animationDelay: "160ms" }}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Fluxo rápido</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div className="rounded-xl border border-border bg-background/65 p-3">
                    <ScanSearch className="mb-2 h-4 w-4 text-lime-200" />
                    Escanear
                  </div>
                  <div className="rounded-xl border border-border bg-background/65 p-3">
                    <Users className="mb-2 h-4 w-4 text-lime-200" />
                    Identificar
                  </div>
                  <div className="rounded-xl border border-border bg-background/65 p-3">
                    <Activity className="mb-2 h-4 w-4 text-lime-200" />
                    Selecionar
                  </div>
                  <div className="rounded-xl border border-border bg-background/65 p-3">
                    <CheckCircle2 className="mb-2 h-4 w-4 text-lime-200" />
                    Confirmar
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === "timeline" ? (
          <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <section className="ss-panel p-5 sm:p-6 ss-stagger">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Paciente</p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      {timelinePatient?.full_name ?? "Paciente não identificado"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Prontuário: {timelinePatient?.medical_record_number ?? "--"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cirurgião: {timelineSurgery?.surgeon_name ?? "--"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Procedimento</p>
                    <p className="mt-2 text-base font-semibold">{timelineSurgery?.procedure_name ?? "--"}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Início previsto: {formatDateTime(timelineSurgery?.scheduled_start ?? null)}</p>
                    <p className="text-sm text-muted-foreground">Status: {timelineSurgery ? (statusLabels[timelineSurgery.status] ?? timelineSurgery.status) : "--"}</p>
                  </div>
                </div>
              </section>

              <section className="ss-panel p-5 sm:p-6 ss-stagger" style={{ animationDelay: "80ms" }}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Linha do tempo operacional</p>
                    <p className="mt-1 text-sm text-muted-foreground">Eventos sincronizados por cirurgia selecionada.</p>
                  </div>
                  <div className="min-w-[260px]">
                    <FieldLabel htmlFor="timeline_patient_surgery">Cirurgia monitorada</FieldLabel>
                    <select
                      id="timeline_patient_surgery"
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
                </div>

                <div className="space-y-3">
                  {isLoadingTimeline ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando timeline...
                    </div>
                  ) : null}

                  {validatedTimeline.length ? (
                    validatedTimeline.map((entry, index) => (
                      <article key={`${entry.item.event_type}-${entry.item.occurred_at}-${index}`} className="rounded-2xl border border-border bg-background/65 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{formatTimeOnly(entry.item.occurred_at)}</p>
                            <h3 className="mt-1 text-base font-semibold">{translateEventType(entry.item.event_type)}</h3>
                          </div>
                          <span className={entry.isValid
                            ? "rounded-full border border-lime-400/45 bg-lime-300/18 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground"
                            : "rounded-full border border-amber-400/45 bg-amber-300/18 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground"}
                          >
                            {entry.isValid ? "Fluxo OK" : `Esperado: ${translateEventType(entry.expectedEvent)}`}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Registrado em: {formatDateTime(entry.item.occurred_at)}</p>
                      </article>
                    ))
                  ) : (
                    <EmptyState title="Sem eventos na timeline" description="Selecione uma cirurgia com eventos para visualizar a trilha operacional." />
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Resumo de tempos</h3>
                <div className="mt-4 space-y-3">
                  <KpiRow label="Tempo na RPA" value={formatMinutes(timelineSurgery?.rpa_duration_minutes)} />
                  <KpiRow label="Tempo em sala" value={formatMinutes(timelineSurgery?.room_duration_minutes)} />
                  <KpiRow label="Tempo total no CC" value={formatMinutes(timelineSurgery?.total_operational_minutes)} />
                </div>
              </section>

              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Indicadores da cirurgia</h3>
                <div className="mt-4 space-y-3">
                  <KpiRow
                    label="Status atual"
                    value={timelineSurgery ? (statusLabels[timelineSurgery.status] ?? timelineSurgery.status) : "--"}
                  />
                  <KpiRow
                    label="Aderência ao fluxo"
                    value={validatedTimeline.length ? `${Math.round((validatedTimeline.filter((item) => item.isValid).length / validatedTimeline.length) * 100)}%` : "--"}
                  />
                  <KpiRow label="Eventos registrados" value={String(validatedTimeline.length)} />
                </div>
              </section>

              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Ações rápidas</h3>
                <div className="mt-4 grid gap-2">
                  <Button variant="secondary"><FileText className="h-4 w-4" /> Gerar relatório do caso</Button>
                  <Button variant="outline"><Activity className="h-4 w-4" /> Corrigir evento</Button>
                </div>
              </section>
            </aside>
          </section>
        ) : null}

        {activeSection === "rooms" ? (
          <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <section className="ss-panel p-5 sm:p-6 ss-stagger">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Visão da sala</p>
                  <div className="min-w-[260px]">
                    <FieldLabel htmlFor="room_detail_id">Selecionar sala</FieldLabel>
                    <select
                      id="room_detail_id"
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      value={selectedRoomId}
                      onChange={(event) => setSelectedRoomId(event.target.value)}
                    >
                      {payload.rooms.map((room) => (
                        <option key={room.room_id} value={room.room_id}>{room.room_name}</option>
                      ))}
                      {payload.rooms.length === 0 ? roomsCatalog.map((room) => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      )) : null}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-border bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Paciente atual</p>
                    <h2 className="mt-2 text-2xl font-semibold">{roomPatient?.full_name ?? "Sem paciente em sala"}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Prontuário: {roomPatient?.medical_record_number ?? "--"}</p>
                    <p className="text-sm text-muted-foreground">Procedimento: {activeRoomSurgery?.procedure_name ?? "--"}</p>
                    <p className="text-sm text-muted-foreground">Cirurgião: {activeRoomSurgery?.surgeon_name ?? "--"}</p>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status da sala</p>
                    <p className="mt-2 text-lg font-semibold">{selectedRoomSnapshot ? (statusLabels[selectedRoomSnapshot.status] ?? selectedRoomSnapshot.status) : "--"}</p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Tempo em uso hoje</span>
                        <strong className="text-foreground">{formatMinutes(selectedRoomSnapshot?.occupancy_minutes_today)}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tempo parada hoje</span>
                        <strong className="text-foreground">{formatMinutes(selectedRoomSnapshot?.idle_minutes_today)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="ss-panel p-5 sm:p-6 ss-stagger" style={{ animationDelay: "80ms" }}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Linha do tempo da sala</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-5">
                  {roomTimelineSteps.map((step) => {
                    const isDone = Boolean(step.occurredAt);
                    return (
                      <div key={step.label} className={isDone
                        ? "rounded-xl border border-lime-300/35 bg-lime-300/10 p-3"
                        : "rounded-xl border border-border bg-background/65 p-3"}
                      >
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{step.label}</p>
                        <p className="mt-2 text-sm font-semibold">{formatTimeOnly(step.occurredAt ?? null)}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="ss-panel p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Eventos recentes da sala</h3>
                  <span className="ss-chip">{roomSurgeries.length} cirurgias</span>
                </div>
                <div className="mt-4 space-y-3">
                  {roomSurgeries.length ? roomSurgeries.slice(0, 5).map((surgery) => (
                    <article key={surgery.id} className="rounded-2xl border border-border bg-background/65 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{surgery.procedure_name}</p>
                        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold">
                          {statusLabels[surgery.status] ?? surgery.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{surgery.surgeon_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Início previsto: {formatDateTime(surgery.scheduled_start)}</p>
                    </article>
                  )) : (
                    <EmptyState title="Sem registros operacionais" description="Quando houver cirurgias vinculadas a esta sala, elas aparecerão aqui." />
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Cronômetros e métricas</h3>
                <div className="mt-4 space-y-3">
                  <KpiRow label="Em sala" value={formatMinutes(activeRoomSurgery?.room_duration_minutes)} />
                  <KpiRow label="Tempo total no CC" value={formatMinutes(activeRoomSurgery?.total_operational_minutes)} />
                  <KpiRow label="Turnover (parada)" value={formatMinutes(selectedRoomSnapshot?.idle_minutes_today)} />
                </div>
              </section>

              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Próximo paciente</h3>
                <p className="mt-3 text-base font-semibold">
                  {nextRoomSurgery ? (patients.find((item) => item.id === nextRoomSurgery.patient_id)?.full_name ?? "Paciente sem nome") : "A definir"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nextRoomSurgery?.procedure_name ?? "Sem cirurgia na fila desta sala"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Início previsto: {formatDateTime(nextRoomSurgery?.scheduled_start ?? null)}
                </p>
              </section>

              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Alertas da sala</h3>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3">
                    Sala parada: {formatMinutes(selectedRoomSnapshot?.idle_minutes_today)}
                  </div>
                  <div className="rounded-xl border border-border bg-background/65 p-3">
                    Última atualização: {dashboardDate}
                  </div>
                </div>
              </section>
            </aside>
          </section>
        ) : null}

        {activeSection === "settings" ? (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="ss-panel p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Tema da interface</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Escolha entre Dark e Light mantendo a mesma paleta da marca.
                  </p>
                </div>
                <Settings className="h-5 w-5 text-primary" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className={themeMode === "dark"
                  ? "rounded-2xl border border-primary/45 bg-background/60 p-4 ring-2 ring-primary/25"
                  : "rounded-2xl border border-border bg-background/60 p-4"}
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Dark</p>
                  <p className="mt-2 text-lg font-semibold">Padrão operacional</p>
                  <p className="mt-1 text-sm text-muted-foreground">Contraste alto para ambientes críticos.</p>
                  <div className="mt-4 flex gap-2">
                    <span className="h-6 w-6 rounded-full border border-border bg-[oklch(0.16_0.013_85)]" />
                    <span className="h-6 w-6 rounded-full border border-border bg-[oklch(0.72_0.11_108)]" />
                    <span className="h-6 w-6 rounded-full border border-border bg-[oklch(0.72_0.11_70)]" />
                  </div>
                  <Button
                    className="mt-4 w-full"
                    onClick={() => handleThemeChange("dark")}
                    type="button"
                    variant={themeMode === "dark" ? "default" : "outline"}
                  >
                    Usar Dark
                  </Button>
                </article>

                <article className={themeMode === "light"
                  ? "rounded-2xl border border-primary/45 bg-background/60 p-4 ring-2 ring-primary/25"
                  : "rounded-2xl border border-border bg-background/60 p-4"}
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Light</p>
                  <p className="mt-2 text-lg font-semibold">Clara com a mesma paleta</p>
                  <p className="mt-1 text-sm text-muted-foreground">Leitura leve para análise e gestão.</p>
                  <div className="mt-4 flex gap-2">
                    <span className="h-6 w-6 rounded-full border border-border bg-[oklch(0.97_0.012_95)]" />
                    <span className="h-6 w-6 rounded-full border border-border bg-[oklch(0.65_0.1_108)]" />
                    <span className="h-6 w-6 rounded-full border border-border bg-[oklch(0.66_0.1_70)]" />
                  </div>
                  <Button
                    className="mt-4 w-full"
                    onClick={() => handleThemeChange("light")}
                    type="button"
                    variant={themeMode === "light" ? "default" : "outline"}
                  >
                    Usar Light
                  </Button>
                </article>
              </div>
            </div>

            <aside className="space-y-6">
              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Tema ativo</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  Atual: <strong className="text-foreground">{themeMode === "dark" ? "Dark" : "Light"}</strong>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  A preferência é salva automaticamente para os próximos acessos.
                </p>
              </section>

              <section className="ss-panel p-5">
                <h3 className="text-lg font-semibold">Paleta compartilhada</h3>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  <span className="h-8 rounded-lg border border-border bg-primary/80" />
                  <span className="h-8 rounded-lg border border-border bg-accent/80" />
                  <span className="h-8 rounded-lg border border-border bg-secondary" />
                  <span className="h-8 rounded-lg border border-border bg-muted" />
                  <span className="h-8 rounded-lg border border-border bg-background" />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Mesmos matizes, luminosidade ajustada por tema
                </p>
              </section>
            </aside>
          </section>
        ) : null}

        {activeSection !== "dashboard" && activeSection !== "scanner" && activeSection !== "timeline" && activeSection !== "rooms" && activeSection !== "settings" ? (
          <section className="ss-panel p-8">
            <h2 className="text-2xl font-semibold">Ambiente em preparação</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta área será entregue nas próximas etapas com o mesmo padrão visual do mockup.
            </p>
          </section>
        ) : null}
        </main>
      </div>
    </div>
  );
}

function InfoBanner({ children, variant }: { children: ReactNode; variant: "success" | "error" }) {
  const classes = variant === "success"
    ? "mb-6 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
    : "mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive";
  return <div className={classes}>{children}</div>;
}

function FeatureTile({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-3xl border border-border/70 bg-background/60 p-4 shadow-sm">
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
    <article className="ss-panel p-5">
      <div className="mb-4 inline-flex rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary">{icon}</div>
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

function RoomStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function KpiRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm font-semibold" : "text-sm font-semibold"}>{value}</span>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background/55 p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ScannerStatusCard({
  active,
  icon,
  title,
  text,
  tone,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  text: string;
  tone: "success" | "warning" | "error";
}) {
  const toneClass = tone === "success"
    ? "border-lime-400/45 bg-lime-300/18 text-foreground"
    : tone === "warning"
      ? "border-amber-400/45 bg-amber-300/18 text-foreground"
      : "border-rose-400/45 bg-rose-300/18 text-foreground";

  return (
    <div className={`rounded-2xl border p-4 transition ${toneClass} ${active ? "ring-2 ring-primary/30" : "opacity-85"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em]">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm">{text}</p>
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

function formatTimeOnly(value: string | null): string {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function translateEventType(eventType: string): string {
  const labels: Record<string, string> = {
    rpa_entry: "Entrada na RPA",
    rpa_exit: "Saída da RPA",
    room_entry: "Entrada na sala",
    room_exit: "Saída da sala",
    cc_exit: "Saída do centro cirúrgico",
  };

  return labels[eventType] ?? eventType;
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
