import type { Player } from '../types';

const KEY = 'fanta-draft:v1:data';

export interface StoredData {
  fileName: string;
  savedAt: string;
  /** Import statistiche opzionale (campi aggiuntivi su Player). */
  statsFileName?: string;
  statsSavedAt?: string;
  players: Player[];
}

export function loadData(): StoredData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as StoredData;
    if (!d?.fileName || !Array.isArray(d.players) || d.players.length === 0) {
      return null;
    }
    const p = d.players[0];
    if (typeof p.id !== 'number' || typeof p.nome !== 'string' || !p.ruolo) {
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function saveData(data: StoredData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
