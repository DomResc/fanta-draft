import * as XLSX from 'xlsx';
import type { Player, Ruolo } from '../types';

const VALID_ROLES = new Set<string>(['P', 'D', 'C', 'A']);

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function parseRuolo(v: unknown): Ruolo | null {
  const s = String(v ?? '').trim().toUpperCase();
  return VALID_ROLES.has(s) ? (s as Ruolo) : null;
}

export function parseQuotazioni(buf: ArrayBuffer): Player[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new Error('File non leggibile: assicurati che sia un .xlsx valido');
  }
  const ws = wb.Sheets['Tutti'];
  if (!ws) throw new Error('Foglio "Tutti" non trovato nel file quotazioni');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { range: 1 });
  const players: Player[] = [];
  for (const r of rows) {
    const ruolo = parseRuolo(r['R']);
    const nome = String(r['Nome'] ?? '').trim();
    if (!ruolo || !nome) continue;
    players.push({
      id: num(r['Id']),
      nome,
      squadra: String(r['Squadra'] ?? '').trim(),
      ruolo,
      ruoloMantra: String(r['RM'] ?? '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      qtA: num(r['Qt.A']),
      qtI: num(r['Qt.I']),
      diff: num(r['Diff.']),
      qtAM: num(r['Qt.A M']),
      fvm: num(r['FVM']),
      fvmM: num(r['FVM M']),
    });
  }
  if (players.length === 0) {
    throw new Error(
      'Nessun giocatore valido trovato: il formato non corrisponde alle quotazioni Fantacalcio',
    );
  }
  return players;
}

export async function parseQuotazioniFile(file: File): Promise<Player[]> {
  if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name)) {
    throw new Error('Formato non supportato: carica il file .xlsx delle quotazioni');
  }
  const buf = await file.arrayBuffer();
  return parseQuotazioni(buf);
}
