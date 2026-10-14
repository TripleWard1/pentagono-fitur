"use client";

import { useEffect, useRef, useState } from "react";
import {
  firebaseConfigured, ensureAnonymousSignIn, subscribeReservations, LOCAL_STORAGE_KEY,
} from "@/lib/firebase";
import type { Reservation } from "@/lib/firebase";

/* Shared pieces for the public displays (/agenda on the TV, /programa on visitors' phones).
   Public text is Spanish: the fair is in Madrid. The booking back office stays in Portuguese. */

export const DAYS = [
  { dow: "MARTES", date: "19", short: "mar. 19", compact: "MAR. 19" },
  { dow: "MIÉRCOLES", date: "20", short: "mié. 20", compact: "MIÉ. 20" },
  { dow: "JUEVES", date: "21", short: "jue. 21", compact: "JUE. 21" },
  { dow: "VIERNES", date: "22", short: "vie. 22", compact: "VIE. 22" },
  { dow: "SÁBADO", date: "23", short: "sáb. 23", compact: "SÁB. 23" },
  { dow: "DOMINGO", date: "24", short: "dom. 24", compact: "DOM. 24" },
];
export const TIMES = Array.from({ length: 18 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
export type TownMeta = { name: string; color: string; logo: string };
export const MUNICIPALITIES: TownMeta[] = [
  { name: "Barcelos", color: "#55595c", logo: "https://i.imgur.com/e5ntTlW.png" },
  { name: "Braga", color: "#087443", logo: "https://i.imgur.com/2MEyi4w.png" },
  { name: "Guimarães", color: "#f2b400", logo: "https://i.imgur.com/zMV4mih.png" },
  { name: "Viana do Castelo", color: "#087a98", logo: "https://i.imgur.com/xNrj977.png" },
  { name: "Vila Nova de Famalicão", color: "#df1427", logo: "https://i.imgur.com/6Kt2Xy7.png" },
];
export const pentagonoLogo = "/pentagono-logo-original.png";
export function getMeta(name: string) { return MUNICIPALITIES.find((item) => item.name === name) || MUNICIPALITIES[0]; }
export function townSlug(name: string) {
  if (name === "Guimarães") return "guimaraes";
  if (name === "Vila Nova de Famalicão") return "famalicao";
  if (name === "Viana do Castelo") return "viana";
  return name.toLowerCase();
}

export const SLOT_MINUTES = 30;
export function endTime(time: string) { const index = TIMES.indexOf(time); return index >= 0 ? TIMES[index + 1] || "19:00" : "19:00"; }
export function startDateTime(item: Reservation) {
  const [hours, minutes] = item.timeSlot.split(":").map(Number);
  return new Date(2027, 0, 19 + item.dayIndex, hours || 0, minutes || 0, 0, 0);
}
export function endDateTime(item: Reservation) { return new Date(startDateTime(item).getTime() + SLOT_MINUTES * 60_000); }
export function displayDate(item: Reservation) {
  const day = DAYS[item.dayIndex];
  return day ? `${day.dow}, ${day.date} ENE 2027` : "FITUR 2027";
}
export function currentFiturDay(now: Date) {
  const start = new Date(2027, 0, 19, 0, 0, 0, 0);
  const endExclusive = new Date(2027, 0, 25, 0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (today < start.getTime()) return 0;
  if (today >= endExclusive.getTime()) return 5;
  return Math.min(5, Math.max(0, Math.floor((today - start.getTime()) / 86_400_000)));
}
export function sortByStart(items: Reservation[]) {
  return [...items].sort((a, b) => startDateTime(a).getTime() - startDateTime(b).getTime());
}
export function liveItems(items: Reservation[], now: Date) {
  const t = now.getTime();
  return sortByStart(items).filter((item) => startDateTime(item).getTime() <= t && t < endDateTime(item).getTime());
}
export function liveProgress(item: Reservation, now: Date) {
  const start = startDateTime(item).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - start) / (SLOT_MINUTES * 60_000)));
}

/** "en 12 min", "en 2 h 05 min", "en 3 días" - used for the countdown. */
export function formatIn(ms: number) {
  if (ms <= 0) return "ahora";
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 2) return ms < 60_000 ? `en ${Math.max(1, Math.ceil(ms / 1000))} s` : "en 1 min";
  if (totalMin < 60) return `en ${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  if (hours < 24) { const m = totalMin % 60; return m ? `en ${hours} h ${String(m).padStart(2, "0")} min` : `en ${hours} h`; }
  const days = Math.round(ms / 86_400_000);
  return days === 1 ? "mañana" : `en ${days} días`;
}
export function formatRemaining(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return `Termina en ${min} min`;
}
export function formatAgo(from: number, now: number) {
  const min = Math.max(0, Math.floor((now - from) / 60_000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/* ---------- calendar export (.ics) ---------- */
function icsStamp(date: Date) {
  // January in Madrid is CET (UTC+1), so convert the local wall-clock time to UTC.
  const utc = new Date(date.getTime() - 60 * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${utc.getFullYear()}${p(utc.getMonth() + 1)}${p(utc.getDate())}T${p(utc.getHours())}${p(utc.getMinutes())}00Z`;
}
function icsText(value: string) { return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
export function buildIcs(items: Reservation[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pentagono Urbano//FITUR 2027//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Pentágono Urbano · FITUR 2027"];
  for (const item of sortByStart(items)) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@pentagono-fitur`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(startDateTime(item))}`,
      `DTEND:${icsStamp(endDateTime(item))}`,
      `SUMMARY:${icsText(`${item.actionName} · ${item.municipality}`)}`,
      `DESCRIPTION:${icsText(item.notes?.trim() || "Pentágono Urbano en FITUR 2027")}`,
      "LOCATION:Pentágono Urbano · FITUR 2027 · IFEMA Madrid",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
export function downloadIcs(items: Reservation[], filename: string) {
  const blob = new Blob([buildIcs(items)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- hooks ---------- */
const CACHE_KEY = "pentagono-fitur-2027-public-cache-v1";
type Cache = { at: number; items: Reservation[] };

/** Live reservations with an offline safety net: the last good copy is kept in
    localStorage, shown if the connection drops, and the subscription retries on its own. */
export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sync, setSync] = useState<"local" | "connecting" | "online" | "error">("connecting");
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) { const cache = JSON.parse(raw) as Cache; setReservations(cache.items); setLastUpdate(cache.at); }
    } catch { /* cache is optional */ }

    if (!firebaseConfigured) {
      try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) setReservations(JSON.parse(local) as Reservation[]);
      } catch { /* ignore invalid local data */ }
      setSync("local");
      const onStorage = (event: StorageEvent) => {
        if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
          try { setReservations(JSON.parse(event.newValue) as Reservation[]); } catch { /* ignore */ }
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let retry: number | undefined;
    const connect = () => {
      ensureAnonymousSignIn().then(() => {
        if (cancelled) return;
        unsubscribe?.();
        unsubscribe = subscribeReservations((items) => {
          const at = Date.now();
          setReservations(items); setLastUpdate(at); setSync("online");
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at, items } satisfies Cache)); } catch { /* storage full */ }
        }, () => { if (!cancelled) { setSync("error"); retry = window.setTimeout(connect, 15_000); } });
      }).catch(() => { if (!cancelled) { setSync("error"); retry = window.setTimeout(connect, 15_000); } });
    };
    connect();
    const onOnline = () => { window.clearTimeout(retry); connect(); };
    window.addEventListener("online", onOnline);
    return () => { cancelled = true; unsubscribe?.(); window.clearTimeout(retry); window.removeEventListener("online", onOnline); };
  }, []);

  return { reservations, sync, lastUpdate };
}

/** Current time, ticking every `tickMs`. `?t=2027-01-19T10:12` simulates the clock for demos and tests. */
export function useNow(tickMs = 1000) {
  const offset = useRef(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    try {
      const sim = new URLSearchParams(window.location.search).get("t");
      if (sim) { const parsed = new Date(sim).getTime(); if (!Number.isNaN(parsed)) offset.current = parsed - Date.now(); }
    } catch { /* ignore */ }
    const tick = () => setNow(new Date(Date.now() + offset.current));
    tick();
    const id = window.setInterval(tick, tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}
