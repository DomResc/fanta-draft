import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseQuotazioni } from './parser';

function buildWorkbook(rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tutti');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

const HEADER = [
  'Id',
  'R',
  'RM',
  'Nome',
  'Squadra',
  'Qt.A',
  'Qt.I',
  'Diff.',
  'Qt.A M',
  'Qt.I M',
  'Diff.M',
  'FVM',
  'FVM M',
];

function validRows(): (string | number)[][] {
  return [
    ['Quotazioni Fantacalcio Stagione 2026 27'],
    HEADER,
    ['5841', 'P', 'Por', 'Svilar', 'Roma', '18', '18', '0', '18', '18', '0', '65', '65'],
    ['1', 'D', 'Dd;E', 'Rossi', 'Milan', '10', '12', '-2', '9', '11', '-2', '50', '48'],
    ['2', 'C', 'M;C', 'Bianchi', 'Juventus', '7', '7', '0', '8', '8', '0', '30', '31'],
    ['3', 'A', 'Pc', 'Neri', 'Napoli', '22', '20', '2', '23', '21', '2', '70', '72'],
  ];
}

describe('parseQuotazioni', () => {
  it('parsa correttamente righe e colonne attese', () => {
    const players = parseQuotazioni(buildWorkbook(validRows()));
    expect(players).toHaveLength(4);

    expect(players[0]).toMatchObject({
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
    });

    expect(players[1].ruoloMantra).toEqual(['Dd', 'E']);
    expect(players[1].diff).toBe(-2);
    expect(players[3].ruolo).toBe('A');
  });

  it('scarta le righe senza ruolo valido o senza nome', () => {
    const rows = [
      ['Titolo'],
      HEADER,
      ['10', 'X', 'Por', 'Sconosciuto', 'Test', '5', '5', '0', '5', '5', '0', '1', '1'],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['11', 'D', 'Dc', 'Valido', 'Test', '9', '9', '0', '9', '9', '0', '40', '40'],
    ];
    const players = parseQuotazioni(buildWorkbook(rows));
    expect(players).toHaveLength(1);
    expect(players[0].nome).toBe('Valido');
  });

  it('gestisce i ruoli mantra in minuscolo e con spazi', () => {
    const rows = [['T'], HEADER, ['20', ' d ', 'W; T ', 'Minuscolo', 'Test', '5', '5', '0', '5', '5', '0', '10', '10']];
    const players = parseQuotazioni(buildWorkbook(rows));
    expect(players[0].ruolo).toBe('D');
    expect(players[0].ruoloMantra).toEqual(['W', 'T']);
  });

  it('solleva errore se manca il foglio "Tutti"', () => {
    const ws = XLSX.utils.aoa_to_sheet([['qualcosa']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Altro');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    expect(() => parseQuotazioni(buf)).toThrow(/Tutti/);
  });

  it('solleva errore se non ci sono giocatori validi', () => {
    const rows = [['T'], HEADER];
    expect(() => parseQuotazioni(buildWorkbook(rows))).toThrow(
      /Nessun giocatore/,
    );
  });
});
