import type { Player } from '../types';
import { RUOLI } from '../types';
import { useDraft } from '../state/store';
import { budgetStatus, buildIndex } from '../lib/engine';

export default function BudgetCard({ players }: { players: Player[] }) {
  const { store } = useDraft();
  const byId = buildIndex(players);
  const s = budgetStatus(byId, store.present);
  const pct = store.present.config.budget
    ? Math.min(100, Math.round((s.spent / store.present.config.budget) * 100))
    : 0;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Budget
        </h3>
        <span className="text-2xl font-bold text-emerald-400">{s.remaining}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full transition-all ${pct > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>spesi {s.spent}</span>
        <span>su {store.present.config.budget}</span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-zinc-950 p-2">
          <dt className="text-zinc-500">Rosa</dt>
          <dd className="mt-0.5 text-lg font-bold">
            {s.filled}
            <span className="text-sm font-normal text-zinc-500">
              /{s.rosterMin}-{s.rosterMax}
            </span>
          </dd>
        </div>
        <div className="rounded-lg bg-zinc-950 p-2">
          <dt className="text-zinc-500">Media/slot</dt>
          <dd className="mt-0.5 text-lg font-bold">{s.avgPerSlot ?? '—'}</dd>
        </div>
        <div className="rounded-lg bg-zinc-950 p-2">
          <dt className="text-zinc-500" title="Acquisti ancora obbligatori per raggiungere la rosa minima">
            Obbligatori
          </dt>
          <dd className="mt-0.5 text-lg font-bold">{s.minStillNeeded}</dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-between gap-1 text-xs">
        {RUOLI.map((r) => (
          <span key={r} className="rounded-lg bg-zinc-950 px-2 py-1">
            <span className="font-semibold text-zinc-300">{r}</span>{' '}
            <span className="tabular-nums text-zinc-500">{s.byRole[r]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
