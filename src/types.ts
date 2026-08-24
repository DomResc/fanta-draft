export type Mode = 'classic' | 'mantra';

export const RUOLI = ['P', 'D', 'C', 'A'] as const;
export type Ruolo = (typeof RUOLI)[number];

export const RUOLO_LABEL: Record<Ruolo, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
};

export interface Player {
  id: number;
  nome: string;
  squadra: string;
  ruolo: Ruolo;
  ruoloMantra: string[];
  qtA: number;
  qtI: number;
  diff: number;
  qtAM: number;
  fvm: number;
  fvmM: number;
  /** Statistiche stagioni precedenti (merge opzionale dal file "Statistiche"
   *  di fantacalcio.it): assenti finché non si carica il file. */
  presenze?: number;
  mv?: number;
  fm?: number;
  gol?: number;
  golSubiti?: number;
  rigoriParati?: number;
  rigoriSegnati?: number;
  rigoriFalliti?: number;
  assist?: number;
}

export interface LeagueConfig {
  budget: number;
  rosterMin: number;
  rosterMax: number;
  /** Solo Classic: quote minime per reparto (rosa a composizione fissa). */
  roleMin?: Record<Ruolo, number> | null;
}

export interface Purchase {
  playerId: number;
  price: number;
}

export type Phase = 'setup' | 'draft';

export interface DraftState {
  phase: Phase;
  config: LeagueConfig;
  purchases: Purchase[];
  takenOthers: number[];
}

export const DEFAULT_CONFIG: LeagueConfig = {
  budget: 1000,
  rosterMin: 28,
  rosterMax: 30,
};

export type Blocco = 'por' | 'dif' | 'off';

export const BLOCCO_LABEL: Record<Blocco, string> = {
  por: 'Portieri',
  dif: 'Difensivi',
  off: 'Offensivi',
};

const SUB_DIFENSIVI = new Set(['Dd', 'Dc', 'Ds', 'B', 'E', 'M']);
const SUB_OFFENSIVI = new Set(['C', 'W', 'T', 'A', 'Pc']);

/** Blocco d'asta: portieri, difensivi (fino a M ed E), offensivi (da C in poi).
 *  I polivalenti a cavallo (es. "M;C") appartengono a entrambi i blocchi. */
export function blocchiOf(p: Player): Blocco[] {
  if (p.ruolo === 'P') return ['por'];
  const out: Blocco[] = [];
  if (p.ruoloMantra.some((r) => SUB_DIFENSIVI.has(r))) out.push('dif');
  if (p.ruoloMantra.some((r) => SUB_OFFENSIVI.has(r))) out.push('off');
  if (out.length === 0) out.push(p.ruolo === 'D' ? 'dif' : 'off');
  return out;
}

export function quoteOf(p: Player, mode: Mode): number {
  return mode === 'mantra' ? p.qtAM : p.qtA;
}

export function ratingOf(p: Player, mode: Mode): number {
  return mode === 'mantra' ? p.fvmM : p.fvm;
}

export function valueDelta(p: Player, mode: Mode): number {
  return ratingOf(p, mode) - quoteOf(p, mode);
}

export function valueRatio(p: Player, mode: Mode): number | null {
  const q = quoteOf(p, mode);
  return q > 0 ? ratingOf(p, mode) / q : null;
}

export function hasStats(p: Player): boolean {
  return typeof p.presenze === 'number' || typeof p.mv === 'number';
}

/** Titolarità in % sulle 38 giornate di Serie A: 38 presenze = 100%.
 *  Null senza statistiche caricate. */
export function titolaritaPct(p: Player): number | null {
  if (typeof p.presenze !== 'number') return null;
  return Math.min(100, Math.round((p.presenze / 38) * 100));
}

/** Affidabilità 0..1 dalla titolarità attesa: 38+ presenze = titolare pieno.
 *  Senza statistiche caricate vale 1 (nessuna penalizzazione). */
export function reliabilityOf(p: Player): number {
  if (typeof p.presenze !== 'number') return 1;
  return Math.min(1, Math.max(0, p.presenze / 38));
}

/** Δ sconto pesato per la titolarità: le presenze scarse riducono il valore
 *  degli affari positivi (un affare che non gioca non è un affare).
 *  I Δ negativi restano invariati, e senza statistiche coincide con valueDelta. */
export function weightedValueDelta(p: Player, mode: Mode): number {
  const delta = valueDelta(p, mode);
  if (delta <= 0) return delta;
  return Math.round(delta * reliabilityOf(p) * 10) / 10;
}
