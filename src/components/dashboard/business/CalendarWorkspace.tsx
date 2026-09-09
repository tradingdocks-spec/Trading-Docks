"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  PackageCheck,
  Plus,
  Repeat2,
  Truck,
  Users,
  X,
} from "lucide-react";

import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";
import { accountStorageKey } from "@/lib/account-storage";
import { loadAccountDocument, saveAccountDocument } from "@/lib/account-documents";

type EventType = "order" | "delivery" | "event" | "shift" | "payroll";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  type: EventType;
  assignee?: string;
  notes?: string;
  recurring?: boolean;
};

const TYPE_CONFIG = {
  order: { label: "Supply order", icon: PackageCheck, className: "border-td-accent/15 bg-td-accent/[0.055] text-td-accent-text" },
  delivery: { label: "Delivery", icon: Truck, className: "border-td-accent/15 bg-td-accent/[0.055] text-td-accent-text" },
  event: { label: "Event", icon: CalendarDays, className: "border-td-violet/15 bg-td-violet/[0.055] text-td-violet" },
  shift: { label: "Employee shift", icon: Users, className: "border-td-success/15 bg-td-success/[0.055] text-td-success" },
  payroll: { label: "Payroll", icon: CreditCard, className: "border-td-warning/15 bg-td-warning/[0.055] text-td-warning" },
} satisfies Record<EventType, { label: string; icon: typeof CalendarDays; className: string }>;

export function CalendarWorkspace() {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<EventType | "all">("all");

  useEffect(() => {
    void (async () => {
      const documentKey = "business-calendar:v3";
      let stored = await loadAccountDocument<CalendarEvent[]>(documentKey);
      if (stored === null) {
        const legacyKey = await accountStorageKey("trading-docks-business-calendar-v3");
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy) {
          try {
            stored = JSON.parse(legacy) as CalendarEvent[];
            await saveAccountDocument(documentKey, stored);
          } catch {
            stored = [];
          }
          window.localStorage.removeItem(legacyKey);
        }
      }
      setEvents(stored ?? []);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = window.setTimeout(() => {
      void saveAccountDocument("business-calendar:v3", events);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [events, loaded]);

  const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const visibleEvents = events.filter((event) => filter === "all" || event.type === filter);
  const selectedEvents = visibleEvents.filter((event) => event.date === selectedDate);

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Business operations calendar"
        title="Schedule the work that keeps your business moving."
        description="Plan supply reorders, deliveries, events, employee shifts, time-card reviews, and payroll deadlines."
        icon={CalendarDays}
        actionLabel="Schedule activity"
        onAction={() => setModalOpen(true)}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.65fr]">
        <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="calendar-nav">
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center">
              <p className="text-lg font-semibold text-td-primary">
                {viewDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
              </p>
              <p className="mt-1 text-[11px] text-td-muted">Click a date to review or add activities</p>
            </div>

            <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="calendar-nav">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
            {(Object.keys(TYPE_CONFIG) as EventType[]).map((type) => (
              <FilterButton key={type} active={filter === type} onClick={() => setFilter(type)}>
                {TYPE_CONFIG[type].label}
              </FilterButton>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">
                {day}
              </div>
            ))}

            {monthGrid.map((day) => {
              const key = toDateKey(day.date);
              const dayEvents = visibleEvents.filter((event) => event.date === key);
              const selected = key === selectedDate;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={[
                    "min-h-[108px] rounded-xl border p-2 text-left transition",
                    day.inCurrentMonth
                      ? "border-td-ink/[0.055] bg-black/[0.08] hover:border-td-accent/[0.14] hover:bg-td-accent/[0.025]"
                      : "border-transparent bg-black/[0.025] opacity-30",
                    selected ? "border-td-accent/[0.2] bg-td-accent/[0.05]" : "",
                  ].join(" ")}
                >
                  <span className="text-[11px] font-semibold text-td-muted">{day.date.getDate()}</span>
                  <span className="mt-1.5 block space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={`block truncate rounded-md border px-1.5 py-1 text-[11px] ${TYPE_CONFIG[event.type].className}`}>
                        {event.startTime} · {event.title}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className={`${styles.glassPanel} rounded-[26px] p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
            Selected date
          </p>
          <h2 className="mt-2 text-lg font-semibold text-td-primary">{formatDate(selectedDate)}</h2>

          <div className="mt-5 space-y-3">
            {selectedEvents.length ? (
              selectedEvents.map((event) => (
                <EventCard key={event.id} event={event} onRemove={() => setEvents((current) => current.filter((item) => item.id !== event.id))} />
              ))
            ) : (
              <button type="button" onClick={() => setModalOpen(true)} className="w-full rounded-2xl border border-dashed border-td-ink/[0.07] bg-td-ink/[0.015] px-4 py-8 text-center">
                <CalendarDays className="mx-auto h-5 w-5 text-td-muted" />
                <p className="mt-3 text-xs font-semibold text-td-secondary">Nothing scheduled</p>
                <p className="mt-2 text-[11px] text-td-accent-text">Add an activity</p>
              </button>
            )}
          </div>
        </aside>
      </div>

      <ScheduleModal
        open={modalOpen}
        defaultDate={selectedDate}
        onClose={() => setModalOpen(false)}
        onAdd={(event) => {
          setEvents((current) => [...current, event]);
          setSelectedDate(event.date);
          setModalOpen(false);
        }}
      />

      <style jsx global>{`
        .calendar-nav {
          display: flex;
          height: 40px;
          width: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid rgb(var(--td-ink-rgb)/0.07);
          background: rgb(var(--td-ink-rgb)/0.025);
          color: var(--td-text-muted);
        }
        .calendar-input {
          height: 42px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgb(var(--td-ink-rgb)/0.075);
          background: rgb(var(--td-ink-rgb)/0.025);
          padding: 0 12px;
          color: var(--td-text-secondary);
          font-size: 12px;
          outline: none;
        }
        .calendar-input:focus {
          border-color: rgb(var(--td-accent-rgb)/0.24);
          box-shadow: 0 0 0 4px rgb(var(--td-accent-rgb)/0.045);
        }
      `}</style>
    </WorkspaceFrame>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 rounded-xl border px-3 text-[11px] font-semibold",
        active ? "border-td-accent/[0.17] bg-td-accent/[0.07] text-td-accent-text" : "border-td-ink/[0.06] bg-td-ink/[0.018] text-td-muted",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EventCard({ event, onRemove }: { event: CalendarEvent; onRemove: () => void }) {
  const config = TYPE_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <div className="rounded-2xl border border-td-ink/[0.06] bg-black/[0.08] p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${config.className}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-td-primary">{event.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-td-muted">
            <Clock3 className="h-3 w-3" />
            {event.startTime}{event.endTime ? `–${event.endTime}` : ""}
          </p>
          {event.assignee ? <p className="mt-1 text-[11px] text-td-muted">Assigned to {event.assignee}</p> : null}
        </div>
        <button type="button" onClick={onRemove} className="text-td-muted hover:text-td-danger">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ScheduleModal({
  open,
  defaultDate,
  onClose,
  onAdd,
}: {
  open: boolean;
  defaultDate: string;
  onClose: () => void;
  onAdd: (event: CalendarEvent) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [type, setType] = useState<EventType>("order");
  const [assignee, setAssignee] = useState("");
  const [recurring, setRecurring] = useState(false);

  useEffect(() => setDate(defaultDate), [defaultDate]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <button type="button" onClick={onClose} className="absolute inset-0" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onAdd({
            id: crypto.randomUUID(),
            title: title.trim(),
            date,
            startTime,
            endTime: endTime || undefined,
            type,
            assignee: assignee || undefined,
            recurring,
          });
          setTitle("");
        }}
        className="relative z-10 w-full max-w-[560px] rounded-[28px] border border-td-accent/[0.14] bg-td-surface/98 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-td-primary">Schedule activity</p>
            <p className="mt-1 text-[11px] text-td-muted">Orders, deliveries, events, shifts, or payroll.</p>
          </div>
          <button type="button" onClick={onClose} className="text-td-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Activity name" className="sm:col-span-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="calendar-input" placeholder="Reorder shipping labels" required />
          </Field>
          <Field label="Type">
            <select value={type} onChange={(event) => setType(event.target.value as EventType)} className="calendar-input">
              {(Object.keys(TYPE_CONFIG) as EventType[]).map((value) => <option key={value} value={value}>{TYPE_CONFIG[value].label}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="calendar-input" required />
          </Field>
          <Field label="Start time">
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="calendar-input" required />
          </Field>
          <Field label="End time">
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="calendar-input" />
          </Field>
          <Field label="Employee or team" className="sm:col-span-2">
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} className="calendar-input" placeholder="Alex, Fulfillment team..." />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2 text-[11px] text-td-muted">
          <input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />
          Repeat this activity
        </label>

        <button type="submit" className="mt-6 h-11 w-full rounded-xl bg-gradient-to-b from-td-accent via-td-accent to-td-accent text-xs font-semibold text-td-on-accent">
          Add to calendar
        </button>
      </form>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={className}><span className="mb-2 block text-[11px] text-td-muted">{label}</span>{children}</label>;
}

function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === month };
  });
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
