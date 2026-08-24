import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Blocco, Mode, Player, Ruolo } from '../types';
import { blocchiOf, quoteOf, ratingOf, valueDelta, weightedValueDelta } from '../types';
import { useDraft } from '../state/store';
import { buildIndex, maxBidFor } from '../lib/engine';

type SortKey = 'fvm' | 'qt' | 'delta' | 'deltaW' | 'mv' | 'fm' | 'nome';
type StatusFilter = 'available' | 'all';
type BloccoFilter = 'tutti' | Blocco;
type ColId = 'giocatore' | 'rm' | 'pres' | 'mv' | 'fm' | 'qt' | 'fvm';

const DEFAULT_COL_W: Record<ColId, number> = {
  giocatore: 260,
  rm: 72,
  pres: 52,
  mv: 56,
  fm: 56,
  qt: 64,
  fvm: 64,
};

const COLS_KEY = 'fanta-draft:cols';

function loadColWidths(): Record<ColId, number> {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (raw) return { ...DEFAULT_COL_W, ...JSON.parse(raw) };
  } catch {
    // ignora
  }
  return { ...DEFAULT_COL_W };
}

export default function PlayerTable({
  players,
  mode,
  focus,
}: {
  players: Player[];
  mode: Mode;
  focus: Player | null;
}) {
  const { store, dispatch } = useDraft();
  const state = store.present;

  const [query, setQuery] = useState('');
  const [ruolo, setRuolo] = useState<'Tutti' | Ruolo>('Tutti');
  const [blocco, setBlocco] = useState<BloccoFilter>('tutti');
  const [squadra, setSquadra] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fvm');
  const [status, setStatus] = useState<StatusFilter>('available');
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [colW, setColW] = useState<Record<ColId, number>>(loadColWidths);
  const [resizing, setResizing] = useState<{
    id: ColId;
    startX: number;
    startW: number;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(colW));
    } catch {
      // ignora
    }
  }, [colW]);

  useEffect(() => {
    if (!resizing) return;
    const move = (e: MouseEvent) => {
      const dx = e.clientX - resizing.startX;
      setColW((w) => ({
        ...w,
        [resizing.id]: Math.max(40, resizing.startW + dx),
      }));
    };
    const up = () => setResizing(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [resizing]);

  const startResize = (id: ColId) => (e: ReactMouseEvent) => {
    e.preventDefault();
    setResizing({ id, startX: e.clientX, startW: colW[id] });
  };

  const resizeHandle = (id: ColId) => (
    <span
      onMouseDown={startResize(id)}
      onDoubleClick={() => setColW((w) => ({ ...w, [id]: DEFAULT_COL_W[id] }))}
      title="Trascina per ridimensionare · doppio click per reimpostare"
      className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-emerald-500/60 ${
        resizing?.id === id ? 'bg-emerald-500' : ''
      }`}
    />
  );

  const byId = useMemo(() => buildIndex(players), [players]);

  const mine = useMemo(
    () => new Map(state.purchases.map((x) => [x.playerId, x.price])),
    [state.purchases],
  );
  const others = useMemo(() => new Set(state.takenOthers), [state.takenOthers]);

  const teams = useMemo(
    () => [...new Set(players.map((p) => p.squadra))].sort((a, b) => a.localeCompare(b)),
    [players],
  );

  const spent = useMemo(
    () => state.purchases.reduce((a, x) => a + x.price, 0),
    [state.purchases],
  );

  const statusOf = (id: number): 'mine' | 'other' | 'available' =>
    mine.has(id) ? 'mine' : others.has(id) ? 'other' : 'available';

  useEffect(() => {
    if (!focus) return;
    setQuery(focus.nome);
    setRuolo('Tutti');
    setSquadra('');
    setStatus('all');
  }, [focus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = players.filter((p) => {
      if (ruolo !== 'Tutti' && p.ruolo !== ruolo) return false;
      if (blocco !== 'tutti' && !blocchiOf(p).includes(blocco)) return false;
      if (squadra && p.squadra !== squadra) return false;
      const st = mine.has(p.id) ? 'mine' : others.has(p.id) ? 'other' : 'available';
      if (status === 'available' && st !== 'available') return false;
      if (
        q &&
        !p.nome.toLowerCase().includes(q) &&
        !p.squadra.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'qt':
          return quoteOf(b, mode) - quoteOf(a, mode);
        case 'delta':
          return valueDelta(b, mode) - valueDelta(a, mode);
        case 'deltaW':
          return weightedValueDelta(b, mode) - weightedValueDelta(a, mode);
        case 'mv':
          return (b.mv ?? -Infinity) - (a.mv ?? -Infinity);
        case 'fm':
          return (b.fm ?? -Infinity) - (a.fm ?? -Infinity);
        case 'nome':
          return a.nome.localeCompare(b.nome);
        default:
          return ratingOf(b, mode) - ratingOf(a, mode);
      }
    });
    return list;
  }, [players, query, ruolo, blocco, squadra, sortKey, status, mode, mine, others]);

  const openBuy = (p: Player) => {
    setBuyingId(p.id);
    setPriceInput(String(Math.max(1, quoteOf(p, mode))));
  };

  const confirmBuy = () => {
    if (buyingId == null) return;
    const p = byId.get(buyingId);
    if (!p) return;
    const price = Math.floor(Number(priceInput));
    const remaining = state.config.budget - spent;
    if (!Number.isFinite(price) || price < 1) {
      alert('Il prezzo minimo di asta è 1 credito');
      return;
    }
    if (price > remaining) {
      alert(`Prezzo non valido. Budget residuo: ${remaining}`);
      return;
    }
    dispatch({ type: 'BUY', playerId: buyingId, price });
    setBuyingId(null);
  };

  const maxHint = useMemo(() => {
    if (buyingId == null) return null;
    return maxBidFor(players, byId, state, buyingId, mode);
  }, [buyingId, players, byId, state, mode]);

  const roleBadgeClass: Record<Ruolo, string> = {
    P: 'bg-amber-950 text-amber-400',
    D: 'bg-sky-950 text-sky-400',
    C: 'bg-emerald-950 text-emerald-400',
    A: 'bg-violet-950 text-violet-300',
  };

  const statsTitle = (p: Player): string => {
    const parts: string[] = [];
    if (p.mv != null) parts.push(`MV ${p.mv}`);
    if (p.fm != null) parts.push(`FM ${p.fm}`);
    if (p.ruolo === 'P') {
      if (p.golSubiti != null) parts.push(`${p.golSubiti} gol subiti`);
      if (p.rigoriParati) parts.push(`${p.rigoriParati} rigori parati`);
    } else {
      if (p.gol != null) parts.push(`${p.gol} gol`);
      if (p.assist != null) parts.push(`${p.assist} assist`);
      if (p.rigoriSegnati || p.rigoriFalliti) {
        parts.push(`${(p.rigoriSegnati ?? 0) + (p.rigoriFalliti ?? 0)} rigori (${p.rigoriSegnati ?? 0}/${p.rigoriFalliti ?? 0} sbagliati)`);
      }
    }
    return parts.length > 0
      ? `Scorsa stagione: ${parts.join(' · ')}`
      : 'Importa il file statistiche dall\u2019header per presenze e media voto';
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca nome o squadra…"
          className="w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={squadra}
          onChange={(e) => setSquadra(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Tutte le squadre</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-zinc-700">
          {(['Tutti', 'P', 'D', 'C', 'A'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRuolo(r)}
              className={`px-2.5 py-1.5 text-sm transition-colors ${
                ruolo === r
                  ? 'bg-sky-700 font-semibold text-white'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-zinc-700" title="Blocchi d'asta: Difensivi fino a M ed E, Offensivi da C in poi">
          {([
            ['tutti', 'Blocchi: tutti'],
            ['por', 'Por'],
            ['dif', 'Dif'],
            ['off', 'Off'],
          ] as Array<[BloccoFilter, string]>).map(([b, label]) => (
            <button
              key={b}
              onClick={() => setBlocco(b)}
              className={`px-2.5 py-1.5 text-sm transition-colors ${
                blocco === b
                  ? 'bg-violet-700 font-semibold text-white'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="fvm">Ordina: FVM ↓</option>
          <option value="qt">Ordina: Quotazione ↓</option>
          <option value="delta">Ordina: Δ (affari) ↓</option>
          <option value="deltaW" title="Δ pesato per la titolarità attesa: richiede le statistiche importate">
            Ordina: Δ pesato ↓
          </option>
          <option value="mv" title="Richiede le statistiche importate">Ordina: MV scorsa stag. ↓</option>
          <option value="fm" title="Richiede le statistiche importate">Ordina: FM scorsa stag. ↓</option>
          <option value="nome">Ordina: Nome ↑</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={status === 'available'}
            onChange={(e) => setStatus(e.target.checked ? 'available' : 'all')}
            className="accent-emerald-600"
          />
          solo disponibili
        </label>
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} giocatori
        </span>
      </div>

      <div className="max-h-[calc(100vh-220px)] overflow-auto">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th
                className="relative px-3 py-2 font-medium"
                style={{ width: colW.giocatore }}
              >
                Giocatore
                {resizeHandle('giocatore')}
              </th>
              {mode === 'mantra' && (
                <th className="relative px-2 py-2 font-medium" style={{ width: colW.rm }}>
                  RM
                  {resizeHandle('rm')}
                </th>
              )}
              <th
                className="relative px-2 py-2 text-right font-medium"
                style={{ width: colW.pres }}
                title="Presenze scorsa stagione (richiede il file statistiche): proxy di titolarità"
              >
                Pres
                {resizeHandle('pres')}
              </th>
              <th
                className="relative px-2 py-2 text-right font-medium"
                style={{ width: colW.mv }}
                title="Media voto scorsa stagione (richiede il file statistiche)"
              >
                MV
                {resizeHandle('mv')}
              </th>
              <th
                className="relative px-2 py-2 text-right font-medium"
                style={{ width: colW.fm }}
                title="FantaMedia scorsa stagione (richiede il file statistiche)"
              >
                FM
                {resizeHandle('fm')}
              </th>
              <th
                className="relative px-2 py-2 text-right font-medium"
                style={{ width: colW.qt }}
                title="Quotazione attuale (prezzo d'asta)"
              >
                Qt.A
                {resizeHandle('qt')}
              </th>
              <th
                className="relative px-3 py-2 text-right font-medium"
                style={{ width: colW.fvm }}
                title="Fantavalue media (Classic) o Mantra: quanto il giocatore è atteso che renda"
              >
                FVM
                {resizeHandle('fvm')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const st = statusOf(p.id);
              const isFocus = focus?.id === p.id;
              return (
                <tr
                  key={p.id}
                  ref={
                    isFocus
                      ? (el) => el?.scrollIntoView({ block: 'center' })
                      : undefined
                  }
                  className={`border-t border-zinc-800/60 ${
                    st === 'mine'
                      ? 'bg-emerald-950/30'
                      : st === 'other'
                        ? 'opacity-45'
                        : isFocus
                          ? 'bg-yellow-900/20'
                          : ''
                  }`}
                >
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 shrink-0 rounded text-center text-[10px] font-bold ${roleBadgeClass[p.ruolo]}`}
                      >
                        {p.ruolo}
                      </span>
                      <span
                        className={`truncate ${st === 'other' ? 'line-through' : ''} ${
                          st === 'mine' ? 'font-semibold' : ''
                        }`}
                      >
                        {p.nome}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">{p.squadra}</span>
                      {st === 'mine' && (
                        <span className="shrink-0 rounded bg-emerald-900 px-1.5 text-xs text-emerald-300">
                          in rosa · {mine.get(p.id)}
                        </span>
                      )}
                    </div>
                  </td>
                  {mode === 'mantra' && (
                    <td className="px-2 py-1.5 text-xs text-zinc-400">
                      {p.ruoloMantra.join('/')}
                    </td>
                  )}
                  <td
                    title={statsTitle(p)}
                    className={`px-2 py-1.5 text-right text-xs tabular-nums ${
                      p.presenze == null
                        ? 'text-zinc-600'
                        : p.presenze < 15
                          ? 'font-semibold text-amber-500'
                          : 'text-zinc-300'
                    }`}
                  >
                    {p.presenze ?? '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-zinc-300">
                    {p.mv != null ? p.mv.toFixed(2) : '—'}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right text-xs tabular-nums ${
                      p.fm != null ? (p.fm >= 7 ? 'font-semibold text-emerald-400' : 'text-zinc-300') : 'text-zinc-600'
                    }`}
                  >
                    {p.fm != null ? p.fm.toFixed(2) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                    {quoteOf(p, mode)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-300">
                    {ratingOf(p, mode)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    {st === 'available' && buyingId !== p.id && (
                      <>
                        <button
                          onClick={() => openBuy(p)}
                          className="mr-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold transition-colors hover:bg-emerald-500"
                        >
                          Acquista
                        </button>
                        <button
                          onClick={() =>
                            dispatch({ type: 'TAKE_OTHER', playerId: p.id })
                          }
                          title="Segna come acquistato da un'altra squadra"
                          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
                        >
                          Altro
                        </button>
                      </>
                    )}
                    {st === 'available' && buyingId === p.id && (
                      <span className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          type="number"
                          min={1}
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmBuy();
                            if (e.key === 'Escape') setBuyingId(null);
                          }}
                          placeholder={`${Math.max(1, quoteOf(p, mode))}`}
                          className="w-16 rounded-md border border-zinc-600 bg-zinc-950 px-1.5 py-1 text-right text-xs tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          onClick={confirmBuy}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold hover:bg-emerald-500"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setBuyingId(null)}
                          className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {st === 'mine' && (
                      <button
                        onClick={() =>
                          dispatch({ type: 'RELEASE_MINE', playerId: p.id })
                        }
                        className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
                      >
                        Rimuovi
                      </button>
                    )}
                    {st === 'other' && (
                      <button
                        onClick={() =>
                          dispatch({ type: 'RELEASE_OTHER', playerId: p.id })
                        }
                        className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
                      >
                        Rilascia
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={mode === 'mantra' ? 8 : 7} className="p-6 text-center text-zinc-500">
                  Nessun giocatore trovato con questi filtri.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {buyingId != null && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs">
          <span className="text-zinc-400">
            {byId.get(buyingId)?.nome} — offerta massima consigliata:{' '}
            <strong className="text-emerald-400">{maxHint ?? '?'}</strong> crediti ·
            budget residuo {state.config.budget - spent}
          </span>
          <span className="text-zinc-600">(Invio = conferma, Esc = annulla)</span>
        </div>
      )}
    </div>
  );
}
