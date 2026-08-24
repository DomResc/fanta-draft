import { useMemo, useState } from 'react';
import type { Mode, Player, Ruolo } from '../types';
import { RUOLI, RUOLO_LABEL, quoteOf, ratingOf } from '../types';
import { useDraft } from '../state/store';
import {
  bestLineup,
  buildIndex,
  countByRole,
  lineupSlots,
  modulesFor,
  ownedPlayers,
  slotSuggestions,
} from '../lib/engine';
import type { SlotSuggestion } from '../lib/engine';

export default function SquadCard({
  players,
  mode,
  onFocus,
}: {
  players: Player[];
  mode: Mode;
  onFocus: (p: Player) => void;
}) {
  const { store, dispatch } = useDraft();
  const state = store.present;
  const [forcedModule, setForcedModule] = useState<string>('auto');

  const byId = useMemo(() => buildIndex(players), [players]);
  const roster = useMemo(() => ownedPlayers(byId, state), [byId, state]);

  const lineup = useMemo(
    () => bestLineup(roster, mode, forcedModule === 'auto' ? null : forcedModule),
    [roster, mode, forcedModule],
  );

  /** Vista a slot del modulo forzato: ammette slot vuoti. */
  const slots = useMemo(
    () => (forcedModule === 'auto' ? null : lineupSlots(roster, mode, forcedModule)),
    [roster, mode, forcedModule],
  );
  const bench = useMemo(() => {
    if (!slots) return lineup.bench;
    const used = new Set(slots.filter((s) => s.player).map((s) => s.player!.id));
    return roster.filter((p) => !used.has(p.id));
  }, [slots, lineup, roster]);
  const slotsScore = useMemo(
    () => slots?.reduce((a, s) => a + (s.player ? ratingOf(s.player, mode) : 0), 0) ?? 0,
    [slots, mode],
  );

  const suggestions = useMemo(() => {
    const map = new Map<number, SlotSuggestion[]>();
    if (slots) {
      slots.forEach((s, i) => {
        if (!s.player) {
          map.set(i, slotSuggestions(players, byId, state, mode, forcedModule, i));
        }
      });
    }
    return map;
  }, [slots, players, byId, state, mode, forcedModule]);

  const counts = useMemo(() => countByRole(roster), [roster]);

  const spendSplit = useMemo(() => {
    const starterIds = new Set(lineup.starters.map((p) => p.id));
    let starters = 0;
    let benchCost = 0;
    for (const x of state.purchases) {
      if (starterIds.has(x.playerId)) starters += x.price;
      else benchCost += x.price;
    }
    return { starters, bench: benchCost };
  }, [state.purchases, lineup]);

  const grouped = useMemo(() => {
    const map = new Map<Ruolo, Map<number, { player: Player; price: number }>>();
    for (const r of RUOLI) map.set(r, new Map());
    for (const x of state.purchases) {
      const p = byId.get(x.playerId);
      if (p) map.get(p.ruolo)!.set(p.id, { player: p, price: x.price });
    }
    return map;
  }, [state.purchases, byId]);

  const rosterList = (
    <div className="mt-4 space-y-3">
      {RUOLI.map((r) => {
        const list = [...grouped.get(r)!.values()];
        if (list.length === 0) return null;
        return (
          <div key={r}>
            <h4 className="flex items-baseline justify-between text-xs font-semibold text-zinc-400">
              <span>{RUOLO_LABEL[r]}</span>
              <span className="tabular-nums text-zinc-600">
                {counts[r]}
                {state.config.roleMin ? `/${state.config.roleMin[r]}` : ''}
              </span>
            </h4>
            <ul className="mt-1 divide-y divide-zinc-800/60">
              {list.map(({ player, price }) => (
                <li
                  key={player.id}
                  className="flex items-center gap-2 py-1.5 text-sm"
                >
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Rimuovere ${player.nome} dalla rosa e riaccredere ${price} crediti?`,
                        )
                      ) {
                        dispatch({ type: 'RELEASE_MINE', playerId: player.id });
                      }
                    }}
                    title="Rimuovi dalla rosa"
                    className="text-zinc-600 transition-colors hover:text-red-400"
                  >
                    ✕
                  </button>
                  <span className="min-w-0 flex-1 truncate">
                    {player.nome}
                    <span className="ml-1 text-xs text-zinc-500">
                      {player.squadra}
                    </span>
                  </span>
                  {mode === 'mantra' && (
                    <span className="shrink-0 text-[10px] text-zinc-500">
                      {player.ruoloMantra.join('/')}
                    </span>
                  )}
                  <span className="shrink-0 rounded-md bg-emerald-950 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-400">
                    {price}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          La mia rosa
        </h3>
        <select
          value={forcedModule}
          onChange={(e) => setForcedModule(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
        >
          <option value="auto">Modulo auto</option>
          {modulesFor(mode).map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {forcedModule === 'auto' ? (
        roster.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Nessun acquisto ancora. Usa la tabella per registrare i tuoi giocatori.
          </p>
        ) : (
          <>
            <div className="mt-3 rounded-xl border border-sky-900/60 bg-sky-950/30 p-3">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold text-sky-300">
                  Undici ideale{' '}
                  <span className="font-normal text-zinc-400">({lineup.moduleName})</span>
                </h4>
                <span
                  className="text-xs tabular-nums text-zinc-500"
                  title="Somma delle FVM degli 11 titolari: il modulo viene scelto massimizzando questo totale"
                >
                  Σ FVM {lineup.score}
                </span>
              </div>
              {!lineup.complete && (
                <p className="mt-1 text-xs text-amber-500">
                  Rosa insufficiente per un modulo completo: migliori 11 disponibili.
                </p>
              )}
              <div className="mt-2 space-y-0.5">
                {(['P', 'D', 'C', 'A'] as Ruolo[]).map((r) =>
                  lineup.starters
                    .filter((p) => p.ruolo === r)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm"
                      >
                        <span className="w-4 text-[10px] font-bold text-sky-600">{r}</span>
                        <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                        {mode === 'mantra' && (
                          <span className="shrink-0 text-[10px] text-zinc-500">
                            {p.ruoloMantra.join('/')}
                          </span>
                        )}
                      </div>
                    )),
                )}
              </div>
              {lineup.bench.length > 0 && (
                <>
                  <div className="my-2 border-t border-zinc-800" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    Panchina
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {lineup.bench.map((p) => (
                      <span key={p.id} className="text-xs text-zinc-500">
                        {p.nome}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-2 flex justify-between border-t border-zinc-800/70 pt-1.5 text-[11px] tabular-nums text-zinc-500">
                <span title="Crediti investiti sui titolari dell'undici ideale">
                  Titolari: {spendSplit.starters} cr
                </span>
                <span title="Crediti investiti sulla panchina">
                  Panchina: {spendSplit.bench} cr
                </span>
              </div>
            </div>
            {rosterList}
          </>
        )
      ) : slots ? (
        <>
          <div className="mt-3 rounded-xl border border-sky-900/60 bg-sky-950/30 p-3">
            <div className="flex items-baseline justify-between">
              <h4 className="text-sm font-semibold text-sky-300">
                Modulo{' '}
                <span className="font-normal text-zinc-400">({forcedModule})</span>
              </h4>
              <span
                className="text-xs tabular-nums text-zinc-500"
                title="Slot coperti e Σ FVM dei titolari assegnati agli slot"
              >
                {slots.filter((s) => s.player).length}/{slots.length} slot · Σ FVM{' '}
                {slotsScore}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {slots.map((s, i) => (
                <div key={i} className="rounded px-1 py-0.5">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span
                      className="w-12 shrink-0 text-[10px] font-bold uppercase text-sky-600"
                      title={`Ruoli richiesti dallo slot: ${s.label}`}
                    >
                      {s.label}
                    </span>
                    {s.player ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">{s.player.nome}</span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {s.player.squadra}
                        </span>
                      </>
                    ) : (
                      <span className="flex-1 text-xs font-medium text-amber-500">
                        — slot scoperto
                      </span>
                    )}
                  </div>
                  {(suggestions.get(i) ?? []).map(({ player, maxBid }) => (
                    <button
                      key={player.id}
                      onClick={() => onFocus(player)}
                      title="Cerca il giocatore nella tabella"
                      className="flex w-full items-center gap-2 rounded py-0.5 pl-12 pr-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-emerald-300"
                    >
                      <span className="min-w-0 flex-1 truncate text-left">
                        ↳ {player.nome}{' '}
                        <span className="text-zinc-600">{player.squadra}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-500">
                        {quoteOf(player, mode)}
                      </span>
                      <span className="shrink-0 rounded bg-zinc-800 px-1 font-semibold tabular-nums text-emerald-400">
                        ≤ {maxBid}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            {bench.length > 0 && (
              <>
                <div className="my-2 border-t border-zinc-800" />
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Panchina
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {bench.map((p) => (
                    <span key={p.id} className="text-xs text-zinc-500">
                      {p.nome}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          {roster.length > 0 && rosterList}
        </>
      ) : null}
    </div>
  );
}
