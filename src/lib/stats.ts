import * as XLSX from 'xlsx';
import type { Player } from '../types';

/**
 * Parser "statistiche" di fantacalcio.it (stagioni precedenti).
 * A differenza del file quotazioni (contratto rigido, vedi parser.ts), qui il
 * formato è riconosciuto per alias delle intestazioni: la pagina statistiche
 * cambia colonne tra stagioni e include colonne extra (quotazioni, ecc.),
 * quindi si accetta qualsiasi foglio con almeno "Nome" + una statistica nota.
 */

export type StatsPatch = Partial<
  Pick<Player, 'presenze' | 'mv' | 'fm' | 'gol' | 'assist' | 'rigori'>
>;

export interface StatsRow {
  id: number | null;
  nome: string;
  squadra: string;
  patch: StatsPatch;
}

const FIELD_ALIASES: Record<string, string[]> = {
  id: ['id', 'cod'],
  nome: ['nome', 'giocatore', 'calciatore'],
  squadra: ['squadra', 'team'],
  presenze: ['pres', 'presenze'],
  mv: ['mv', 'mediavoto'],
  fm: ['fm', 'fantamedia'],
  gol: ['gol', 'gf', 'golfatti'],
  assist: ['ass', 'assist', 'assisti'],
  rigori: ['rig', 'rigori', 'rigorisegnati'],
};

const STAT_FIELDS = [
  'presenze',
  'mv',
  'fm',
  'gol',
  'assist',
  'rigori',
] as const;

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .trim()
    .replace(/[.\s_'’-]/g, '');
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Individua in un foglio la riga di intestazione e la mappa campo→colonna. */
function findHeader(
  matrix: unknown[][],
): { rowIdx: number; cols: Record<string, number> } | null {
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    const headers = (matrix[i] ?? []).map(normalizeHeader);
    const cols: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      const idx = headers.findIndex((h) => h !== '' && aliases.includes(h));
      if (idx >= 0) cols[field] = idx;
    }
    if (cols.nome != null && STAT_FIELDS.some((f) => cols[f] != null)) {
      return { rowIdx: i, cols };
    }
  }
  return null;
}

export function parseStatistiche(buf: ArrayBuffer): StatsRow[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new Error('File non leggibile: assicurati che sia un .xlsx valido');
  }

  let header: { rowIdx: number; cols: Record<string, number> } | null = null;
  let matrix: unknown[][] = [];
  for (const name of wb.SheetNames) {
    const m = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: '',
    });
    const found = findHeader(m);
    // preferisce la tabella con più campi riconosciuti
    if (
      found &&
      (!header || Object.keys(found.cols).length > Object.keys(header.cols).length)
    ) {
      header = found;
      matrix = m;
    }
  }
  if (!header) {
    throw new Error(
      'Formato statistiche non riconosciuto: servono le colonne Nome e almeno una statistica (Pres, MV, FM, Gol…)',
    );
  }

  const { cols } = header;
  const rows: StatsRow[] = [];
  for (let i = header.rowIdx + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const nome = String(r[cols.nome] ?? '').trim();
    if (!nome) continue;
    const patch: StatsPatch = {};
    if (cols.presenze != null) patch.presenze = num(r[cols.presenze]);
    if (cols.mv != null) patch.mv = num(r[cols.mv]);
    if (cols.fm != null) patch.fm = num(r[cols.fm]);
    if (cols.gol != null) patch.gol = num(r[cols.gol]);
    if (cols.assist != null) patch.assist = num(r[cols.assist]);
    if (cols.rigori != null) patch.rigori = num(r[cols.rigori]);
    rows.push({
      id: cols.id != null && num(r[cols.id]) > 0 ? num(r[cols.id]) : null,
      nome,
      squadra: cols.squadra != null ? String(r[cols.squadra] ?? '').trim() : '',
      patch,
    });
  }
  if (rows.length === 0) {
    throw new Error('Nessuna riga valida trovata nel file statistiche');
  }
  return rows;
}

const matchKey = (nome: string, squadra: string): string =>
  `${nome.toLowerCase().trim()}|${squadra.toLowerCase().trim()}`;

/**
 * Fonde le statistiche nel listone: prima accoppiamento per Id Fantacalcio
 * (stabile nella stagione), poi per nome+squadra normalizzati come fallback.
 */
export function applyStats(
  players: Player[],
  rows: StatsRow[],
): { players: Player[]; matched: number } {
  const byId = new Map<number, StatsRow>();
  const byKey = new Map<string, StatsRow>();
  for (const r of rows) {
    if (r.id != null) byId.set(r.id, r);
    if (r.squadra) byKey.set(matchKey(r.nome, r.squadra), r);
  }

  let matched = 0;
  const out = players.map((p) => {
    const row = byId.get(p.id) ?? (byKey.get(matchKey(p.nome, p.squadra)) ?? null);
    if (!row) return p;
    matched += 1;
    return { ...p, ...row.patch };
  });
  return { players: out, matched };
}
