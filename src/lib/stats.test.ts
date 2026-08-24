import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { applyStats, parseStatistiche } from './stats';
import type { Player } from '../types';

function buildWorkbook(
  rows: (string | number)[][],
  sheetName = 'Statistiche',
): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/** Colonne reali del file "Statistiche" di fantacalcio.it (es. 2025/26):
 *  Id, R, Rm, Nome, Squadra, Pv, Mv, Fm, Gf, Gs, Rp, Rc, R+, R-, Ass, Amm, Esp, Au. */
const HEADER = [
  'Id',
  'R',
  'Rm',
  'Nome',
  'Squadra',
  'Pv',
  'Mv',
  'Fm',
  'Gf',
  'Gs',
  'Rp',
  'Rc',
  'R+',
  'R-',
  'Ass',
  'Amm',
  'Esp',
  'Au',
];

function statRows(): (string | number)[][] {
  return [
    ['Statistiche Fantacalcio Stagione 2025 26'],
    HEADER,
    // Carnesecchi (P): 37 presenze, 35 gol subiti, 2 rigori parati
    [4431, 'P', 'Por', 'Carnesecchi', 'Atalanta', 37, 6.36, 5.58, 0, 35, 2, 0, 0, 0, 0, 0, 0, 0],
    // Martinez L. (A): 30 presenze, 17 gol, 6 assist
    [2764, 'A', 'Pc', 'Martinez L.', 'Inter', 30, 6.42, 8.25, 17, 0, 0, 0, 0, 0, 6, 4, 0, 0],
  ];
}

const players: Player[] = [
  {
    id: 4431,
    nome: 'Carnesecchi',
    squadra: 'Atalanta',
    ruolo: 'P',
    ruoloMantra: ['Por'],
    qtA: 16,
    qtI: 16,
    diff: 0,
    qtAM: 16,
    fvm: 60,
    fvmM: 60,
  },
  {
    id: 2764,
    nome: 'Martinez L.',
    squadra: 'Inter',
    ruolo: 'A',
    ruoloMantra: ['Pc'],
    qtA: 35,
    qtI: 35,
    diff: 0,
    qtAM: 35,
    fvm: 370,
    fvmM: 370,
  },
];

describe('parseStatistiche', () => {
  it('riconosce le colonne reali del file fantacalcio.it (Pv, Gf, Gs, Rp, R+, R-…)', () => {
    const rows = parseStatistiche(buildWorkbook(statRows()));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 4431,
      nome: 'Carnesecchi',
      squadra: 'Atalanta',
      patch: {
        presenze: 37,
        mv: 6.36,
        fm: 5.58,
        golSubiti: 35,
        rigoriParati: 2,
      },
    });
    expect(rows[1].patch).toMatchObject({
      presenze: 30,
      gol: 17,
      assist: 6,
      golSubiti: 0,
    });
  });

  it('accetta fogli con nome qualsiasi e alias alternativi (Pres, Media Voto…)', () => {
    const buf = buildWorkbook(
      [
        ['Nome', 'Squadra', 'Pres', 'Media Voto', 'FantaMedia', 'Gol', 'Assist'],
        ['Rossi', 'Milan', '22', '6,15', '6,2', '2', '1'],
      ],
      'Tutti',
    );
    const rows = parseStatistiche(buf);
    expect(rows[0].patch).toMatchObject({
      presenze: 22,
      mv: 6.15,
      fm: 6.2,
      gol: 2,
      assist: 1,
    });
  });

  it('salta le righe senza nome', () => {
    const rows = [HEADER, ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], statRows()[2]];
    expect(parseStatistiche(buildWorkbook(rows))).toHaveLength(1);
  });

  it('solleva errore senza intestazioni riconoscibili', () => {
    const buf = buildWorkbook([['qualcosa'], ['uno', 'due']]);
    expect(() => parseStatistiche(buf)).toThrow(/non riconosciuto/);
  });
});

describe('applyStats', () => {
  it('fonde per Id e conta i giocatori arricchiti', () => {
    const parsed = parseStatistiche(buildWorkbook(statRows()));
    const res = applyStats(players, parsed);
    expect(res.matched).toBe(2);
    expect(res.players[0].presenze).toBe(37);
    expect(res.players[0].golSubiti).toBe(35);
    expect(res.players[1].gol).toBe(17);
  });

  it('usa il fallback nome+squadra quando l\u2019Id non corrisponde', () => {
    const parsed = parseStatistiche(buildWorkbook([
      HEADER,
      [-1, 'A', 'Pc', 'Martinez L.', 'Inter', 30, 6.42, 8.25, 17, 0, 0, 0, 0, 0, 6, 4, 0, 0],
    ]));
    const res = applyStats(players, parsed);
    expect(res.matched).toBe(1);
    expect(res.players[1]).toMatchObject({ presenze: 30, mv: 6.42 });
  });

  it('non modifica nulla se nessuna riga corrisponde', () => {
    const parsed = parseStatistiche(buildWorkbook([
      HEADER,
      [1, 'C', 'C', 'Sconosciuto', 'Test', 10, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]));
    const res = applyStats(players, parsed);
    expect(res.matched).toBe(0);
    expect(res.players).toEqual(players);
  });
});
