"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays, ChevronDown, ChevronRight, CheckCircle2,
  Clock3, Download, Edit3, FileText, Info, LockKeyhole,
  Plus, Search, Trash2, X
} from "lucide-react";

type Municipality = "Braga" | "Guimarães" | "Vila Nova de Famalicão" | "Viana do Castelo" | "Barcelos";
type Reservation = {
  id: string;
  municipality: Municipality;
  dayIndex: number;
  timeSlot: string;
  actionName: string;
  responsible: string;
  contact: string;
  notes: string;
};

type MunicipalityInfo = {
  name: Municipality;
  short: string;
  color: string;
  pale: string;
  contrast: string;
};

const MUNICIPALITIES: MunicipalityInfo[] = [
  { name: "Braga", short: "BRA", color: "#087443", pale: "#d7eadc", contrast: "#ffffff" },
  { name: "Guimarães", short: "GUI", color: "#f2b400", pale: "#ffefad", contrast: "#352800" },
  { name: "Vila Nova de Famalicão", short: "FAM", color: "#df1427", pale: "#fbdadd", contrast: "#ffffff" },
  { name: "Viana do Castelo", short: "VIA", color: "#087a98", pale: "#d7edf2", contrast: "#ffffff" },
  { name: "Barcelos", short: "BAR", color: "#55595c", pale: "#e0e3e3", contrast: "#ffffff" },
];
const DAYS = [
  { dow: "TER", date: "19", full: "Terça-feira, 19 de janeiro", short: "Ter. 19" },
  { dow: "QUA", date: "20", full: "Quarta-feira, 20 de janeiro", short: "Qua. 20" },
  { dow: "QUI", date: "21", full: "Quinta-feira, 21 de janeiro", short: "Qui. 21" },
  { dow: "SEX", date: "22", full: "Sexta-feira, 22 de janeiro", short: "Sex. 22" },
  { dow: "SÁB", date: "23", full: "Sábado, 23 de janeiro", short: "Sáb. 23" },
  { dow: "DOM", date: "24", full: "Domingo, 24 de janeiro", short: "Dom. 24" },
];
const TIMES = Array.from({ length: 18 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const STORAGE_KEY = "pentagono-fitur-2027-reservations-v3";
const logoUrl = "/pentagono-logo-original.png";

function getEndTime(start: string) {
  const index = TIMES.indexOf(start);
  return index >= 0 ? TIMES[index + 1] || "19:00" : "19:00";
}
function getMunicipality(name: Municipality) {
  return MUNICIPALITIES.find((m) => m.name === name)!;
}
function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [municipality, setMunicipality] = useState<Municipality>("Braga");
  const [day, setDay] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [modalTime, setModalTime] = useState<string | null>(null);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [actionName, setActionName] = useState("");
  const [responsible, setResponsible] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showReservations, setShowReservations] = useState(false);

  useEffect(() => {
    try {
      // Importa também marcações da versão anterior se existirem neste navegador.
      const saved = localStorage.getItem(STORAGE_KEY)
        || localStorage.getItem("pentagono-fitur-2027-reservations-v2");
      if (saved) {
        const parsed = JSON.parse(saved) as Reservation[];
        if (Array.isArray(parsed)) setReservations(parsed);
      }
    } catch {
      // Ignore invalid or unavailable local browser storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations)); } catch { /* Storage may be disabled. */ }
    }
  }, [reservations, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const getAt = (d: number, t: string) => reservations.find((r) => r.dayIndex === d && r.timeSlot === t);
  const isBlocked = (d: number, t: string) => {
    const index = TIMES.indexOf(t);
    return (index > 0 && !!getAt(d, TIMES[index - 1])) || (index < TIMES.length - 1 && !!getAt(d, TIMES[index + 1]));
  };

  const dayReservations = reservations.filter((r) => r.dayIndex === day);
  const mineToday = dayReservations.filter((r) => r.municipality === municipality);
  const selectedMeta = getMunicipality(municipality);
  const blockedCount = TIMES.filter((t) => !getAt(day, t) && isBlocked(day, t)).length;
  const availableCount = TIMES.length - dayReservations.length - blockedCount;
  const dailyUsed = mineToday.length;

  const visibleReservations = useMemo(() => reservations
    .filter((r) => showAll || r.municipality === municipality)
    .filter((r) => `${r.actionName} ${r.municipality} ${r.responsible} ${r.contact} ${DAYS[r.dayIndex].full}`.toLocaleLowerCase("pt-PT").includes(query.toLocaleLowerCase("pt-PT")))
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex || TIMES.indexOf(a.timeSlot) - TIMES.indexOf(b.timeSlot)),
  [reservations, municipality, query, showAll]);

  function openNew(time: string) {
    if (getAt(day, time) || isBlocked(day, time)) return;
    if (dailyUsed >= 3) {
      setToast("Este município já atingiu o limite de 3 horários neste dia.");
      return;
    }
    setEditing(null);
    setModalTime(time);
    setActionName(""); setResponsible(""); setContact(""); setNotes("");
  }

  function openEdit(reservation: Reservation) {
    if (reservation.municipality !== municipality) {
      setToast(`Esta ação pertence a ${reservation.municipality}.`);
      return;
    }
    setEditing(reservation);
    setDay(reservation.dayIndex);
    setModalTime(reservation.timeSlot);
    setActionName(reservation.actionName);
    setResponsible(reservation.responsible);
    setContact(reservation.contact);
    setNotes(reservation.notes || "");
  }

  function saveReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalTime || !actionName.trim()) return;

    if (editing) {
      setReservations((previous) => previous.map((r) => r.id === editing.id
        ? { ...r, actionName: actionName.trim(), responsible: responsible.trim(), contact: contact.trim(), notes: notes.trim() }
        : r));
      setToast("Alterações guardadas.");
    } else {
      const currentDayBookings = reservations.filter((r) => r.dayIndex === day);
      const municipalityBookings = currentDayBookings.filter((r) => r.municipality === municipality);
      const atSlot = currentDayBookings.some((r) => r.timeSlot === modalTime);
      const timeIndex = TIMES.indexOf(modalTime);
      const neighbourBusy = (timeIndex > 0 && currentDayBookings.some((r) => r.timeSlot === TIMES[timeIndex - 1]))
        || (timeIndex < TIMES.length - 1 && currentDayBookings.some((r) => r.timeSlot === TIMES[timeIndex + 1]));

      if (municipalityBookings.length >= 3) {
        setToast("Limite diário atingido: máximo de 3 horários por município.");
        setModalTime(null);
        return;
      }
      if (atSlot || neighbourBusy) {
        setToast("Este horário já não está disponível. Escolhe outro bloco.");
        setModalTime(null);
        return;
      }
      setReservations((previous) => [...previous, {
        id: createId(), municipality, dayIndex: day, timeSlot: modalTime,
        actionName: actionName.trim(), responsible: responsible.trim(), contact: contact.trim(), notes: notes.trim(),
      }]);
      setToast("Horário reservado com sucesso.");
    }
    setModalTime(null);
    setEditing(null);
  }

  function removeReservation(reservation: Reservation) {
    if (reservation.municipality !== municipality) {
      setToast(`Só ${reservation.municipality} pode remover esta ação.`);
      return;
    }
    if (!window.confirm(`Queres remover “${reservation.actionName}” de ${reservation.timeSlot}?`)) return;
    setReservations((previous) => previous.filter((r) => r.id !== reservation.id));
    setToast("Reserva removida. Os intervalos adjacentes foram recalculados.");
  }

  function exportCSV() {
    const rows = [
      ["Data", "Dia", "Início", "Fim", "Município", "Ação", "Responsável", "Contacto", "Notas"],
      ...reservations.slice().sort((a, b) => a.dayIndex - b.dayIndex || TIMES.indexOf(a.timeSlot) - TIMES.indexOf(b.timeSlot))
        .map((r) => [`${DAYS[r.dayIndex].date}/01/2027`, DAYS[r.dayIndex].full, r.timeSlot, getEndTime(r.timeSlot), r.municipality, r.actionName, r.responsible, r.contact, r.notes || ""]),
    ];
    const csv = "\ufeff" + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = "planeamento-pentagono-fitur-2027.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  function closeModal() {
    setModalTime(null); setEditing(null);
  }

  return (
    <main className="app-shell" style={{ "--selected": selectedMeta.color, "--selected-pale": selectedMeta.pale } as React.CSSProperties}>
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Pentágono Urbano - início">
          <span className="brand-logo-wrap"><img src={logoUrl} alt="Pentágono Urbano" className="brand-logo" /></span>
          <span className="brand-divider" />
          <span className="brand-app"><strong>FITUR 2027</strong><small>Gestão de horários</small></span>
        </a>
        <div className="topbar-meta"><span className="event-status"><i /> Planeamento do stand</span><span className="topbar-separator" /> <span>Madrid · 19-24 jan. 2027</span></div>
      </header>

      <div className="content-shell" id="main">
        <section className="municipality-picker" aria-label="Selecionar município">
          <div className="picker-title"><span className="eyebrow">MUNICÍPIO</span><span className="picker-help">Seleciona o município para gerir as suas ações.</span></div>
          <div className="municipality-options">
            {MUNICIPALITIES.map((m) => {
              const count = reservations.filter((r) => r.municipality === m.name).length;
              const selected = municipality === m.name;
              return <button key={m.name} type="button" aria-pressed={selected} className={`municipality-option ${selected ? "is-selected" : ""}`} style={{ "--muni": m.color, "--muni-pale": m.pale } as React.CSSProperties} onClick={() => setMunicipality(m.name)}>
                <span className="municipality-color" />
                <span className="municipality-option-name">{m.name}</span>
                <span className="municipality-res-count">{count}</span>
                {selected && <span className="selected-check"><CheckCircle2 size={14} /></span>}
              </button>;
            })}
          </div>
        </section>

        <section className="page-heading">
          <div><div className="eyebrow heading-eyebrow"><CalendarDays size={13} /> CALENDÁRIO DE MARCAÇÕES</div><h1>Horários do stand</h1><p>Reserva de blocos de 30 minutos para as ações dos cinco municípios.</p></div>
          <div className="selected-summary"><span className="selected-summary-dot" /><div><small>A GERIR</small><strong>{municipality}</strong></div><button type="button" className="summary-chevron" aria-label="Ver municípios" onClick={() => document.querySelector(".municipality-picker")?.scrollIntoView({ behavior: "smooth", block: "start" })}><ChevronDown size={16} /></button></div>
        </section>

        <section className="calendar-card" aria-label="Calendário FITUR 2027">
          <div className="calendar-toolbar">
            <div className="calendar-month"><span className="month-icon"><CalendarDays size={17} /></span><div><strong>Janeiro 2027</strong><small>FITUR · IFEMA Madrid</small></div></div>
            <div className="hours-range"><Clock3 size={14} /><span>10:00–19:00</span><i /> <span>30 min por horário</span></div>
          </div>
          <div className="day-switcher" role="tablist" aria-label="Dia da feira">
            {DAYS.map((d, i) => {
              const count = reservations.filter((r) => r.dayIndex === i).length;
              return <button key={d.date} type="button" role="tab" aria-selected={day === i} className={`day-tab ${day === i ? "active" : ""}`} onClick={() => setDay(i)}>
                <span className="day-name">{d.dow}</span><strong>{d.date}</strong><small>JAN</small><span className="day-count">{count}</span>
              </button>;
            })}
          </div>

          <div className="schedule-toolbar">
            <div><strong>{DAYS[day].full}</strong><span className="schedule-subtitle">Escolhe um horário livre para criar uma reserva.</span></div>
            <div className="daily-counter"><span className="counter-label">O TEU LIMITE</span><div className="counter-bubbles" aria-label={`${dailyUsed} de 3 reservas usadas`}>{[0, 1, 2].map((x) => <span key={x} className={x < dailyUsed ? "used" : ""} />)}</div><strong>{dailyUsed}/3</strong></div>
          </div>

          <div className="slot-legend">
            <span><i className="legend-free" /> Livre</span>
            <span><i className="legend-own" /> A tua ação</span>
            <span><i className="legend-other" /> Outro município</span>
            <span><i className="legend-blocked" /> Intervalo</span>
          </div>

          <div className="time-grid">
            {TIMES.map((time, index) => {
              const reservation = getAt(day, time);
              const blocked = !reservation && isBlocked(day, time);
              const own = reservation?.municipality === municipality;
              const meta = reservation ? getMunicipality(reservation.municipality) : null;
              const slotClass = reservation ? (own ? "slot-own" : "slot-other") : (blocked ? "slot-blocked" : "slot-free");
              const label = reservation ? `${time} a ${getEndTime(time)}. ${reservation.actionName}, ${reservation.municipality}. ${own ? "Editar ação" : "Ocupado"}` : blocked ? `${time} a ${getEndTime(time)}. Intervalo de segurança.` : `${time} a ${getEndTime(time)}. Reservar horário.`;
              return <button key={time} type="button" className={`time-slot ${slotClass}`} style={meta ? { "--slot-color": meta.color, "--slot-pale": meta.pale, "--slot-contrast": meta.contrast } as React.CSSProperties : {}} aria-label={label} onClick={() => reservation ? (own ? openEdit(reservation) : setToast(`Este horário está reservado por ${reservation.municipality}.`)) : blocked ? setToast("Intervalo de segurança: este horário está bloqueado.") : openNew(time)}>
                <span className="slot-top"><strong>{time}</strong><span>{getEndTime(time)}</span></span>
                {reservation ? <>
                  <span className="slot-status"><i />{own ? "A TUA AÇÃO" : meta?.short}</span>
                  <span className="slot-action-name">{reservation.actionName}</span>
                  <span className="slot-bottom">{own ? <><Edit3 size={12} /> Editar</> : <><LockKeyhole size={12} /> Ocupado</>}</span>
                </> : blocked ? <>
                  <span className="blocked-icon"><LockKeyhole size={14} /></span><span className="slot-action-name blocked-text">Intervalo</span><span className="slot-bottom muted-bottom">Margem de segurança</span>
                </> : <>
                  <span className="slot-action-name free-action"><Plus size={14} /> Reservar horário</span>
                  <span className="slot-bottom free-bottom">Disponível <ChevronRight size={13} /></span>
                </>}
                {reservation && meta && <span className="slot-color-edge" />}
              </button>;
            })}
          </div>

          <div className="calendar-footer">
            <span><Info size={14} /> Após cada reserva, o bloco anterior e o seguinte ficam bloqueados.</span>
            <div className="availability-summary"><span><i className="avail-dot" />{availableCount} livres</span><span><i className="reserved-dot" />{dayReservations.length} reservados</span><span><i className="blocked-dot" />{blockedCount} intervalos</span></div>
          </div>
        </section>

        <section className="reservations-section">
          <button className={`reservations-toggle ${showReservations ? "open" : ""}`} type="button" aria-expanded={showReservations} onClick={() => setShowReservations(!showReservations)}>
            <span className="toggle-leading"><FileText size={17} /><span><strong>Lista de ações</strong><small>{reservations.length} {reservations.length === 1 ? "reserva registada" : "reservas registadas"} em todos os dias</small></span></span>
            <span className="toggle-right">{showReservations ? "Ocultar lista" : "Ver lista"}<ChevronDown size={17} /></span>
          </button>
          {showReservations && <div className="reservation-list-panel">
            <div className="list-toolbar">
              <div className="list-filters"><button type="button" className={!showAll ? "filter-active" : ""} onClick={() => setShowAll(false)}>O meu município</button><button type="button" className={showAll ? "filter-active" : ""} onClick={() => setShowAll(true)}>Todos os municípios</button></div>
              <label className="search-field"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar ação, responsável…" aria-label="Pesquisar reservas" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar pesquisa"><X size={14} /></button>}</label>
              <button type="button" className="export-button" onClick={exportCSV}><Download size={15} /> Exportar CSV</button>
            </div>
            {visibleReservations.length === 0 ? <div className="empty-list"><CalendarDays size={22} /><strong>Sem ações para mostrar</strong><span>As marcações aparecem aqui depois de serem registadas.</span></div> : <>
              <div className="reservation-table-wrap"><table className="reservation-table"><thead><tr><th>DATA / HORA</th><th>MUNICÍPIO</th><th>AÇÃO</th><th>RESPONSÁVEL / CONTACTO</th><th aria-label="Ações" /></tr></thead><tbody>
                {visibleReservations.map((r) => { const meta = getMunicipality(r.municipality); return <tr key={r.id}>
                  <td className="date-cell"><strong>{DAYS[r.dayIndex].date} JAN</strong><small>{r.timeSlot}–{getEndTime(r.timeSlot)}</small></td>
                  <td><span className="table-municipality"><i style={{ background: meta.color }} />{r.municipality}</span></td>
                  <td><strong className="table-action-name">{r.actionName}</strong>{r.notes && <small className="table-note">{r.notes}</small>}</td>
                  <td><span className="table-responsible">{r.responsible || "-"}</span><small className="table-contact">{r.contact || "Sem contacto"}</small></td>
                  <td><div className="row-actions">{r.municipality === municipality && <><button type="button" aria-label={`Editar ${r.actionName}`} title="Editar" onClick={() => openEdit(r)}><Edit3 size={14} /></button><button type="button" aria-label={`Remover ${r.actionName}`} title="Remover" onClick={() => removeReservation(r)}><Trash2 size={14} /></button></>}</div></td>
                </tr>;})}
              </tbody></table></div>
              <div className="list-end-note">A mostrar {visibleReservations.length} de {reservations.length} reservas. As ações de outros municípios são apenas de consulta.</div>
            </>}
          </div>}
        </section>

        <footer className="app-footer"><span> <img src={logoUrl} alt="" /> <strong>Pentágono Urbano</strong> · Planeamento conjunto</span><span>FITUR 2027 <i /> Madrid</span></footer>
      </div>

      {modalTime && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-top"><span className="modal-mark" style={{ background: selectedMeta.color }}><CalendarDays size={17} /></span><button type="button" className="modal-close" onClick={closeModal} aria-label="Fechar janela"><X size={18} /></button></div>
          <div className="modal-title-row"><div><span className="modal-kicker">{editing ? "EDITAR MARCAÇÃO" : "NOVA MARCAÇÃO"}</span><h2 id="modal-title">{editing ? "Atualizar ação" : "Reservar horário"}</h2></div><div className="modal-time"><strong>{modalTime}</strong><span>– {getEndTime(modalTime)}</span></div></div>
          <div className="modal-context"><span className="context-color" style={{ background: selectedMeta.color }} /><span>{municipality}</span><i />{DAYS[day].short} <span className="context-limit">{editing ? "Reserva existente" : `${dailyUsed}/3 horários usados`}</span></div>
          <form onSubmit={saveReservation}>
            <label htmlFor="action-name">Nome da ação <span className="required">*</span></label>
            <input id="action-name" autoFocus required maxLength={120} value={actionName} onChange={(e) => setActionName(e.target.value)} placeholder="Ex.: Prova de produtos locais" />
            <div className="form-row"><div><label htmlFor="responsible">Técnico responsável</label><input id="responsible" maxLength={100} value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nome completo" /></div><div><label htmlFor="contact">Contacto</label><input id="contact" maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email ou telefone" /></div></div>
            <label htmlFor="notes">Notas <span className="optional">OPCIONAL</span></label>
            <textarea id="notes" maxLength={500} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Necessidades técnicas ou outras informações" />
            {!editing && <div className="modal-warning"><Info size={15} /><span>Os dois blocos adjacentes ficam reservados para assegurar a transição entre ações.</span></div>}
            <div className="modal-buttons"><button className="button-secondary" type="button" onClick={closeModal}>Cancelar</button><button className="button-primary" type="submit">{editing ? "Guardar alterações" : "Confirmar reserva"}<ChevronRight size={16} /></button></div>
          </form>
        </section>
      </div>}

      {toast && <div className="toast" role="status"><span className="toast-check"><CheckCircle2 size={16} /></span><span>{toast}</span><button type="button" onClick={() => setToast("")} aria-label="Fechar aviso"><X size={15} /></button></div>}
    </main>
  );
}
