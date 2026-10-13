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
function relatedSlots(dayIndex: number, timeSlot: string) {
  const index = TIMES.indexOf(timeSlot);
  // Bloqueia o próprio bloco e os blocos contíguos. Uma marcação às 10:00
  // impede 10:30, deixando 11:00 como a próxima hora possível.
  return [index > 0 ? TIMES[index - 1] : null, timeSlot, index < TIMES.length - 1 ? TIMES[index + 1] : null]
    .filter((value): value is string => Boolean(value));
}

export async function createReservationCloud(reservation: Reservation) {
  if (!db) throw new Error('Firebase não está configurado.');
  const reservationRef = doc(db, 'reservations', reservation.id);
  const lockRefs = relatedSlots(reservation.dayIndex, reservation.timeSlot).map((time) => ({
    time, ref: doc(db!, 'slotLocks', lockId(reservation.dayIndex, time)),
  }));
  const counterRef = doc(db, 'dailyCounters', dailyCounterId(reservation.dayIndex, reservation.municipality));

  await runTransaction(db, async (transaction) => {
    const lockSnapshots = [];
    for (const lock of lockRefs) lockSnapshots.push(await transaction.get(lock.ref));
    const counterSnapshot = await transaction.get(counterRef);
    if (lockSnapshots.some((snapshot) => snapshot.exists())) {
      throw new Error('Este horário ou um dos blocos de segurança foi entretanto ocupado. Atualiza o calendário e escolhe outro horário.');
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
  await runTransaction(db, async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists()) throw new Error('A reserva já foi removida noutro dispositivo. Atualiza o calendário.');
    const reservation = reservationSnapshot.data() as Reservation;
    const lockRefs = relatedSlots(reservation.dayIndex, reservation.timeSlot).map((time) => doc(db!, 'slotLocks', lockId(reservation.dayIndex, time)));
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
