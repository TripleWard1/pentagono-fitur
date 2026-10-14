"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Tv2, Wifi, WifiOff, ArrowRight, Sparkles, Radio } from "lucide-react";
import type { Reservation } from "@/lib/firebase";
import QrCode from "@/components/QrCode";
import {
  DAYS, MUNICIPALITIES, pentagonoLogo, getMeta, townSlug, endTime, startDateTime, endDateTime,
  displayDate, currentFiturDay, liveItems, liveProgress, formatIn, formatRemaining, formatAgo,
  sortByStart, useNow, useReservations,
} from "@/lib/agenda";

const ROTATION_MS = 16_000;
const FADE_MS = 450;

/** Balanced pages of at most `pageSize`: 5 activities become 3 + 2, never 4 + a lone card. */
function splitIntoPages(items: Reservation[], pageSize: number) {
  const pages = Math.ceil(items.length / pageSize);
  const result: Reservation[][] = [];
  let cursor = 0;
  for (let i = 0; i < pages; i += 1) {
    const size = Math.floor(items.length / pages) + (i < items.length % pages ? 1 : 0);
    result.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return result;
}

export default function StandAgendaScreen() {
  const { reservations, sync, lastUpdate } = useReservations();
  const now = useNow(1000);
  const [pageIndex, setPageIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [programmeUrl, setProgrammeUrl] = useState("");

  useEffect(() => { setProgrammeUrl(`${window.location.origin}/programa`); }, []);
  // Press "F" on the TV browser to toggle full screen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focusDayIndex = currentFiturDay(now);
  const inFiturWeek = now.getTime() >= new Date(2027, 0, 19).getTime() && now.getTime() < new Date(2027, 0, 25).getTime();
  const programmeFinished = now.getTime() >= new Date(2027, 0, 24, 19, 0, 0, 0).getTime();
  const focusDay = DAYS[focusDayIndex];

  const focusItems = useMemo(() => sortByStart(reservations.filter((item) => item.dayIndex === focusDayIndex)), [reservations, focusDayIndex]);
  const focusPages = useMemo(() => splitIntoPages(focusItems, 4), [focusItems]);

  const live = useMemo(() => liveItems(reservations, now), [reservations, now]);
  const liveNow = live[0] || null;
  const nextAction = useMemo(() => sortByStart(reservations).find((item) => startDateTime(item).getTime() > now.getTime()) || null, [reservations, now]);

  // Between activities the display adds an "attract" scene (the five municipalities + QR code) to the rotation.
  const showAttract = !liveNow;
  const totalPages = focusPages.length + (showAttract ? 1 : 0);
  const safeIndex = totalPages ? pageIndex % totalPages : 0;
  const onAttract = showAttract && safeIndex === focusPages.length;
  const currentItems = onAttract ? [] : focusPages[safeIndex] || [];

  useEffect(() => { setPageIndex(0); }, [focusDayIndex]);
  useEffect(() => {
    if (totalPages < 2) return;
    let swap: number | undefined;
    const rotation = window.setInterval(() => {
      setFading(true);
      swap = window.setTimeout(() => { setPageIndex((current) => (current + 1) % totalPages); setFading(false); }, FADE_MS);
    }, ROTATION_MS);
    return () => { window.clearInterval(rotation); window.clearTimeout(swap); setFading(false); };
  }, [totalPages, focusDayIndex]);

  const formattedTime = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const focusDateLabel = `${focusDay.dow} · ${focusDay.date} DE ENERO`;
  const mainTitle = programmeFinished ? "Agenda de FITUR 2027" : inFiturWeek ? "Hoy en el Pentágono" : "La agenda del Pentágono";
  const eyebrowText = programmeFinished ? "PROGRAMA FINALIZADO · FITUR 2027" : inFiturWeek ? focusDateLabel : `A PARTIR DEL ${focusDateLabel}`;
  const dayLower = focusDay.dow.toLocaleLowerCase("es-ES");
  const stale = (sync === "error" || sync === "connecting") && lastUpdate;

  const statusLabel = sync === "online" ? <><Wifi size={17} /> Actualizado en tiempo real</>
    : stale ? <><WifiOff size={17} /> Sin conexión · actualizado {formatAgo(lastUpdate!, now.getTime())}</>
    : sync === "connecting" ? <>Conectando con la agenda…</>
    : sync === "local" ? <><WifiOff size={17} /> Vista previa local</>
    : <><WifiOff size={17} /> Sin conexión con la agenda</>;

  const nextMeta = nextAction ? getMeta(nextAction.municipality) : null;
  const liveMeta = liveNow ? getMeta(liveNow.municipality) : null;

  return <main className="screen-app screen-app-v11 screen-app-v12">
    <header className="screen-header">
      <div className="screen-brand"><img src={pentagonoLogo} alt="Pentágono Urbano" /><span className="screen-divider" /><div><strong>PENTÁGONO URBANO</strong><small>FITUR 2027 · IFEMA MADRID</small></div></div>
      <div className="screen-status"><span className={`screen-connection ${stale ? "stale" : sync}`}><i />{statusLabel}</span><span className="screen-clock"><Clock3 size={17} />{formattedTime}</span></div>
    </header>
    <div className="screen-ribbon" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <section className="screen-main screen-main-v11 screen-main-v12">
      <div className="screen-kicker"><Tv2 size={16} /> PROGRAMACIÓN DEL STAND <span className="screen-kicker-dot" /> CINCO MUNICIPIOS, UN DESTINO</div>
      <div className="screen-title-row screen-title-row-v12">
        <div><p>{eyebrowText}</p><h1>{mainTitle}</h1><span className="screen-focus-note">{programmeFinished ? "Gracias por acompañar al Pentágono Urbano" : inFiturWeek ? "Programa del día · Actualizado en tiempo real" : "Programa del primer día · Actualizado en tiempo real"}</span></div>
        <div className="screen-title-aside">
          {programmeUrl && <div className="screen-qr-chip"><QrCode className="screen-qr-chip-code" value={programmeUrl} label="Código QR del programa completo" /><span><strong>Lleva el programa en tu móvil</strong><small>Escanea el código</small></span></div>}
          <div className="screen-date-stamp"><CalendarDays size={22} /><span>19-24<strong>ENE 2027</strong></span></div>
        </div>
      </div>

      {liveNow && liveMeta && <section className="screen-next-action screen-live-action" aria-live="polite" aria-label="En directo ahora" style={{ "--town": liveMeta.color } as React.CSSProperties}>
        <div className="screen-next-label screen-live-label"><Radio size={16} /> <span>EN DIRECTO AHORA</span><i /><em>{formatRemaining(endDateTime(liveNow).getTime() - now.getTime())}</em></div>
        <div className="screen-next-body">
          <img className="screen-next-watermark" src={liveMeta.logo} alt="" aria-hidden="true" />
          <div className={`screen-next-logo screen-next-logo-${townSlug(liveMeta.name)}`}><img src={liveMeta.logo} alt={`Logotipo de ${liveMeta.name}`} /><span>{liveMeta.name}</span></div>
          <div className="screen-next-copy"><div className="screen-next-time"><strong>{liveNow.timeSlot}</strong><span>- {endTime(liveNow.timeSlot)}</span><span className="screen-live-pill"><i />EN DIRECTO</span></div><h2>{liveNow.actionName}</h2>{liveNow.notes?.trim() && <p><span>DESCRIPCIÓN</span>{liveNow.notes}</p>}</div>
          <ArrowRight className="screen-next-arrow" size={28} />
        </div>
        <div className="screen-live-progress" aria-hidden="true"><b style={{ width: `${Math.round(liveProgress(liveNow, now) * 100)}%` }} /></div>
      </section>}

      <section className="screen-next-action" aria-live="polite" aria-label="Próxima acción">
        <div className="screen-next-label"><Sparkles size={16} /> <span>PRÓXIMA ACTIVIDAD</span><i /></div>
        {nextAction && nextMeta ? <div className="screen-next-body" style={{ "--town": nextMeta.color } as React.CSSProperties}>
          <img className="screen-next-watermark" src={nextMeta.logo} alt="" aria-hidden="true" />
          <div className={`screen-next-logo screen-next-logo-${townSlug(nextMeta.name)}`}><img src={nextMeta.logo} alt={`Logotipo de ${nextMeta.name}`} /><span>{nextMeta.name}</span></div>
          <div className="screen-next-copy"><div className="screen-next-time"><strong>{nextAction.timeSlot}</strong><span>- {endTime(nextAction.timeSlot)}</span><i /><small>{displayDate(nextAction)}</small><span className="screen-countdown"><Clock3 size={14} />Empieza {formatIn(startDateTime(nextAction).getTime() - now.getTime())}</span></div><h2>{nextAction.actionName}</h2>{nextAction.notes?.trim() && <p><span>DESCRIPCIÓN</span>{nextAction.notes}</p>}</div>
          <ArrowRight className="screen-next-arrow" size={28} />
        </div> : <div className="screen-next-empty"><strong>{programmeFinished ? "Programa finalizado" : "Aún no hay próximas actividades programadas"}</strong><span>{programmeFinished ? "Gracias por visitar el Pentágono Urbano." : "Las nuevas reservas aparecerán automáticamente en esta pantalla."}</span></div>}
      </section>

      {onAttract ? <>
        <div className="screen-activity-heading"><strong>Cinco municipios, un destino</strong><span>Próximas actividades de cada municipio</span></div>
        <div className={`screen-attract${fading ? " is-fading" : ""}`}>
          <div className="screen-attract-towns">
            {MUNICIPALITIES.map((town) => {
              const upcoming = sortByStart(reservations.filter((item) => item.municipality === town.name)).find((item) => startDateTime(item).getTime() > now.getTime());
              return <article className="screen-attract-town" key={town.name} style={{ "--town": town.color } as React.CSSProperties}>
                <img src={town.logo} alt={`Logotipo de ${town.name}`} />
                <strong>{town.name}</strong>
                {upcoming ? <p><small>PRÓXIMA ACTIVIDAD</small><b>{DAYS[upcoming.dayIndex]?.compact} · {upcoming.timeSlot}</b><span>{upcoming.actionName}</span></p> : <p><small>PRÓXIMA ACTIVIDAD</small><span>Sin actividades programadas</span></p>}
              </article>;
            })}
          </div>
          {programmeUrl && <aside className="screen-attract-qr"><QrCode className="screen-attract-qr-code" value={programmeUrl} label="Código QR del programa completo" /><div><strong>Lleva el programa en tu móvil</strong><span>Escanea el código con la cámara: verás todas las actividades de los cinco municipios, en directo, y podrás añadirlas a tu calendario.</span></div></aside>}
        </div>
      </> : <>
        <div className="screen-activity-heading"><strong>{programmeFinished ? `Último día · ${dayLower}` : inFiturWeek ? `Actividades del ${dayLower}` : `Primer día · ${dayLower}`}</strong><span>{focusItems.length} {focusItems.length === 1 ? "actividad" : "actividades"}{totalPages > 1 ? ` · Página ${safeIndex + 1} de ${totalPages}` : ""}</span></div>
        {currentItems.length ? <div className={`screen-activities screen-activities-v12${fading ? " is-fading" : ""}`} style={{ gridTemplateColumns: currentItems.length <= 2 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gridTemplateRows: `repeat(${Math.ceil(currentItems.length / (currentItems.length <= 2 ? 1 : 2))}, minmax(0, 1fr))` }}>
          {currentItems.map((item) => {
            const meta = getMeta(item.municipality);
            const isLive = liveNow?.id === item.id;
            const isDone = endDateTime(item).getTime() <= now.getTime();
            return <article className={`screen-activity screen-activity-v11${isLive ? " is-live" : ""}${isDone ? " is-done" : ""}`} key={item.id} style={{ "--town": meta.color } as React.CSSProperties}>
              <img className="screen-activity-watermark" src={meta.logo} alt="" aria-hidden="true" />
              <div className="screen-activity-time"><strong>{item.timeSlot}</strong><span>HASTA {endTime(item.timeSlot)}</span><i>{isLive ? "EN DIRECTO" : isDone ? "FINALIZADA" : "FITUR 2027"}</i></div>
              <div className="screen-activity-main"><div className={`screen-town screen-town-${townSlug(item.municipality)}`}><img src={meta.logo} alt={`Logotipo del municipio de ${item.municipality}`} loading="eager" /><span>{item.municipality}</span></div><h2>{item.actionName}</h2>{item.notes?.trim() && <p className="screen-activity-description"><span>DESCRIPCIÓN</span>{item.notes}</p>}{item.responsible?.trim() && <small className="screen-activity-responsible">Con {item.responsible}</small>}</div>
              {isLive && <div className="screen-activity-progress" aria-hidden="true"><b style={{ width: `${Math.round(liveProgress(item, now) * 100)}%` }} /></div>}
              <div className="screen-activity-marker" aria-hidden="true" />
            </article>;
          })}
        </div> : <div className="screen-focus-empty"><strong>Aún no hay actividades este día</strong><span>Las actividades programadas para el {focusDay.short} aparecerán aquí.</span></div>}
      </>}

      <div className="screen-pagination"><div>{Array.from({ length: Math.max(totalPages, 1) }, (_, index) => <span key={index} className={safeIndex === index ? "active" : ""} />)}</div><p>Consulta al equipo del municipio para más información.</p><small>{totalPages > 1 ? "PÁGINAS EN ROTACIÓN AUTOMÁTICA" : "ACTUALIZACIÓN AUTOMÁTICA"}</small></div>
    </section>
    <footer className="screen-footer"><span>BARCELOS <i /> BRAGA <i /> GUIMARÃES <i /> VIANA DO CASTELO <i /> VILA NOVA DE FAMALICÃO</span><strong>UN TERRITORIO, CINCO MUNICIPIOS</strong></footer>
  </main>;
}
