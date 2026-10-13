"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Tv2, Wifi, WifiOff } from "lucide-react";
import {
  firebaseConfigured, ensureAnonymousSignIn, subscribeReservations, LOCAL_STORAGE_KEY,
} from "@/lib/firebase";
import type { Reservation } from "@/lib/firebase";

const DAYS = [
  { dow: "TERÇA-FEIRA", date: "19", short: "Ter. 19" },
  { dow: "QUARTA-FEIRA", date: "20", short: "Qua. 20" },
  { dow: "QUINTA-FEIRA", date: "21", short: "Qui. 21" },
  { dow: "SEXTA-FEIRA", date: "22", short: "Sex. 22" },
  { dow: "SÁBADO", date: "23", short: "Sáb. 23" },
  { dow: "DOMINGO", date: "24", short: "Dom. 24" },
];
const TIMES = Array.from({ length: 18 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
type TownMeta = { name: string; color: string; logo?: string };
const MUNICIPALITIES: TownMeta[] = [
  { name: "Braga", color: "#087443", logo: "https://i.imgur.com/2MEyi4w.png" },
  { name: "Guimarães", color: "#f2b400" },
  { name: "Vila Nova de Famalicão", color: "#df1427" },
  { name: "Viana do Castelo", color: "#087a98" },
  { name: "Barcelos", color: "#55595c", logo: "https://i.imgur.com/e5ntTlW.png" },
];
const pentagonoLogo = "/pentagono-logo-original.png";
function getMeta(name: string) { return MUNICIPALITIES.find((item) => item.name === name) || MUNICIPALITIES[0]; }
function endTime(time: string) { const index = TIMES.indexOf(time); return index >= 0 ? TIMES[index + 1] || "19:00" : "19:00"; }

export default function StandScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sync, setSync] = useState<"local" | "connecting" | "online" | "error">("connecting");
  const [pageIndex, setPageIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    const clock = window.setInterval(updateTime, 30_000);
    if (!firebaseConfigured) {
      try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) setReservations(JSON.parse(local) as Reservation[]);
      } catch { /* Ignora armazenamento local inválido. */ }
      setSync("local");
      const onStorage = (event: StorageEvent) => {
        if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
          try { setReservations(JSON.parse(event.newValue) as Reservation[]); } catch { /* Ignore invalid payloads. */ }
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

  const pages = useMemo(() => {
    const result: { dayIndex: number; items: Reservation[]; part: number; parts: number }[] = [];
    DAYS.forEach((_, dayIndex) => {
      const list = reservations.filter((item) => item.dayIndex === dayIndex)
        .sort((a, b) => TIMES.indexOf(a.timeSlot) - TIMES.indexOf(b.timeSlot));
      if (!list.length) return;
      const chunks: Reservation[][] = [];
      for (let i = 0; i < list.length; i += 8) chunks.push(list.slice(i, i + 8));
      chunks.forEach((items, chunkIndex) => result.push({ dayIndex, items, part: chunkIndex + 1, parts: chunks.length }));
    });
    return result;
  }, [reservations]);

  useEffect(() => {
    setPageIndex((current) => pages.length ? current % pages.length : 0);
    if (pages.length < 2) return;
    const rotation = window.setInterval(() => setPageIndex((current) => (current + 1) % pages.length), 16_000);
    return () => window.clearInterval(rotation);
  }, [pages.length]);

  const currentPage = pages[pageIndex];
  const currentDay = currentPage ? DAYS[currentPage.dayIndex] : null;
  const formattedTime = now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return <main className="screen-app">
    <header className="screen-header">
      <div className="screen-brand"><img src={pentagonoLogo} alt="Pentágono Urbano" /><span className="screen-divider" /><div><strong>PENTÁGONO URBANO</strong><small>FITUR 2027 · IFEMA MADRID</small></div></div>
      <div className="screen-status"><span className={`screen-connection ${sync}`}><i />{sync === "online" ? <><Wifi size={17} /> Atualizado em tempo real</> : sync === "connecting" ? <>A ligar à agenda…</> : sync === "local" ? <><WifiOff size={17} /> Pré-visualização local</> : <><WifiOff size={17} /> Sem ligação à agenda</>}</span><span className="screen-clock"><Clock3 size={17} />{formattedTime}</span></div>
    </header>
    <div className="screen-ribbon" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <section className="screen-main">
      <div className="screen-kicker"><Tv2 size={16} /> PROGRAMAÇÃO DO STAND</div>
      {currentPage && currentDay ? <>
        <div className="screen-title-row"><div><p>{currentDay.dow} · {currentDay.date} DE JANEIRO</p><h1>Hoje no Pentágono</h1></div><div className="screen-date-stamp"><CalendarDays size={22} /><span>19—24<strong>JAN 2027</strong></span></div></div>
        <div className="screen-activity-heading"><strong>Agenda de atividades</strong><span>{currentPage.items.length} {currentPage.items.length === 1 ? "atividade" : "atividades"}{currentPage.parts > 1 ? ` · Página ${currentPage.part} de ${currentPage.parts}` : ""}</span></div>
        <div className="screen-activities" style={{ gridTemplateColumns: currentPage.items.length <= 2 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gridTemplateRows: `repeat(${Math.ceil(currentPage.items.length / (currentPage.items.length <= 2 ? 1 : 2))}, minmax(0, 1fr))` }}>
          {currentPage.items.map((item) => {
            const meta = getMeta(item.municipality);
            return <article className="screen-activity" key={item.id} style={{ "--town": meta.color } as React.CSSProperties}>
              <div className="screen-activity-time"><strong>{item.timeSlot}</strong><span>ATÉ {endTime(item.timeSlot)}</span></div>
              <div className="screen-activity-main"><div className={`screen-town ${meta.logo ? "screen-town-has-logo" : ""}`}>{meta.logo && <img src={meta.logo} alt={`Logótipo do Município de ${item.municipality}`} loading="eager" />}<span>{item.municipality}</span></div><h2>{item.actionName}</h2>{item.responsible && <p>{item.responsible}</p>}</div>
              <div className="screen-activity-marker" aria-hidden="true" />
            </article>;
          })}
        </div>
        <div className="screen-pagination"><div>{DAYS.map((day, index) => <span key={day.date} className={currentPage.dayIndex === index ? "active" : ""} />)}</div><p>Consulte a equipa do município para mais informações.</p><small>ATUALIZAÇÃO AUTOMÁTICA</small></div>
      </> : <div className="screen-empty"><img src={pentagonoLogo} alt="Pentágono Urbano" /><h1>As próximas experiências começam aqui.</h1><p>Estamos a preparar a programação do Pentágono Urbano na FITUR 2027.</p><div className="screen-empty-towns">{MUNICIPALITIES.map((town) => <span key={town.name} style={{ "--town": town.color } as React.CSSProperties}>{town.name}</span>)}</div></div>}
    </section>
    <footer className="screen-footer"><span>BRAGA <i /> GUIMARÃES <i /> VILA NOVA DE FAMALICÃO <i /> VIANA DO CASTELO <i /> BARCELOS</span><strong>UM TERRITÓRIO, CINCO MUNICÍPIOS</strong></footer>
  </main>;
}
