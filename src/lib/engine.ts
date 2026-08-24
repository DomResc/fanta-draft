import type { DraftState, Mode, Player, Ruolo } from '../types';
import { RUOLI, quoteOf, ratingOf } from '../types';

export interface BudgetStatus {
  spent: number;
  remaining: number;
  rosterMin: number;
  rosterMax: number;
  filled: number;
  minStillNeeded: number;
  freeSlots: number;
  avgPerSlot: number | null;
  byRole: Record<Ruolo, number>;
}

export interface ClassicModule {
  name: string;
  d: number;
  c: number;
  a: number;
}

/** Moduli Classic: vincoli sui ruoli macro. */
export const CLASSIC_MODULES: ClassicModule[] = [
  { name: '3-4-3', d: 3, c: 4, a: 3 },
  { name: '3-5-2', d: 3, c: 5, a: 2 },
  { name: '4-3-3', d: 4, c: 3, a: 3 },
  { name: '4-4-2', d: 4, c: 4, a: 2 },
  { name: '4-5-1', d: 4, c: 5, a: 1 },
  { name: '5-3-2', d: 5, c: 3, a: 2 },
  { name: '5-4-1', d: 5, c: 4, a: 1 },
];

/** Moduli Mantra ufficiali 2026/27: ogni slot elenca i sotto-ruoli ammessi. */
export interface MantraModule {
  name: string;
  slots: string[][];
}

export const MANTRA_MODULES: MantraModule[] = [
  {
    name: '3-4-3',
    slots: [
      ['Dc'], ['Dc'], ['Dc', 'B'],
      ['E'], ['M', 'C'], ['C'], ['E'],
      ['W', 'A'], ['W', 'A'], ['A', 'Pc'],
    ],
  },
  {
    name: '3-4-1-2',
    slots: [
      ['Dc'], ['Dc'], ['Dc', 'B'],
      ['E'], ['M', 'C'], ['C'], ['E'],
      ['T'],
      ['A', 'Pc'], ['A', 'Pc'],
    ],
  },
  {
    name: '3-4-2-1',
    slots: [
      ['Dc'], ['Dc'], ['Dc', 'B'],
      ['M'], ['M', 'C'], ['E'], ['E', 'W'],
      ['T'], ['T', 'A'],
      ['A', 'Pc'],
    ],
  },
  {
    name: '3-5-2',
    slots: [
      ['Dc'], ['Dc'], ['Dc', 'B'],
      ['M'], ['M', 'C'], ['C'], ['E'], ['E', 'W'],
      ['A', 'Pc'], ['A', 'Pc'],
    ],
  },
  {
    name: '3-5-1-1',
    slots: [
      ['Dc'], ['Dc'], ['Dc', 'B'],
      ['M'], ['M'], ['C'], ['E', 'W'], ['E', 'W'],
      ['T', 'A'],
      ['A', 'Pc'],
    ],
  },
  {
    name: '4-3-3',
    slots: [
      ['Dd'], ['Dc'], ['Dc'], ['Ds'],
      ['M', 'C'], ['M'], ['C'],
      ['W', 'A'], ['W', 'A'], ['A', 'Pc'],
    ],
  },
  {
    name: '4-3-1-2',
    slots: [
      ['Dd'], ['Dc'], ['Dc'], ['Ds'],
      ['M', 'C'], ['M'], ['C'],
      ['T'],
      ['T', 'A', 'Pc'], ['A', 'Pc'],
    ],
  },
  {
    name: '4-4-2',
    slots: [
      ['Dd'], ['Dc'], ['Dc'], ['Ds'],
      ['M', 'C'], ['C'], ['E'], ['E', 'W'],
      ['A', 'Pc'], ['A', 'Pc'],
    ],
  },
  {
    name: '4-1-4-1',
    slots: [
      ['Dd'], ['Dc'], ['Dc'], ['Ds'],
      ['M'],
      ['C', 'T'], ['T'], ['E', 'W'], ['W'],
      ['A', 'Pc'],
    ],
  },
  {
    name: '4-4-1-1',
    slots: [
      ['Dd'], ['Dc'], ['Dc'], ['Ds'],
      ['M'], ['C'], ['E', 'W'], ['E', 'W'],
      ['T', 'A'],
      ['A', 'Pc'],
    ],
  },
  {
    name: '4-2-3-1',
    slots: [
      ['Dd'], ['Dc'], ['Dc'], ['Ds'],
      ['M'], ['M', 'C'],
      ['W', 'T'], ['T'], ['W', 'A'],
      ['A', 'Pc'],
    ],
  },
];

export function modulesFor(mode: Mode): Array<ClassicModule | MantraModule> {
  return mode === 'mantra' ? MANTRA_MODULES : CLASSIC_MODULES;
}

const SUB_D = new Set(['Dd', 'Dc', 'Ds', 'B']);
const SUB_A = new Set(['A', 'Pc']);

function slotCategoria(slot: string[]): Ruolo {
  if (slot.some((s) => SUB_D.has(s))) return 'D';
  if (slot.some((s) => SUB_A.has(s))) return 'A';
  return 'C';
}

function fitsSlot(p: Player, slot: string[]): boolean {
  if (p.ruolo !== slotCategoria(slot)) return false;
  if (p.ruoloMantra.length === 0) return true;
  return p.ruoloMantra.some((r) => slot.includes(r));
}

export function buildIndex(players: Player[]): Map<number, Player> {
  return new Map(players.map((p) => [p.id, p]));
}

export function availability(state: DraftState): { mine: Set<number>; others: Set<number> } {
  return {
    mine: new Set(state.purchases.map((x) => x.playerId)),
    others: new Set(state.takenOthers),
  };
}

export function ownedPlayers(byId: Map<number, Player>, state: DraftState): Player[] {
  const out: Player[] = [];
  for (const x of state.purchases) {
    const p = byId.get(x.playerId);
    if (p) out.push(p);
  }
  return out;
}

export function countByRole(players: Player[]): Record<Ruolo, number> {
  const c: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const p of players) c[p.ruolo] += 1;
  return c;
}

export function budgetStatus(
  byId: Map<number, Player>,
  state: DraftState,
): BudgetStatus {
  const owned = ownedPlayers(byId, state);
  const byRole = countByRole(owned);
  const spent = state.purchases.reduce((a, x) => a + x.price, 0);
  const remaining = state.config.budget - spent;
  const filled = owned.length;
  const freeSlots = Math.max(0, state.config.rosterMax - filled);
  const roleMin = state.config.roleMin;
  const minStillNeeded = roleMin
    ? RUOLI.reduce((a, r) => a + Math.max(0, (roleMin[r] ?? 0) - byRole[r]), 0)
    : Math.max(0, state.config.rosterMin - filled);

  return {
    spent,
    remaining,
    rosterMin: state.config.rosterMin,
    rosterMax: state.config.rosterMax,
    filled,
    minStillNeeded,
    freeSlots,
    avgPerSlot: freeSlots > 0 ? Math.floor(remaining / freeSlots) : null,
    byRole,
  };
}

/** Costo minimo per acquistare `count` giocatori (di ruolo `ruolo`, se indicato)
 *  dal pool disponibile. */
export function cheapestFill(
  allPlayers: Player[],
  exclude: Set<number>,
  count: number,
  mode: Mode,
  ruolo?: Ruolo,
): number {
  if (count <= 0) return 0;
  const quotes = allPlayers
    .filter((p) => (ruolo ? p.ruolo === ruolo : true) && !exclude.has(p.id))
    .map((p) => quoteOf(p, mode))
    .sort((a, b) => a - b)
    .slice(0, count);
  if (quotes.length < count) return Number.POSITIVE_INFINITY;
  return quotes.reduce((a, b) => a + b, 0);
}

/**
 * Offerta massima sostenibile per un giocatore: budget residuo meno il costo
 * minimo per coprire gli acquisti ancora obbligatori (per reparto in Classic
 * con quote roleMin, globale sulla rosa minima altrimenti).
 */
export function maxBidFor(
  allPlayers: Player[],
  byId: Map<number, Player>,
  state: DraftState,
  playerId: number,
  mode: Mode,
): number | null {
  const target = byId.get(playerId);
  if (!target) return null;
  const { mine, others } = availability(state);
  if (mine.has(playerId) || others.has(playerId)) return null;

  const spent = state.purchases.reduce((a, x) => a + x.price, 0);
  const remaining = state.config.budget - spent;
  const exclude = new Set<number>([...mine, ...others, playerId]);
  const roleMin = state.config.roleMin;

  let fill: number;
  if (roleMin) {
    const counts = countByRole(ownedPlayers(byId, state));
    fill = 0;
    for (const r of RUOLI) {
      const need = (roleMin[r] ?? 0) - counts[r] - (r === target.ruolo ? 1 : 0);
      if (need < 0) return null;
      fill += cheapestFill(allPlayers, exclude, need, mode, r);
    }
  } else {
    const need = Math.max(0, state.config.rosterMin - state.purchases.length - 1);
    fill = cheapestFill(allPlayers, exclude, need, mode);
  }

  if (!Number.isFinite(fill)) return Math.max(0, remaining);
  return Math.max(0, remaining - fill);
}

export interface Target {
  player: Player;
  maxBid: number;
}

export function roleTargets(
  allPlayers: Player[],
  byId: Map<number, Player>,
  state: DraftState,
  ruolo: Ruolo,
  mode: Mode,
  limit = 3,
): Target[] {
  const { mine, others } = availability(state);
  return allPlayers
    .filter((p) => p.ruolo === ruolo && !mine.has(p.id) && !others.has(p.id))
    .sort(
      (a, b) =>
        ratingOf(b, mode) - ratingOf(a, mode) ||
        quoteOf(a, mode) - quoteOf(b, mode),
    )
    .slice(0, limit)
    .map((player) => ({
      player,
      maxBid: maxBidFor(allPlayers, byId, state, player.id, mode) ?? 0,
    }));
}

export interface LineupResult {
  moduleName: string;
  starters: Player[];
  bench: Player[];
  complete: boolean;
  score: number;
}

function orderStarters(picks: Player[], mode: Mode): Player[] {
  const order: Record<Ruolo, number> = { P: 0, D: 1, C: 2, A: 3 };
  return [...picks].sort(
    (a, b) =>
      order[a.ruolo] - order[b.ruolo] ||
      ratingOf(b, mode) - ratingOf(a, mode),
  );
}

function bestClassicLineup(
  roster: Player[],
  mode: Mode,
  forcedName: string | null,
): { moduleName: string; picks: Player[]; score: number } | null {
  const pools = new Map<Ruolo, Player[]>();
  for (const r of RUOLI) {
    pools.set(
      r,
      roster.filter((p) => p.ruolo === r).sort((a, b) => ratingOf(b, mode) - ratingOf(a, mode)),
    );
  }

  const candidates = forcedName
    ? CLASSIC_MODULES.filter((m) => m.name === forcedName)
    : CLASSIC_MODULES;

  let best: { moduleName: string; picks: Player[]; score: number } | null = null;
  for (const m of candidates) {
    if (
      pools.get('P')!.length < 1 ||
      pools.get('D')!.length < m.d ||
      pools.get('C')!.length < m.c ||
      pools.get('A')!.length < m.a
    ) {
      continue;
    }
    const picks: Player[] = [...pools.get('P')!.slice(0, 1)];
    let score = ratingOf(picks[0], mode);
    for (const [role, n] of [
      ['D', m.d],
      ['C', m.c],
      ['A', m.a],
    ] as const) {
      const top = pools.get(role)!.slice(0, n);
      picks.push(...top);
      score += top.reduce((a, p) => a + ratingOf(p, mode), 0);
    }
    if (!best || score > best.score) best = { moduleName: m.name, picks, score };
  }
  return best;
}

/** Assegnamento ottimale dei giocatori agli slot del modulo mantra
 *  (branch & bound con bound sui rating massimi residui). */
function bestMantraAssignment(
  roster: Player[],
  module: MantraModule,
): { picks: Player[]; score: number } | null {
  const bySlot: Player[][] = module.slots.map((slot) =>
    roster
      .filter((p) => fitsSlot(p, slot))
      .sort((a, b) => ratingOf(b, 'mantra') - ratingOf(a, 'mantra')),
  );

  if (bySlot.some((c) => c.length === 0)) return null;

  const suffixBound = new Array<number>(module.slots.length + 1).fill(0);
  for (let i = module.slots.length - 1; i >= 0; i--) {
    suffixBound[i] = suffixBound[i + 1] + ratingOf(bySlot[i][0], 'mantra');
  }

  const used = new Set<number>();
  const picks: Player[] = [];
  let best: { picks: Player[]; score: number } | null = null;

  function bt(i: number, score: number): void {
    if (best && score + suffixBound[i] <= best.score) return;
    if (i === module.slots.length) {
      best = { picks: [...picks], score };
      return;
    }
    for (const p of bySlot[i]) {
      if (used.has(p.id)) continue;
      used.add(p.id);
      picks.push(p);
      bt(i + 1, score + ratingOf(p, 'mantra'));
      picks.pop();
      used.delete(p.id);
    }
  }

  bt(0, 0);
  return best;
}

function bestMantraLineup(
  roster: Player[],
  forcedName: string | null,
): { moduleName: string; picks: Player[]; score: number } | null {
  const portieri = roster
    .filter((p) => p.ruolo === 'P')
    .sort((a, b) => ratingOf(b, 'mantra') - ratingOf(a, 'mantra'));
  if (portieri.length === 0) return null;
  const por = portieri[0];
  const outfield = roster.filter((p) => p.ruolo !== 'P');

  const candidates = forcedName
    ? MANTRA_MODULES.filter((m) => m.name === forcedName)
    : MANTRA_MODULES;

  let best: { moduleName: string; picks: Player[]; score: number } | null = null;
  for (const m of candidates) {
    const res = bestMantraAssignment(outfield, m);
    if (!res) continue;
    const score = res.score + ratingOf(por, 'mantra');
    if (!best || score > best.score) {
      best = { moduleName: m.name, picks: [por, ...res.picks], score };
    }
  }
  return best;
}

/**
 * Miglior undici dalla rosa posseduta: massimizza la somma dei rating
 * (FVM in Classic, FVM M in Mantra). In Mantra usa i moduli ufficiali
 * a slot con assegnamento ottimale dei sotto-ruoli.
 */
export function bestLineup(
  roster: Player[],
  mode: Mode,
  forcedName?: string | null,
): LineupResult {
  const best =
    mode === 'mantra'
      ? bestMantraLineup(roster, forcedName ?? null)
      : bestClassicLineup(roster, mode, forcedName ?? null);

  if (best) {
    const ids = new Set(best.picks.map((p) => p.id));
    return {
      moduleName: best.moduleName,
      starters: orderStarters(best.picks, mode),
      bench: roster.filter((p) => !ids.has(p.id)),
      complete: true,
      score: best.score,
    };
  }

  const sorted = [...roster].sort((a, b) => ratingOf(b, mode) - ratingOf(a, mode));
  const starters = sorted.slice(0, Math.min(11, sorted.length));
  const ids = new Set(starters.map((p) => p.id));
  return {
    moduleName: '—',
    starters,
    bench: roster.filter((p) => !ids.has(p.id)),
    complete: false,
    score: starters.reduce((a, p) => a + ratingOf(p, mode), 0),
  };
}

export interface SlotView {
  /** Etichetta del ruolo richiesto (es. "P", "D", "E/W", "T/A"). */
  label: string;
  ruolo: Ruolo;
  /** Chiavi raw dello slot per fitsSlot (Classic: [ruolo]). */
  slotKeys: string[];
  player: Player | null;
}

/**
 * Scompone il modulo in slot e li riempie con i migliori giocatori in rosa,
 * ammettendo slot vuoti (rosa incompleta). In Mantra l'assegnamento è
 * ottimale anche parziale (B&B che può saltare gli slot).
 */
export function lineupSlots(
  roster: Player[],
  mode: Mode,
  moduleName: string,
): SlotView[] | null {
  if (mode === 'classic') {
    const m = CLASSIC_MODULES.find((x) => x.name === moduleName);
    if (!m) return null;
    const pools = new Map<Ruolo, Player[]>();
    for (const r of RUOLI) {
      pools.set(
        r,
        roster
          .filter((p) => p.ruolo === r)
          .sort((a, b) => ratingOf(b, mode) - ratingOf(a, mode)),
      );
    }
    const slots: SlotView[] = [
      { label: 'P', ruolo: 'P', slotKeys: ['P'], player: pools.get('P')![0] ?? null },
    ];
    for (const [role, n] of [
      ['D', m.d],
      ['C', m.c],
      ['A', m.a],
    ] as const) {
      const top = pools.get(role)!.slice(0, n);
      for (let i = 0; i < n; i++) {
        slots.push({ label: role, ruolo: role, slotKeys: [role], player: top[i] ?? null });
      }
    }
    return slots;
  }

  const m = MANTRA_MODULES.find((x) => x.name === moduleName);
  if (!m) return null;
  const portieri = roster
    .filter((p) => p.ruolo === 'P')
    .sort((a, b) => ratingOf(b, 'mantra') - ratingOf(a, 'mantra'));
  const outfield = roster.filter((p) => p.ruolo !== 'P');
  const slots: SlotView[] = [
    { label: 'Por', ruolo: 'P', slotKeys: ['Por'], player: portieri[0] ?? null },
  ];

  const bySlot: Player[][] = m.slots.map((slot) =>
    outfield
      .filter((p) => fitsSlot(p, slot))
      .sort((a, b) => ratingOf(b, 'mantra') - ratingOf(a, 'mantra')),
  );
  const suffixBound = new Array<number>(m.slots.length + 1).fill(0);
  for (let i = m.slots.length - 1; i >= 0; i--) {
    suffixBound[i] =
      suffixBound[i + 1] + (bySlot[i].length > 0 ? ratingOf(bySlot[i][0], 'mantra') : 0);
  }

  const used = new Set<number>();
  const picks: Array<Player | null> = [];
  let best: { picks: Array<Player | null>; score: number } | null = null;

  function bt(i: number, score: number): void {
    if (best && score + suffixBound[i] <= best.score) return;
    if (i === m!.slots.length) {
      best = { picks: [...picks], score };
      return;
    }
    // prima i giocatori (alza subito il bound), poi l'opzione slot vuoto
    for (const p of bySlot[i]) {
      if (used.has(p.id)) continue;
      used.add(p.id);
      picks.push(p);
      bt(i + 1, score + ratingOf(p, 'mantra'));
      picks.pop();
      used.delete(p.id);
    }
    picks.push(null);
    bt(i + 1, score);
    picks.pop();
  }

  bt(0, 0);
  const res = best ?? { picks: m.slots.map(() => null), score: 0 };
  m.slots.forEach((slot, i) => {
    slots.push({
      label: slot.join('/'),
      ruolo: slotCategoria(slot),
      slotKeys: slot,
      player: res.picks[i],
    });
  });
  return slots;
}

export interface SlotSuggestion {
  player: Player;
  maxBid: number;
}

/** Migliori acquisti ancora disponibili per uno slot scoperto del modulo. */
export function slotSuggestions(
  allPlayers: Player[],
  byId: Map<number, Player>,
  state: DraftState,
  mode: Mode,
  moduleName: string,
  slotIndex: number,
  limit = 3,
): SlotSuggestion[] {
  const roster = ownedPlayers(byId, state);
  const slots = lineupSlots(roster, mode, moduleName);
  const slot = slots?.[slotIndex];
  if (!slot || slot.player) return [];

  const { mine, others } = availability(state);
  const fits =
    slot.ruolo === 'P'
      ? (p: Player) => p.ruolo === 'P'
      : mode === 'classic'
        ? (p: Player) => p.ruolo === slot.ruolo
        : (p: Player) => fitsSlot(p, slot.slotKeys);

  return allPlayers
    .filter((p) => !mine.has(p.id) && !others.has(p.id) && fits(p))
    .sort(
      (a, b) =>
        ratingOf(b, mode) - ratingOf(a, mode) || quoteOf(a, mode) - quoteOf(b, mode),
    )
    .slice(0, limit)
    .map((player) => ({
      player,
      maxBid: maxBidFor(allPlayers, byId, state, player.id, mode) ?? 0,
    }));
}

export interface Upgrade {
  player: Player;
  gain: number;
  maxBid: number;
  newModuleName: string;
}

/**
 * Simula l'aggiunta dei migliori giocatori ancora disponibili alla rosa:
 * per ciascuno ricalcola l'undici ideale e misura il guadagno sulla Σ FVM.
 */
export function findUpgrades(
  allPlayers: Player[],
  byId: Map<number, Player>,
  state: DraftState,
  mode: Mode,
  limit = 5,
  candidatePool = 30,
): { currentScore: number; upgrades: Upgrade[] } {
  const roster = ownedPlayers(byId, state);
  const current = bestLineup(roster, mode);
  const { mine, others } = availability(state);

  const candidates = allPlayers
    .filter((p) => !mine.has(p.id) && !others.has(p.id))
    .sort((a, b) => ratingOf(b, mode) - ratingOf(a, mode))
    .slice(0, candidatePool);

  const upgrades: Upgrade[] = [];
  for (const cand of candidates) {
    const sim = bestLineup([...roster, cand], mode);
    const gain = Math.round((sim.score - current.score) * 10) / 10;
    if (gain <= 0) continue;
    upgrades.push({
      player: cand,
      gain,
      maxBid: maxBidFor(allPlayers, byId, state, cand.id, mode) ?? 0,
      newModuleName: sim.moduleName,
    });
  }

  upgrades.sort((a, b) => b.gain - a.gain || quoteOf(a.player, mode) - quoteOf(b.player, mode));
  return { currentScore: current.score, upgrades: upgrades.slice(0, limit) };
}
