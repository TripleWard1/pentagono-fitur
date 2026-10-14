"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Tv2, Wifi, WifiOff, ArrowRight, Sparkles } from "lucide-react";
import {
  firebaseConfigured, ensureAnonymousSignIn, subscribeReservations, LOCAL_STORAGE_KEY,
} from "@/lib/firebase";
import type { Reservation } from "@/lib/firebase";

const DAYS = [
  { dow: "TERÇA-FEIRA", date: "19", short: "Ter. 19", compact: "TER. 19" },
  { dow: "QUARTA-FEIRA", date: "20", short: "Qua. 20", compact: "QUA. 20" },
  { dow: "QUINTA-FEIRA", date: "21", short: "Qui. 21", compact: "QUI. 21" },
  { dow: "SEXTA-FEIRA", date: "22", short: "Sex. 22", compact: "SEX. 22" },
  { dow: "SÁBADO", date: "23", short: "Sáb. 23", compact: "SÁB. 23" },
  { dow: "DOMINGO", date: "24", short: "Dom. 24", compact: "DOM. 24" },
];
const TIMES = Array.from({ length: 18 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
type TownMeta = { name: string; color: string; logo: string };
const MUNICIPALITIES: TownMeta[] = [
  { name: "Braga", color: "#087443", logo: "https://i.imgur.com/2MEyi4w.png" },
  { name: "Guimarães", color: "#f2b400", logo: "https://i.imgur.com/zMV4mih.png" },
  { name: "Vila Nova de Famalicão", color: "#df1427", logo: "https://i.imgur.com/6Kt2Xy7.png" },
  { name: "Viana do Castelo", color: "#087a98", logo: "https://i.imgur.com/xNrj977.png" },
  { name: "Barcelos", color: "#55595c", logo: "https://i.imgur.com/e5ntTlW.png" },
];
const pentagonoLogo = "/pentagono-logo-original.png";
function getMeta(name: string) { return MUNICIPALITIES.find((item) => item.name === name) || MUNICIPALITIES[0]; }
function townSlug(name: string) {
  if (name === "Guimarães") return "guimaraes";
  if (name === "Vila Nova de Famalicão") return "famalicao";
  if (name === "Viana do Castelo") return "viana";
  return name.toLowerCase();
}
function endTime(time: string) { const index = TIMES.indexOf(time); return index >= 0 ? TIMES[index + 1] || "19:00" : "19:00"; }
function startDateTime(item: Reservation) {
  const [hours, minutes] = item.timeSlot.split(":").map(Number);
  return new Date(2027, 0, 19 + item.dayIndex, hours || 0, minutes || 0, 0, 0);
}
function displayDate(item: Reservation) {
  const day = DAYS[item.dayIndex];
  return day ? `${day.dow}, ${day.date} JAN 2027` : "FITUR 2027";
}
function currentFiturDay(now: Date) {
  const start = new Date(2027, 0, 19, 0, 0, 0, 0);
  const endExclusive = new Date(2027, 0, 25, 0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (today < start.getTime()) return 0;
  if (today >= endExclusive.getTime()) return 5;
  return Math.min(5, Math.max(0, Math.floor((today - start.getTime()) / 86_400_000)));
}
function splitIntoPages(items: Reservation[], pageSize: number) {
  const result: Reservation[][] = [];
  for (let i = 0; i < items.length; i += pageSize) result.push(items.slice(i, i + pageSize));
  return result;
}

export default function StandAgendaScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sync, setSync] = useState<"local" | "connecting" | "online" | "error">("connecting");
  const [pageIndex, setPageIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    const clock = window.setInterval(updateTime, 15_000);
    if (!firebaseConfigured) {
      try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) setReservations(JSON.parse(local) as Reservation[]);
      } catch { /* Ignora armazenamento local inválido. */ }
      setSync("local");
      const onStorage = (event: StorageEvent) => {
        if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
          try { setReservations(JSON.parse(event.newValue) as Reservation[]); } catch { /* Ignora dados inválidos. */ }
        }
      };
      window.addEventListener("storage", onStorage);
      return () => { window.clearInterval(clock); window.removeEventListener("storage", onStorage); };
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    ensureAnonymousSignIn().then(() => {
      if (cancelled) return;
      unsubscribe = subscribeReservations((items) => { setReservations(items); setSync("online"); }, () => setSync("error"));
    }).catch(() => { if (!cancelled) setSync("error"); });
    return () => { cancelled = true; unsubscribe?.(); window.clearInterval(clock); };
  }, []);

  const focusDayIndex = currentFiturDay(now);
  const inFiturWeek = now.getTime() >= new Date(2027, 0, 19).getTime() && now.getTime() < new Date(2027, 0, 25).getTime();
  const programmeFinished = now.getTime() >= new Date(2027, 0, 24, 19, 0, 0, 0).getTime();
  const focusDay = DAYS[focusDayIndex];

  const focusItems = useMemo(() => reservations
    .filter((item) => item.dayIndex === focusDayIndex)
    .sort((a, b) => TIMES.indexOf(a.timeSlot) - TIMES.indexOf(b.timeSlot)), [reservations, focusDayIndex]);
  // Keep the original compact 2x2 activity layout. Long descriptions wrap vertically
  // inside each capsule instead of switching the main agenda to full-width cards.
  const focusPages = useMemo(() => splitIntoPages(focusItems, 4), [focusItems]);
  const currentItems = focusPages[pageIndex] || focusPages[0] || [];

  const nextAction = useMemo(() => reservations
    .map((item) => ({ item, start: startDateTime(item) }))
    .filter(({ start }) => start.getTime() >= now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0]?.item || null,
  [reservations, now]);

  useEffect(() => { setPageIndex(0); }, [focusDayIndex]);
  useEffect(() => {
    setPageIndex((current) => focusPages.length ? current % focusPages.length : 0);
    if (focusPages.length < 2) return;
    const rotation = window.setInterval(() => setPageIndex((current) => (current + 1) % focusPages.length), 16_000);
    return () => window.clearInterval(rotation);
  }, [focusPages.length, focusDayIndex]);

  const formattedTime = now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const focusDateLabel = `${focusDay.dow} · ${focusDay.date} DE JANEIRO`;
  const mainTitle = programmeFinished ? "Agenda da FITUR 2027" : inFiturWeek ? "Hoje no Pentágono" : "A agenda do Pentágono";
  const eyebrowText = programmeFinished ? "PROGRAMAÇÃO CONCLUÍDA · FITUR 2027" : inFiturWeek ? focusDateLabel : `A PARTIR DE ${focusDateLabel}`;

  return <main className="screen-app screen-app-v11 screen-app-v12">
    <header className="screen-header">
      <div className="screen-brand"><img src={pentagonoLogo} alt="Pentágono Urbano" /><span className="screen-divider" /><div><strong>PENTÁGONO URBANO</strong><small>FITUR 2027 · IFEMA MADRID</small></div></div>
      <div className="screen-status"><span className={`screen-connection ${sync}`}><i />{sync === "online" ? <><Wifi size={17} /> Atualizado em tempo real</> : sync === "connecting" ? <>A ligar à agenda…</> : sync === "local" ? <><WifiOff size={17} /> Pré-visualização local</> : <><WifiOff size={17} /> Sem ligação à agenda</>}</span><span className="screen-clock"><Clock3 size={17} />{formattedTime}</span></div>
    </header>
    <div className="screen-ribbon" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <section className="screen-main screen-main-v11 screen-main-v12">
      <div className="screen-kicker"><Tv2 size={16} /> PROGRAMAÇÃO DO STAND <span className="screen-kicker-dot" /> CINCO MUNICÍPIOS, UM DESTINO</div>
      <div className="screen-title-row screen-title-row-v12">
        <div><p>{eyebrowText}</p><h1>{mainTitle}</h1><span className="screen-focus-note">{programmeFinished ? "Obrigado por acompanhar o Pentágono Urbano" : inFiturWeek ? "Programação do dia · Atualizada em tempo real" : "Programação do primeiro dia · Atualizada em tempo real"}</span></div>
        <div className="screen-date-stamp"><CalendarDays size={22} /><span>19—24<strong>JAN 2027</strong></span></div>
      </div>

      <section className="screen-next-action" aria-live="polite" aria-label="Próxima ação">
        <div className="screen-next-label"><Sparkles size={16} /> <span>PRÓXIMA AÇÃO</span><i /></div>
        {nextAction ? (() => {
          const meta = getMeta(nextAction.municipality);
          return <div className="screen-next-body" style={{ "--town": meta.color } as React.CSSProperties}>
            <img className="screen-next-watermark" src={meta.logo} alt="" aria-hidden="true" />
            <div className={`screen-next-logo screen-next-logo-${townSlug(meta.name)}`}><img src={meta.logo} alt={`Logótipo de ${meta.name}`} /><span>{meta.name}</span></div>
            <div className="screen-next-copy"><div className="screen-next-time"><strong>{nextAction.timeSlot}</strong><span>— {endTime(nextAction.timeSlot)}</span><i /><small>{displayDate(nextAction)}</small></div><h2>{nextAction.actionName}</h2>{nextAction.notes?.trim() && <p><span>DESCRIÇÃO DA AÇÃO</span>{nextAction.notes}</p>}</div>
            <ArrowRight className="screen-next-arrow" size={28} />
          </div>;
        })() : <div className="screen-next-empty"><strong>{programmeFinished ? "Programa concluído" : "Ainda não há próximas ações marcadas"}</strong><span>{programmeFinished ? "Obrigado por visitar o Pentágono Urbano." : "As novas reservas aparecerão automaticamente neste ecrã."}</span></div>}
      </section>

      <div className="screen-activity-heading"><strong>{programmeFinished ? `Último dia · ${focusDay.dow.toLocaleLowerCase("pt-PT")}` : inFiturWeek ? `Atividades de ${focusDay.dow.toLocaleLowerCase("pt-PT")}` : `Primeiro dia · ${focusDay.dow.toLocaleLowerCase("pt-PT")}`}</strong><span>{focusItems.length} {focusItems.length === 1 ? "atividade" : "atividades"}{focusPages.length > 1 ? ` · Página ${pageIndex + 1} de ${focusPages.length}` : ""}</span></div>
      {currentItems.length ? <div className="screen-activities screen-activities-v12" style={{ gridTemplateColumns: currentItems.length <= 2 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gridTemplateRows: `repeat(${Math.ceil(currentItems.length / (currentItems.length <= 2 ? 1 : 2))}, minmax(0, 1fr))` }}>
        {currentItems.map((item) => {
          const meta = getMeta(item.municipality);
          return <article className="screen-activity screen-activity-v11" key={item.id} style={{ "--town": meta.color } as React.CSSProperties}>
            <img className="screen-activity-watermark" src={meta.logo} alt="" aria-hidden="true" />
            <div className="screen-activity-time"><strong>{item.timeSlot}</strong><span>ATÉ {endTime(item.timeSlot)}</span><i>FITUR 2027</i></div>
            <div className="screen-activity-main"><div className={`screen-town screen-town-${townSlug(item.municipality)}`}><img src={meta.logo} alt={`Logótipo do Município de ${item.municipality}`} loading="eager" /><span>{item.municipality}</span></div><h2>{item.actionName}</h2>{item.notes?.trim() && <p className="screen-activity-description"><span>DESCRIÇÃO</span>{item.notes}</p>}{item.responsible?.trim() && <small className="screen-activity-responsible">Com {item.responsible}</small>}</div>
            <div className="screen-activity-marker" aria-hidden="true" />
          </article>;
        })}
      </div> : <div className="screen-focus-empty"><strong>Ainda sem atividades neste dia</strong><span>As atividades agendadas para {focusDay.short} aparecerão aqui.</span></div>}

      <div className="screen-pagination"><div>{DAYS.map((day, index) => <span key={day.date} className={focusDayIndex === index ? "active" : ""} />)}</div><p>Consulte a equipa do município para mais informações.</p><small>{focusPages.length > 1 ? "PÁGINAS DO DIA EM ROTAÇÃO AUTOMÁTICA" : "ATUALIZAÇÃO AUTOMÁTICA"}</small></div>
    </section>
    <footer className="screen-footer"><span>BRAGA <i /> GUIMARÃES <i /> VILA NOVA DE FAMALICÃO <i /> VIANA DO CASTELO <i /> BARCELOS</span><strong>UM TERRITÓRIO, CINCO MUNICÍPIOS</strong></footer>
  </main>;
}
