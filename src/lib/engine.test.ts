import { describe, expect, it } from 'vitest';
import type { DraftState, LeagueConfig, Player, Ruolo } from '../types';
import { blocchiOf, valueDelta, valueRatio } from '../types';
import {
  CLASSIC_MODULES,
  MANTRA_MODULES,
  bestLineup,
  budgetStatus,
  buildIndex,
  cheapestFill,
  findUpgrades,
  maxBidFor,
  modulesFor,
  roleTargets,
} from './engine';

let seq = 1;
function mk(opts: Partial<Player> & { ruolo: Ruolo; qtA: number }): Player {
  const id = opts.id ?? seq++;
  return {
    id,
    nome: opts.nome ?? `G${id}`,
    squadra: opts.squadra ?? 'Test',
    ruolo: opts.ruolo,
    ruoloMantra: opts.ruoloMantra ?? [],
    qtA: opts.qtA,
    qtI: opts.qtI ?? opts.qtA,
    diff: opts.diff ?? 0,
    qtAM: opts.qtAM ?? opts.qtA,
    fvm: opts.fvm ?? 0,
    fvmM: opts.fvmM ?? 0,
  };
}

function stateOf(config: LeagueConfig, purchases: Array<[number, number]> = [], takenOthers: number[] = []): DraftState {
  return {
    phase: 'draft',
    config,
    purchases: purchases.map(([playerId, price]) => ({ playerId, price })),
    takenOthers,
  };
}

const CFG: LeagueConfig = { budget: 1000, rosterMin: 28, rosterMax: 30 };

describe('blocchi asta', () => {
  it('portieri, difensivi (fino a M ed E), offensivi (da C in poi)', () => {
    expect(blocchiOf(mk({ ruolo: 'P', qtA: 10, ruoloMantra: ['Por'] }))).toEqual(['por']);
    expect(blocchiOf(mk({ ruolo: 'D', qtA: 10, ruoloMantra: ['Dd'] }))).toEqual(['dif']);
    expect(blocchiOf(mk({ ruolo: 'C', qtA: 10, ruoloMantra: ['E'] }))).toEqual(['dif']);
    expect(blocchiOf(mk({ ruolo: 'C', qtA: 10, ruoloMantra: ['M'] }))).toEqual(['dif']);
    expect(blocchiOf(mk({ ruolo: 'C', qtA: 10, ruoloMantra: ['C'] }))).toEqual(['off']);
    expect(blocchiOf(mk({ ruolo: 'C', qtA: 10, ruoloMantra: ['W'] }))).toEqual(['off']);
    expect(blocchiOf(mk({ ruolo: 'A', qtA: 10, ruoloMantra: ['Pc'] }))).toEqual(['off']);
  });

  it('i polivalenti a cavallo stanno in entrambi i blocchi', () => {
    expect(blocchiOf(mk({ ruolo: 'C', qtA: 10, ruoloMantra: ['M', 'C'] }))).toEqual([
      'dif',
      'off',
    ]);
    expect(blocchiOf(mk({ ruolo: 'C', qtA: 10, ruoloMantra: ['E', 'W'] }))).toEqual([
      'dif',
      'off',
    ]);
  });

  it('fallback sul ruolo macro se mancano i sotto-ruoli', () => {
    expect(blocchiOf(mk({ ruolo: 'D', qtA: 10 }))).toEqual(['dif']);
    expect(blocchiOf(mk({ ruolo: 'A', qtA: 10 }))).toEqual(['off']);
  });
});

describe('cheapestFill', () => {
  const players = [
    mk({ ruolo: 'A', qtA: 30 }),
    mk({ ruolo: 'A', qtA: 10 }),
    mk({ ruolo: 'D', qtA: 20 }),
    mk({ ruolo: 'P', qtA: 5 }),
  ];

  it('somma le quotazioni più basse a prescindere dal ruolo', () => {
    expect(cheapestFill(players, new Set(), 3, 'classic')).toBe(35);
  });

  it('esclude gli id indicati', () => {
    const exclude = new Set(players.filter((p) => p.qtA === 5).map((p) => p.id));
    expect(cheapestFill(players, exclude, 2, 'classic')).toBe(30);
  });

  it('ritorna Infinity se il pool non basta', () => {
    expect(cheapestFill(players, new Set(), 5, 'classic')).toBe(Infinity);
  });
});

describe('maxBidFor', () => {
  const players = [
    mk({ ruolo: 'P', qtA: 10 }),
    mk({ ruolo: 'D', qtA: 50 }),
    mk({ ruolo: 'D', qtA: 20 }),
    mk({ ruolo: 'C', qtA: 15 }),
    mk({ ruolo: 'A', qtA: 100 }),
    mk({ ruolo: 'A', qtA: 5 }),
  ];
  const byId = buildIndex(players);
  const star = players.find((p) => p.qtA === 100)!;

  it('con rosa minima irraggiungibile col pool, il vincolo decade', () => {
    const s = stateOf(CFG);
    expect(maxBidFor(players, byId, s, star.id, 'classic')).toBe(1000);
  });

  it('garantisce i crediti per raggiungere la rosa minima', () => {
    const cfg: LeagueConfig = { budget: 200, rosterMin: 5, rosterMax: 6 };
    const s = stateOf(cfg);
    // comprando A100 restano 4 slot obbligatori: i 4 più economici = 5+10+15+20 = 50
    expect(maxBidFor(players, byId, s, star.id, 'classic')).toBe(150);
  });

  it('esclude il target dal calcolo di riempimento', () => {
    const cfg: LeagueConfig = { budget: 200, rosterMin: 5, rosterMax: 6 };
    const s = stateOf(cfg);
    const cheap = players.find((p) => p.qtA === 5)!;
    // comprando A5: i 4 più economici rimasti = 10+15+20+50 = 95
    expect(maxBidFor(players, byId, s, cheap.id, 'classic')).toBe(105);
  });

  it('null per giocatore non disponibile', () => {
    const s = stateOf(CFG, [], [star.id]);
    expect(maxBidFor(players, byId, s, star.id, 'classic')).toBeNull();
  });

  it('mai sotto zero', () => {
    const cfg: LeagueConfig = { budget: 12, rosterMin: 5, rosterMax: 6 };
    const s = stateOf(cfg);
    expect(maxBidFor(players, byId, s, star.id, 'classic')).toBe(0);
  });

  it('con quote per reparto (Classic) riempie reparto per reparto', () => {
    const cfg: LeagueConfig = {
      budget: 200,
      rosterMin: 5,
      rosterMax: 5,
      roleMin: { P: 1, D: 1, C: 1, A: 2 },
    };
    const s = stateOf(cfg);
    // comprando A100 restano obbligatori: P10 + D20 + C15 + A5 = 50
    expect(maxBidFor(players, byId, s, star.id, 'classic')).toBe(150);
  });

  it('null se l acquisto supera la quota di reparto', () => {
    const cfg: LeagueConfig = {
      budget: 200,
      rosterMin: 4,
      rosterMax: 4,
      roleMin: { P: 1, D: 1, C: 1, A: 1 },
    };
    const s = stateOf(cfg, [[star.id, 100]]);
    const otherA = players.find((p) => p.ruolo === 'A' && p.id !== star.id)!;
    expect(maxBidFor(players, byId, s, otherA.id, 'classic')).toBeNull();
    const dif = players.find((p) => p.ruolo === 'D' && p.qtA === 20)!;
    expect(maxBidFor(players, byId, s, dif.id, 'classic')).not.toBeNull();
  });
});

describe('budgetStatus', () => {
  it('calcola speso, residuo, rosa e minimi obbligatori', () => {
    const players = [mk({ ruolo: 'P', qtA: 10 }), mk({ ruolo: 'A', qtA: 40 })];
    const byId = buildIndex(players);
    const s = stateOf(CFG, [
      [players[0].id, 12],
      [players[1].id, 88],
    ]);
    const st = budgetStatus(byId, s);
    expect(st.spent).toBe(100);
    expect(st.remaining).toBe(900);
    expect(st.filled).toBe(2);
    expect(st.minStillNeeded).toBe(26);
    expect(st.freeSlots).toBe(28);
    expect(st.avgPerSlot).toBe(Math.floor(900 / 28));
    expect(st.byRole.P).toBe(1);
    expect(st.byRole.D).toBe(0);
  });

  it('minStillNeeded somma i deficit per reparto se ci sono quote', () => {
    const players = [mk({ ruolo: 'P', qtA: 10 }), mk({ ruolo: 'A', qtA: 40 })];
    const byId = buildIndex(players);
    const cfg: LeagueConfig = {
      budget: 500,
      rosterMin: 6,
      rosterMax: 6,
      roleMin: { P: 1, D: 2, C: 2, A: 1 },
    };
    const s = stateOf(cfg, [
      [players[0].id, 10],
      [players[1].id, 40],
    ]);
    const st = budgetStatus(byId, s);
    expect(st.minStillNeeded).toBe(4);
  });
});

describe('bestLineup Classic', () => {
  function roster(nByRole: Record<Ruolo, number>, baseFvm = 50): Player[] {
    const out: Player[] = [];
    for (const r of ['P', 'D', 'C', 'A'] as Ruolo[]) {
      for (let i = 0; i < nByRole[r]; i++) {
        out.push(mk({ ruolo: r, qtA: 10, fvm: baseFvm - i * 10 }));
      }
    }
    return out;
  }

  it('sceglie il modulo che massimizza il punteggio', () => {
    const ros = roster({ P: 2, D: 6, C: 6, A: 4 }, 60);
    const res = bestLineup(ros, 'classic');
    expect(res.complete).toBe(true);
    expect(res.starters).toHaveLength(11);
    const counts = { P: 0, D: 0, C: 0, A: 0 };
    for (const p of res.starters) counts[p.ruolo] += 1;
    expect(counts.P).toBe(1);
    expect(
      CLASSIC_MODULES.some(
        (m) => m.d === counts.D && m.c === counts.C && m.a === counts.A,
      ),
    ).toBe(true);
  });

  it('forza il modulo richiesto quando fattibile', () => {
    const ros = roster({ P: 2, D: 6, C: 6, A: 4 }, 50);
    const res = bestLineup(ros, 'classic', '3-4-3');
    expect(res.moduleName).toBe('3-4-3');
    const counts = { P: 0, D: 0, C: 0, A: 0 };
    for (const p of res.starters) counts[p.ruolo] += 1;
    expect([counts.D, counts.C, counts.A]).toEqual([3, 4, 3]);
  });

  it('usa FVM M in modalità mantra', () => {
    const base = roster({ P: 2, D: 6, C: 6, A: 4 }, 80).map((p) => ({
      ...p,
      fvmM: p.fvm,
    }));
    const a = mk({ ruolo: 'C', qtA: 10, fvm: 90, fvmM: 10 });
    const b = mk({ ruolo: 'C', qtA: 10, fvm: 10, fvmM: 99 });
    const ros = base.filter((p) => p.ruolo !== 'C').concat([a, b]);
    const res = bestLineup(ros, 'mantra');
    expect(res.starters.some((p) => p.id === b.id)).toBe(true);
    expect(res.starters.some((p) => p.id === a.id)).toBe(false);
  });

  it('fallback incompleto con rosa insufficiente', () => {
    const ros = [mk({ ruolo: 'P', qtA: 10 }), mk({ ruolo: 'D', qtA: 10 })];
    const res = bestLineup(ros, 'classic');
    expect(res.complete).toBe(false);
    expect(res.starters).toHaveLength(2);
  });
});

describe('bestLineup Mantra (moduli ufficiali a slot)', () => {
  const ros = [
    mk({ id: 1, ruolo: 'P', qtA: 10, fvmM: 60, ruoloMantra: ['Por'] }),
    mk({ id: 2, ruolo: 'D', qtA: 10, fvmM: 90, ruoloMantra: ['Dc'] }),
    mk({ id: 3, ruolo: 'D', qtA: 10, fvmM: 85, ruoloMantra: ['Dc'] }),
    mk({ id: 4, ruolo: 'D', qtA: 10, fvmM: 80, ruoloMantra: ['Dc', 'B'] }),
    mk({ id: 6, ruolo: 'C', qtA: 10, fvmM: 70, ruoloMantra: ['M'] }),
    mk({ id: 7, ruolo: 'C', qtA: 10, fvmM: 65, ruoloMantra: ['M', 'C'] }),
    mk({ id: 8, ruolo: 'C', qtA: 10, fvmM: 60, ruoloMantra: ['C'] }),
    mk({ id: 9, ruolo: 'C', qtA: 10, fvmM: 55, ruoloMantra: ['E'] }),
    mk({ id: 10, ruolo: 'C', qtA: 10, fvmM: 50, ruoloMantra: ['E', 'W'] }),
    mk({ id: 11, ruolo: 'A', qtA: 10, fvmM: 75, ruoloMantra: ['A'] }),
    mk({ id: 12, ruolo: 'A', qtA: 10, fvmM: 70, ruoloMantra: ['A'] }),
  ];

  it('sceglie l unico modulo compatibile quando i sotto-ruoli lo impongono', () => {
    // senza W puri/ibridi da ali, il 3-4-3 (che richiede 2 slot W/A) è infattibile:
    // l'unico modulo completabile è il 3-5-2
    const res = bestLineup(ros, 'mantra');
    expect(res.complete).toBe(true);
    expect(res.moduleName).toBe('3-5-2');
    expect(res.starters).toHaveLength(11);
    expect(new Set(res.starters.map((p) => p.id)).size).toBe(11);
  });

  it('rispetta i sotto-ruoli degli slot (un Dc puro non gioca Dd)', () => {
    const res = bestLineup(ros, 'mantra', '4-3-3');
    // 4-3-3 richiede Dd e Ds: assenti in rosa → fallback incompleto
    expect(res.complete).toBe(false);
  });

  it('un polivalente occupa un solo slot per volta', () => {
    const res = bestLineup(ros, 'mantra', '3-4-2-1');
    // 3-4-2-1 richiede slot [T] e [T/A]: nessun T in rosa → incompleto
    expect(res.complete).toBe(false);
  });

  it('tutti i moduli ufficiali hanno 10 slot e categorie coerenti', () => {
    expect(MANTRA_MODULES).toHaveLength(11);
    for (const m of MANTRA_MODULES) {
      expect(m.slots).toHaveLength(10);
    }
    expect(modulesFor('mantra')).toBe(MANTRA_MODULES);
    expect(modulesFor('classic')).toBe(CLASSIC_MODULES);
  });
});

describe('findUpgrades', () => {
  function fullWeakRoster(): Player[] {
    const out: Player[] = [];
    const plan: Array<[Ruolo, number]> = [
      ['P', 1],
      ['D', 4],
      ['C', 4],
      ['A', 2],
    ];
    let id = 100;
    for (const [r, n] of plan) {
      for (let i = 0; i < n; i++) {
        out.push(mk({ id: id++, ruolo: r, qtA: 10, fvm: 50 }));
      }
    }
    return out;
  }

  it('trova l upgrade che alza la Σ FVM e ne quantifica il guadagno', () => {
    const roster = fullWeakRoster();
    const star = mk({ ruolo: 'C', qtA: 30, fvm: 90 });
    const players = [...roster, star];
    const byId = buildIndex(players);
    const s = stateOf(CFG, roster.map((p) => [p.id, 10] as [number, number]));

    const base = bestLineup(roster, 'classic').score;
    const res = findUpgrades(players, byId, s, 'classic');

    expect(res.currentScore).toBe(base);
    expect(res.upgrades.length).toBeGreaterThan(0);
    const top = res.upgrades[0];
    expect(top.player.id).toBe(star.id);
    expect(top.gain).toBeGreaterThan(0);
    expect(res.currentScore + top.gain).toBe(
      bestLineup([...roster, star], 'classic').score,
    );
  });

  it('non propone giocatori già presi da altri o in rosa', () => {
    const roster = fullWeakRoster();
    const star = mk({ ruolo: 'C', qtA: 30, fvm: 90 });
    const players = [...roster, star];
    const byId = buildIndex(players);
    const s = stateOf(CFG, roster.map((p) => [p.id, 10] as [number, number]), [star.id]);
    const res = findUpgrades(players, byId, s, 'classic');
    expect(res.upgrades.some((u) => u.player.id === star.id)).toBe(false);
  });

  it('nessun upgrade se il mercato non offre migliori', () => {
    const roster = fullWeakRoster().map((p) => ({ ...p, fvm: 99 }));
    const weaker = mk({ ruolo: 'P', qtA: 2, fvm: 10 });
    const players = [...roster, weaker];
    const byId = buildIndex(players);
    const s = stateOf(CFG, roster.map((p) => [p.id, 10] as [number, number]));
    const res = findUpgrades(players, byId, s, 'classic');
    expect(res.upgrades).toHaveLength(0);
  });
});

describe('roleTargets', () => {
  it('ordina per rating ed esclude non disponibili', () => {
    const players = [
      mk({ ruolo: 'A', qtA: 50, fvm: 90 }),
      mk({ ruolo: 'A', qtA: 40, fvm: 95 }),
      mk({ ruolo: 'A', qtA: 30, fvm: 85 }),
      mk({ ruolo: 'A', qtA: 20, fvm: 70 }),
    ];
    const byId = buildIndex(players);
    const s = stateOf(CFG, [], [players[0].id]);
    const targets = roleTargets(players, byId, s, 'A', 'classic', 2);
    expect(targets.map((t) => t.player.id)).toEqual([players[1].id, players[2].id]);
    expect(targets.every((t) => typeof t.maxBid === 'number')).toBe(true);
  });
});

describe('valueDelta / valueRatio', () => {
  it('calcolano delta e rapporto su colonne giuste per modalità', () => {
    const p = mk({ ruolo: 'A', qtA: 20, fvm: 50, qtAM: 40, fvmM: 30 });
    expect(valueDelta(p, 'classic')).toBe(30);
    expect(valueRatio(p, 'classic')).toBe(2.5);
    expect(valueDelta(p, 'mantra')).toBe(-10);
    expect(valueRatio(p, 'mantra')).toBeCloseTo(0.75);
  });

  it('ritorna null se la quotazione è zero', () => {
    const p = mk({ ruolo: 'C', qtA: 0, fvm: 10 });
    expect(valueRatio(p, 'classic')).toBeNull();
    expect(valueDelta(p, 'classic')).toBe(10);
  });
});
