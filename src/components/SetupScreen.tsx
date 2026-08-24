import { useState } from 'react';
import type { Mode, Player, Ruolo } from '../types';
import { RUOLI, RUOLO_LABEL } from '../types';
import { useDraft } from '../state/store';

export default function SetupScreen({
  players,
  mode,
}: {
  players: Player[];
  mode: Mode;
}) {
  const { store, dispatch } = useDraft();
  const isMantra = mode === 'mantra';

  const [budget, setBudget] = useState(store.present.config.budget);
  const [rosterMin, setRosterMin] = useState(store.present.config.rosterMin);
  const [rosterMax, setRosterMax] = useState(store.present.config.rosterMax);
  const [roleMin, setRoleMin] = useState<Record<Ruolo, number>>(
    store.present.config.roleMin ?? { P: 3, D: 8, C: 8, A: 6 },
  );

  const sumRoles = RUOLI.reduce((a, r) => a + roleMin[r], 0);
  const valid = isMantra
    ? budget >= 11 && rosterMin >= 11 && rosterMax >= rosterMin
    : budget >= 11 && RUOLI.every((r) => roleMin[r] >= 1) && sumRoles >= 11;

  const start = () => {
    if (!valid) return;
    dispatch({
      type: 'START',
      config: isMantra
        ? { budget, rosterMin, rosterMax }
        : { budget, rosterMin: sumRoles, rosterMax: sumRoles, roleMin: { ...roleMin } },
    });
  };

  return (
    <div className="mx-auto mt-10 max-w-xl px-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h2 className="text-xl font-bold">Configura il tuo draft</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {players.length} giocatori caricati ·{' '}
          <span className="font-semibold text-emerald-400">
            {isMantra ? 'Mantra' : 'Classic'}
          </span>
          {isMantra && (
            <> · blocchi asta: Portieri / Difensivi (fino a M ed E) / Offensivi (da C in poi)</>
          )}
        </p>

        <div className="mt-6">
          <label className="text-sm font-medium text-zinc-300">
            Budget totale (crediti)
          </label>
          <input
            type="number"
            min={11}
            value={budget}
            onChange={(e) => setBudget(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-lg font-semibold focus:border-emerald-500 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            {[500, 1000].map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  budget === b
                    ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                    : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {b} crediti
              </button>
            ))}
          </div>
        </div>

        {isMantra ? (
          <div className="mt-5">
            <label className="text-sm font-medium text-zinc-300">
              Numero giocatori in rosa (min / max)
            </label>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex flex-1 items-stretch overflow-hidden rounded-lg border border-zinc-700">
                <button
                  onClick={() => setRosterMin(Math.max(11, rosterMin - 1))}
                  className="px-3 text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  −
                </button>
                <input
                  type="number"
                  min={11}
                  value={rosterMin}
                  onChange={(e) =>
                    setRosterMin(Math.max(11, Math.floor(Number(e.target.value) || 11)))
                  }
                  className="w-full bg-zinc-950 px-2 py-2 text-center font-semibold focus:outline-none"
                />
                <button
                  onClick={() => setRosterMin(Math.min(rosterMax, rosterMin + 1))}
                  className="px-3 text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  +
                </button>
              </div>
              <span className="text-zinc-500">/</span>
              <div className="flex flex-1 items-stretch overflow-hidden rounded-lg border border-zinc-700">
                <button
                  onClick={() => setRosterMax(Math.max(rosterMin, rosterMax - 1))}
                  className="px-3 text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  −
                </button>
                <input
                  type="number"
                  min={rosterMin}
                  value={rosterMax}
                  onChange={(e) =>
                    setRosterMax(
                      Math.max(rosterMin, Math.floor(Number(e.target.value) || rosterMin)),
                    )
                  }
                  className="w-full bg-zinc-950 px-2 py-2 text-center font-semibold focus:outline-none"
                />
                <button
                  onClick={() => setRosterMax(rosterMax + 1)}
                  className="px-3 text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-sm ${valid ? 'text-zinc-400' : 'text-red-400'}`}>
                Rosa da {rosterMin} a {rosterMax} giocatori
                {!valid && ' — il minimo deve essere ≥ 11 e ≤ massimo'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RUOLI.map((r) => (
                <div key={r}>
                  <label className="text-sm font-medium text-zinc-300">
                    {RUOLO_LABEL[r]}
                  </label>
                  <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-zinc-700">
                    <button
                      onClick={() =>
                        setRoleMin((s) => ({ ...s, [r]: Math.max(1, s[r] - 1) }))
                      }
                      className="px-3 text-zinc-400 transition-colors hover:bg-zinc-800"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={roleMin[r]}
                      onChange={(e) =>
                        setRoleMin((s) => ({
                          ...s,
                          [r]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full bg-zinc-950 px-2 py-2 text-center font-semibold focus:outline-none"
                    />
                    <button
                      onClick={() => setRoleMin((s) => ({ ...s, [r]: s[r] + 1 }))}
                      className="px-3 text-zinc-400 transition-colors hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <span className={`text-sm ${valid ? 'text-zinc-400' : 'text-red-400'}`}>
                Rosa fissa da {sumRoles} giocatori
                {!valid && ' — ogni reparto ≥ 1 e totale ≥ 11'}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={start}
          disabled={!valid}
          className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          Inizia il draft
        </button>
      </div>
    </div>
  );
}
