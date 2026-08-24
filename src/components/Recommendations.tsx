import { useMemo } from 'react';
import type { Mode, Player, Ruolo } from '../types';
import { quoteOf, weightedValueDelta } from '../types';
import { useDraft } from '../state/store';
import { budgetStatus, buildIndex, roleTargets } from '../lib/engine';

const ROLE_TEXT_CLASS: Record<Ruolo, string> = {
  P: 'text-amber-400',
  D: 'text-sky-400',
  C: 'text-emerald-400',
  A: 'text-violet-300',
};

export default function Recommendations({
  players,
  mode,
  onFocus,
}: {
  players: Player[];
  mode: Mode;
  onFocus: (p: Player) => void;
}) {
  const { store } = useDraft();
  const state = store.present;

  const byId = useMemo(() => buildIndex(players), [players]);
  const status = useMemo(
    () => budgetStatus(byId, state),
    [byId, state],
  );

  const targets = useMemo(() => {
    const map = new Map<Ruolo, ReturnType<typeof roleTargets>>();
    for (const r of ['P', 'D', 'C', 'A'] as Ruolo[]) {
      map.set(r, roleTargets(players, byId, state, r, mode, 3));
    }
    return map;
  }, [players, byId, state, mode, status]);

  const empty = [...targets.values()].every((t) => t.length === 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Consigli d'asta
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        "≤ X" = offerta massima sostenibile restando i crediti per riempire la rosa
      </p>

      {empty && (
        <p className="mt-3 text-sm text-zinc-500">
          Rosa completa: nessun consiglio necessario. 🏆
        </p>
      )}

      <div className="mt-3 space-y-4">
        {[...targets.entries()].map(([ruolo, list]) => (
          <div key={ruolo}>
            <div className="flex items-baseline justify-between">
              <h4 className={`font-semibold ${ROLE_TEXT_CLASS[ruolo]}`}>{ruolo}</h4>
              <span className="text-xs text-zinc-500">
                {status.byRole[ruolo]} in rosa
              </span>
            </div>
            <ul className="mt-1 space-y-1">
              {list.map(({ player, maxBid }) => {
                const qt = quoteOf(player, mode);
                const delta = weightedValueDelta(player, mode);
                const affordable = maxBid >= qt;
                return (
                  <li key={player.id}>
                    <button
                      onClick={() => onFocus(player)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-800"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {player.nome}
                        <span className="ml-1 text-xs text-zinc-500">
                          {player.squadra}
                        </span>
                      </span>
                      <span
                        className="shrink-0 text-xs tabular-nums text-zinc-500"
                        title="Δ pesato: FVM − quotazione, scontato se il giocatore non è titolare (richiede le statistiche importate)"
                      >
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-300">{qt}</span>
                      <span
                        className={`w-14 shrink-0 rounded-md px-1 py-0.5 text-center text-xs font-semibold tabular-nums ${
                          maxBid === 0
                            ? 'bg-red-950 text-red-400'
                            : affordable
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-amber-950 text-amber-400'
                        }`}
                        title={
                          affordable
                            ? 'Quotazione coperta dal budget previsto'
                            : 'Serve risparmiare su altri slot'
                        }
                      >
                        ≤ {maxBid}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
