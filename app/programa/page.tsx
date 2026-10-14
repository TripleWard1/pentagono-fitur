"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Clock3, Download, MapPin, Radio, WifiOff } from "lucide-react";
import {
  DAYS, pentagonoLogo, getMeta, townSlug, endTime, startDateTime, endDateTime, currentFiturDay,
  liveItems, liveProgress, formatIn, formatAgo, sortByStart, downloadIcs, useNow, useReservations,
} from "@/lib/agenda";

/* Visitor-facing programme, opened from the QR code on the stand display.
   Mobile first, public Spanish copy. All five municipalities are presented on equal terms:
   one chronological list, same card, each only in its own colour. */
export default function ProgrammePage() {
  const { reservations, sync, lastUpdate } = useReservations();
  const now = useNow(1000);
  const defaultDay = currentFiturDay(now);
  const [picked, setPicked] = useState<number | null>(null);
  const dayIndex = picked ?? defaultDay;
  useEffect(() => { document.title = "Programa · Pentágono Urbano · FITUR 2027"; }, []);

  const dayItems = useMemo(() => sortByStart(reservations.filter((item) => item.dayIndex === dayIndex)), [reservations, dayIndex]);
  const counts = useMemo(() => DAYS.map((_, index) => reservations.filter((item) => item.dayIndex === index).length), [reservations]);
  const live = useMemo(() => liveItems(reservations, now), [reservations, now]);
  const next = useMemo(() => sortByStart(reservations).find((item) => startDateTime(item).getTime() > now.getTime()) || null, [reservations, now]);
  const offline = (sync === "error" || sync === "connecting") && lastUpdate;
  const day = DAYS[dayIndex];

  return <main className="pg-app">
    <header className="pg-hero">
      <div className="pg-hero-brand"><img src={pentagonoLogo} alt="Pentágono Urbano" /><div><strong>PENTÁGONO URBANO</strong><small>FITUR 2027 · IFEMA MADRID</small></div></div>
      <h1>Programa del stand</h1>
      <p>Cinco municipios, un destino. Todas las actividades, actualizadas en tiempo real.</p>
      <div className="pg-ribbon" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    </header>

    {offline && <div className="pg-offline"><WifiOff size={15} /> Sin conexión · datos de {formatAgo(lastUpdate!, now.getTime())}</div>}

    {live.length > 0 && <section className="pg-spot pg-spot-live" aria-label="En directo ahora">
      <div className="pg-spot-label"><Radio size={15} /> EN DIRECTO AHORA</div>
      {live.map((item) => <SpotCard key={item.id} item={item} progress={liveProgress(item, now)} />)}
    </section>}
    {next && <section className="pg-spot" aria-label="Próxima actividad">
      <div className="pg-spot-label"><Clock3 size={15} /> PRÓXIMA ACTIVIDAD<em>Empieza {formatIn(startDateTime(next).getTime() - now.getTime())}</em></div>
      <SpotCard item={next} />
    </section>}

    <nav className="pg-days" aria-label="Días del programa">
      {DAYS.map((d, index) => <button key={d.date} type="button" className={index === dayIndex ? "active" : ""} onClick={() => setPicked(index)} aria-pressed={index === dayIndex}>
        <small>{d.compact.split(".")[0]}</small><strong>{d.date}</strong><span>{counts[index]}</span>
      </button>)}
    </nav>

    <section className="pg-list" aria-label={`Actividades del ${day.dow.toLowerCase()}`}>
      <div className="pg-list-head"><h2>{day.dow.charAt(0) + day.dow.slice(1).toLowerCase()}, {day.date} de enero</h2><span>{dayItems.length} {dayItems.length === 1 ? "actividad" : "actividades"}</span></div>
      {dayItems.length === 0 && <div className="pg-empty"><strong>Aún no hay actividades este día</strong><span>Vuelve más tarde: el programa se actualiza solo.</span></div>}
      {dayItems.map((item) => {
        const meta = getMeta(item.municipality);
        const isLive = live.some((l) => l.id === item.id);
        const done = endDateTime(item).getTime() <= now.getTime();
        return <article key={item.id} className={`pg-card${isLive ? " is-live" : ""}${done ? " is-done" : ""}`} style={{ "--town": meta.color } as React.CSSProperties}>
          <div className="pg-card-time"><strong>{item.timeSlot}</strong><span>{endTime(item.timeSlot)}</span></div>
          <div className="pg-card-body">
            <div className={`pg-town pg-town-${townSlug(item.municipality)}`}><img src={meta.logo} alt="" /><span>{item.municipality}</span>{isLive && <b className="pg-live-pill"><i />EN DIRECTO</b>}{done && <b className="pg-done-pill">Finalizada</b>}</div>
            <h3>{item.actionName}</h3>
            {item.notes?.trim() && <p>{item.notes}</p>}
            {item.responsible?.trim() && <small>Con {item.responsible}</small>}
            {!done && <button type="button" className="pg-add" onClick={() => downloadIcs([item], `pentagono-${item.id}.ics`)}><CalendarPlus size={15} /> Añadir al calendario</button>}
          </div>
        </article>;
      })}
    </section>

    {reservations.length > 0 && <button type="button" className="pg-download" onClick={() => downloadIcs(reservations, "pentagono-urbano-fitur-2027.ics")}><Download size={17} /> Descargar todo el programa (.ics)</button>}

    <footer className="pg-footer"><MapPin size={14} /> Pentágono Urbano · FITUR 2027 · IFEMA Madrid<strong>UN TERRITORIO, CINCO MUNICIPIOS</strong></footer>
  </main>;
}

function SpotCard({ item, progress }: { item: ReturnType<typeof sortByStart>[number]; progress?: number }) {
  const meta = getMeta(item.municipality);
  return <article className="pg-card pg-card-spot" style={{ "--town": meta.color } as React.CSSProperties}>
    <div className="pg-card-time"><strong>{item.timeSlot}</strong><span>{endTime(item.timeSlot)}</span></div>
    <div className="pg-card-body">
      <div className={`pg-town pg-town-${townSlug(item.municipality)}`}><img src={meta.logo} alt="" /><span>{item.municipality}</span></div>
      <h3>{item.actionName}</h3>
      {item.notes?.trim() && <p>{item.notes}</p>}
      {progress !== undefined && <div className="pg-progress" aria-hidden="true"><b style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
    </div>
  </article>;
}
