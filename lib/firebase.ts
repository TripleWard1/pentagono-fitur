import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  collection, doc, getFirestore, onSnapshot, runTransaction,
  updateDoc, type Unsubscribe,
} from 'firebase/firestore';

export type Municipality = 'Braga' | 'Guimarães' | 'Vila Nova de Famalicão' | 'Viana do Castelo' | 'Barcelos';
export type Reservation = {
  id: string;
  municipality: Municipality;
  dayIndex: number;
  timeSlot: string;
  actionName: string;
  responsible: string;
  contact: string;
  notes: string;
  createdAt?: number;
  updatedAt?: number;
};

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

const app = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(config))
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export async function ensureAnonymousSignIn() {
  if (!auth) throw new Error('A configuração Firebase está incompleta.');
  if (auth.currentUser) return;
  await new Promise<void>((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    unsubscribe = onAuthStateChanged(auth!, async (user) => {
      unsubscribe?.();
      if (user) { resolve(); return; }
      try { await signInAnonymously(auth!); resolve(); }
      catch (error) { reject(error); }
    }, reject);
  });
}

export function subscribeReservations(
  onData: (items: Reservation[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  if (!db) throw new Error('Firebase não está configurado.');
  return onSnapshot(collection(db, 'reservations'), (snapshot) => {
    const items = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as Reservation));
    onData(items);
  }, (error) => onError(error));
}

const TIMES = Array.from({ length: 18 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const MUNICIPALITY_KEYS: Record<Municipality, string> = {
  'Braga': 'braga',
  'Guimarães': 'guimaraes',
  'Vila Nova de Famalicão': 'famalicao',
  'Viana do Castelo': 'viana',
  'Barcelos': 'barcelos',
};
function lockId(dayIndex: number, timeSlot: string) {
  return `${dayIndex}_${timeSlot.replace(':', '')}`;
}
function dailyCounterId(dayIndex: number, municipality: Municipality) {
  return `${dayIndex}_${MUNICIPALITY_KEYS[municipality]}`;
}
const LOCK_SCHEMA_VERSION = 'after-only-v2';
function lockSchemaRef() {
  return doc(db!, 'system', 'slotLockSchema');
}
function slotsToLock(timeSlot: string) {
  const index = TIMES.indexOf(timeSlot);
  // A reserva ocupa o seu bloco e o bloco seguinte para arrumação.
  // Ex.: 16:00 bloqueia 16:30, mas permite uma nova atividade às 17:00.
  return [timeSlot, index >= 0 && index < TIMES.length - 1 ? TIMES[index + 1] : null]
    .filter((value): value is string => Boolean(value));
}

/** Migra de forma transacional os bloqueios antigos para a regra de atividade + 30 min de arrumação. */
export async function ensureSlotLockSchema() {
  if (!db) throw new Error('Firebase não está configurado.');
  const schemaRef = lockSchemaRef();
  await runTransaction(db, async (transaction) => {
    const schemaSnapshot = await transaction.get(schemaRef);
    if (schemaSnapshot.exists() && schemaSnapshot.data().version === LOCK_SCHEMA_VERSION) return;

    // Firestore transaction reads are all performed before any writes.
    const existingReservations = await transaction.get(collection(db!, 'reservations'));
    const lockDocs = new Map<string, { dayIndex: number; timeSlot: string; reservationId: string; kind: string; municipality: Municipality }>();
    for (const snap of existingReservations.docs) {
      const reservation = { ...snap.data(), id: snap.id } as Reservation;
      if (!Number.isInteger(reservation.dayIndex) || !TIMES.includes(reservation.timeSlot)) continue;
      for (const time of slotsToLock(reservation.timeSlot)) {
        const id = lockId(reservation.dayIndex, time);
        const previous = lockDocs.get(id);
        if (previous && previous.reservationId !== reservation.id) {
          throw new Error(`Não foi possível migrar os bloqueios: existem reservas incompatíveis perto das ${time}. Revê o calendário antes de continuar.`);
        }
        lockDocs.set(id, {
          dayIndex: reservation.dayIndex,
          timeSlot: time,
          reservationId: reservation.id,
          kind: time === reservation.timeSlot ? 'reserved' : 'buffer',
          municipality: reservation.municipality,
        });
      }
    }
    for (const [id, lock] of lockDocs) {
      transaction.set(doc(db!, 'slotLocksV2', id), lock);
    }
    transaction.set(schemaRef, {
      version: LOCK_SCHEMA_VERSION,
      migratedAt: Date.now(),
      reservationCount: existingReservations.size,
    });
  });
}

export async function createReservationCloud(reservation: Reservation) {
  if (!db) throw new Error('Firebase não está configurado.');
  const reservationRef = doc(db, 'reservations', reservation.id);
  const schemaRef = lockSchemaRef();
  const lockRefs = slotsToLock(reservation.timeSlot).map((time) => ({
    time, ref: doc(db!, 'slotLocksV2', lockId(reservation.dayIndex, time)),
  }));
  const counterRef = doc(db, 'dailyCounters', dailyCounterId(reservation.dayIndex, reservation.municipality));

  await runTransaction(db, async (transaction) => {
    const schemaSnapshot = await transaction.get(schemaRef);
    if (!schemaSnapshot.exists() || schemaSnapshot.data().version !== LOCK_SCHEMA_VERSION) {
      throw new Error('A agenda está a preparar as regras de intervalo. Atualiza a página e tenta novamente.');
    }
    const lockSnapshots = [];
    for (const lock of lockRefs) lockSnapshots.push(await transaction.get(lock.ref));
    const counterSnapshot = await transaction.get(counterRef);
    if (lockSnapshots.some((snapshot) => snapshot.exists())) {
      throw new Error('Este horário ou o seu intervalo de arrumação foi entretanto ocupado. Atualiza o calendário e escolhe outro horário.');
    }
    const used = Number(counterSnapshot.data()?.count || 0);
    if (used >= 3) throw new Error('Este município já atingiu o limite de 3 horários neste dia.');

    const now = Date.now();
    transaction.set(reservationRef, { ...reservation, createdAt: now, updatedAt: now });
    lockRefs.forEach(({ time, ref }) => transaction.set(ref, {
      reservationId: reservation.id,
      dayIndex: reservation.dayIndex,
      timeSlot: time,
      kind: time === reservation.timeSlot ? 'reserved' : 'buffer',
    }));
    transaction.set(counterRef, { count: used + 1, dayIndex: reservation.dayIndex, municipality: reservation.municipality, updatedAt: now });
  });
}

export async function updateReservationCloud(id: string, fields: Pick<Reservation, 'actionName' | 'responsible' | 'contact' | 'notes'>) {
  if (!db) throw new Error('Firebase não está configurado.');
  await updateDoc(doc(db, 'reservations', id), { ...fields, updatedAt: Date.now() });
}

export async function deleteReservationCloud(id: string) {
  if (!db) throw new Error('Firebase não está configurado.');
  const reservationRef = doc(db, 'reservations', id);
  const schemaRef = lockSchemaRef();
  await runTransaction(db, async (transaction) => {
    const schemaSnapshot = await transaction.get(schemaRef);
    if (!schemaSnapshot.exists() || schemaSnapshot.data().version !== LOCK_SCHEMA_VERSION) {
      throw new Error('A agenda ainda está a preparar os intervalos. Atualiza a página e tenta novamente.');
    }
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists()) throw new Error('A reserva já foi removida noutro dispositivo. Atualiza o calendário.');
    const reservation = reservationSnapshot.data() as Reservation;
    const lockRefs = slotsToLock(reservation.timeSlot).map((time) => doc(db!, 'slotLocksV2', lockId(reservation.dayIndex, time)));
    const counterRef = doc(db!, 'dailyCounters', dailyCounterId(reservation.dayIndex, reservation.municipality));
    const lockSnapshots = [];
    for (const ref of lockRefs) lockSnapshots.push(await transaction.get(ref));
    const counterSnapshot = await transaction.get(counterRef);
    lockSnapshots.forEach((snapshot, index) => {
      if (snapshot.exists() && snapshot.data().reservationId === id) transaction.delete(lockRefs[index]);
    });
    const count = Math.max(0, Number(counterSnapshot.data()?.count || 0) - 1);
    transaction.set(counterRef, { count, dayIndex: reservation.dayIndex, municipality: reservation.municipality, updatedAt: Date.now() });
    transaction.delete(reservationRef);
  });
}

export const LOCAL_STORAGE_KEY = 'pentagono-fitur-2027-reservations-v3';
