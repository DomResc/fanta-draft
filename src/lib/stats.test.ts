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

/** Colonne realistiche della pagina statistiche di fantacalcio.it:
 *  include anche le quotazioni (colonne extra da ignorare). */
const HEADER = [
  'R',
  'Nome',
  'Squadra',
  'Qt.A',
  'Qt.I',
  'Mv',
  'Fm',
  'Pres',
  'Gol',
  'Ass',
  'Rig',
];

function statRows(): (string | number)[][] {
  return [
    ['Statistiche Fantacalcio Serie A 2025/26'],
    HEADER,
    ['P', 'Svilar', 'Roma', '18', '18', '7,12', '7,3', '35', '0', '0', '0'],
    ['D', 'Rossi', 'Milan', '10', '12', '6,15', '6,2', '22', '2', '1', '0'],
    ['C', 'Bianchi', 'Juventus', '7', '7', '6,01', '6,8', '28', '4', '5', '3'],
    ['A', 'Neri', 'Napoli', '22', '20', '6,45', '7,1', '30', '18', '4', '6'],
  ];
}

const players: Player[] = [
  {
    id: 5841,
    nome: 'Svilar',
    squadra: 'Roma',
    ruolo: 'P',
    ruoloMantra: ['Por'],
    qtA: 18,
    qtI: 18,
    diff: 0,
    qtAM: 18,
    fvm: 65,
    fvmM: 65,
  },
  {
    id: 1,
    nome: 'Rossi',
    squadra: 'Milan',
    ruolo: 'D',
    ruoloMantra: ['Dd'],
    qtA: 10,
    qtI: 12,
    diff: -2,
    qtAM: 9,
    fvm: 50,
    fvmM: 48,
  },
];

describe('parseStatistiche', () => {
  it('riconosce intestazioni per alias e ignora colonne extra', () => {
    const rows = parseStatistiche(buildWorkbook(statRows()));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      id: null,
      nome: 'Svilar',
      squadra: 'Roma',
      patch: { presenze: 35, mv: 7.12, fm: 7.3, gol: 0, assist: 0, rigori: 0 },
    });
    expect(rows[2].patch).toMatchObject({ gol: 4, assist: 5, rigori: 3 });
  });

  it('legge la colonna Id quando presente e accetta fogli con nome qualsiasi', () => {
    const buf = buildWorkbook([
      ['Id', ...HEADER],
      [5841, 'P', 'Svilar', 'Roma', '18', '18', '7,12', '7,3', '35', '0', '0', '0'],
    ]);
    const parsed = parseStatistiche(buf);
    expect(parsed[0].id).toBe(5841);
    expect(parsed[0].patch.presenze).toBe(35);
  });

  it('salta le righe senza nome', () => {
    const rows = [
      HEADER,
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['A', 'Neri', 'Napoli', '22', '20', '6,45', '7,1', '30', '18', '4', '6'],
    ];
    expect(parseStatistiche(buildWorkbook(rows))).toHaveLength(1);
  });

  it('solleva errore senza intestazioni riconoscibili', () => {
    const buf = buildWorkbook([['qualcosa'], ['uno', 'due']]);
    expect(() => parseStatistiche(buf)).toThrow(/non riconosciuto/);
  });
});

describe('applyStats', () => {
  it('fonde per Id e conta i giocatori arricchiti', () => {
    const parsed = parseStatistiche(buildWorkbook([
      ['Id', ...HEADER],
      [5841, 'P', 'Svilar', 'Roma', '18', '18', '7,12', '7,3', '35', '0', '0', '0'],
      [999, 'D', 'Inesistente', 'Test', '5', '5', '6', '6', '10', '0', '0', '0'],
    ]));
    const res = applyStats(players, parsed);
    expect(res.matched).toBe(1);
    expect(res.players[0].presenze).toBe(35);
    expect(res.players[0].mv).toBeCloseTo(7.12);
    expect(res.players[1].mv).toBeUndefined();
  });

  it('usa il fallback nome+squadra quando l\u2019Id non corrisponde', () => {
    const parsed = parseStatistiche(buildWorkbook([
      HEADER,
      ['D', 'Rossi', 'Milan', '10', '12', '6,15', '6,2', '22', '2', '1', '0'],
    ]));
    const res = applyStats(players, parsed);
    expect(res.matched).toBe(1);
    expect(res.players[1]).toMatchObject({ presenze: 22, mv: 6.15 });
  });

  it('non modifica nulla se nessuna riga corrisponde', () => {
    const parsed = parseStatistiche(buildWorkbook([
      HEADER,
      ['A', 'Neri', 'Napoli', '22', '20', '6,45', '7,1', '30', '18', '4', '6'],
    ]));
    const res = applyStats(players, parsed);
    expect(res.matched).toBe(0);
    expect(res.players).toEqual(players);
  });
});
