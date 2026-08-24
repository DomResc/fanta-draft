import { useMemo } from 'react';
import type { Mode, Player } from '../types';
import { quoteOf } from '../types';
import { useDraft } from '../state/store';
import { buildIndex, findUpgrades } from '../lib/engine';
import { RoleBadge } from './RoleBadge';

export default function UpgradePanel({
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
  const result = useMemo(
    () => findUpgrades(players, byId, state, mode),
    [players, byId, state, mode],
  );

  if (state.purchases.length < 11) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Rafforza i titolari
        </h3>
        <p className="mt-2 text-sm text-zinc-500">
          Attiva con l'undicesimo acquisto: ti mostrerà quali giocatori sul mercato
          alzano di più la qualità del tuo undici ideale.
        </p>
      </div>
    );
  }

  if (result.upgrades.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Rafforza i titolari
        </h3>
        <p className="mt-2 text-sm text-emerald-400">
          Nessun miglioramento disponibile: il tuo undici è già più forte di tutto
          ciò che resta sul mercato. 🏆
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Rafforza i titolari
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Quanto salirebbe la Σ FVM dell'undici comprando ciascun giocatore (attuale{' '}
        {result.currentScore})
      </p>

      <ul className="mt-2 space-y-1">
        {result.upgrades.map((u) => {
          const qt = quoteOf(u.player, mode);
          return (
            <li key={u.player.id}>
              <button
                onClick={() => onFocus(u.player)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-800"
              >
                <RoleBadge ruolo={u.player.ruolo} />
                <span className="min-w-0 flex-1 truncate">
                  {u.player.nome}
                  <span className="ml-1 text-xs text-zinc-500">{u.player.squadra}</span>
                </span>
                <span className="shrink-0 tabular-nums text-zinc-300" title="Quotazione attuale">
                  {qt}
                </span>
                <span
                  className={`w-14 shrink-0 rounded-md px-1 py-0.5 text-center text-xs font-semibold tabular-nums ${
                    u.maxBid >= qt ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                  }`}
                  title="Offerta massima sostenibile"
                >
                  ≤ {u.maxBid}
                </span>
                <span
                  className="w-12 shrink-0 text-right font-bold tabular-nums text-sky-400"
                  title={`Σ FVM passerebbe a ${result.currentScore + u.gain} (modulo ${u.newModuleName})`}
                >
                  +{u.gain}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
