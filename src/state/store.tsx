import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { DraftState, LeagueConfig, Mode } from '../types';
import { DEFAULT_CONFIG } from '../types';

export interface Store {
  present: DraftState;
  past: DraftState[];
}

export type Action =
  | { type: 'SET_CONFIG'; config: LeagueConfig }
  | { type: 'START'; config?: LeagueConfig }
  | { type: 'BUY'; playerId: number; price: number }
  | { type: 'TAKE_OTHER'; playerId: number }
  | { type: 'RELEASE_MINE'; playerId: number }
  | { type: 'RELEASE_OTHER'; playerId: number }
  | { type: 'UNDO' }
  | { type: 'RESET' }
  | { type: 'IMPORT'; state: DraftState };

function freshState(): DraftState {
  return {
    phase: 'setup',
    config: DEFAULT_CONFIG,
    purchases: [],
    takenOthers: [],
  };
}

function reducer(store: Store, action: Action): Store {
  const push = (present: DraftState): Store => ({
    present,
    past: [store.present, ...store.past].slice(0, 50),
  });

  switch (action.type) {
    case 'SET_CONFIG':
      return { ...store, present: { ...store.present, config: action.config } };
    case 'START': {
      const config = action.config ?? store.present.config;
      return push({ phase: 'draft', config, purchases: [], takenOthers: [] });
    }
    case 'BUY':
      return push({
        ...store.present,
        purchases: [...store.present.purchases, { playerId: action.playerId, price: action.price }],
      });
    case 'TAKE_OTHER':
      return push({
        ...store.present,
        takenOthers: [...store.present.takenOthers, action.playerId],
      });
    case 'RELEASE_MINE':
      return push({
        ...store.present,
        purchases: store.present.purchases.filter((x) => x.playerId !== action.playerId),
      });
    case 'RELEASE_OTHER':
      return push({
        ...store.present,
        takenOthers: store.present.takenOthers.filter((id) => id !== action.playerId),
      });
    case 'UNDO': {
      const [prev, ...rest] = store.past;
      return prev ? { present: prev, past: rest } : store;
    }
    case 'RESET':
      return { present: freshState(), past: [] };
    case 'IMPORT':
      return { present: action.state, past: [] };
    default:
      return store;
  }
}

const keyFor = (mode: Mode) => `fanta-draft:v1:${mode}`;

function loadStored(mode: Mode): Store {
  try {
    const raw = localStorage.getItem(keyFor(mode));
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (
        parsed?.present &&
        (parsed.present.phase === 'setup' || parsed.present.phase === 'draft') &&
        parsed.present.config
      ) {
        const c = parsed.present.config as Partial<LeagueConfig> & {
          roster?: { P: number; D: number; C: number; A: number };
        };
        const present: DraftState = {
          ...parsed.present,
          config: {
            budget: typeof c.budget === 'number' ? c.budget : 1000,
            rosterMin:
              typeof c.rosterMin === 'number'
                ? c.rosterMin
                : c.roster
                  ? Math.max(11, c.roster.P + c.roster.D + c.roster.C + c.roster.A)
                  : 28,
            rosterMax: typeof c.rosterMax === 'number' ? c.rosterMax : 30,
          },
        };
        return { present, past: parsed.past ?? [] };
      }
    }
  } catch {
    // stato corrotto: si riparte da zero
  }
  return { present: freshState(), past: [] };
}

interface Ctx {
  store: Store;
  dispatch: Dispatch<Action>;
}

const StoreCtx = createContext<Ctx | null>(null);

export function DraftProvider({ mode, children }: { mode: Mode; children: ReactNode }) {
  const [store, dispatch] = useReducer(reducer, undefined, () => loadStored(mode));

  useEffect(() => {
    try {
      localStorage.setItem(keyFor(mode), JSON.stringify(store));
    } catch {
      // storage pieno/non disponibile
    }
  }, [mode, store]);

  const value = useMemo(() => ({ store, dispatch }), [store]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useDraft(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useDraft deve essere usato dentro DraftProvider');
  return ctx;
}
