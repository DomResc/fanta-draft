import { useRef } from 'react';
import type { Mode } from '../types';
import { useDraft } from '../state/store';
import type { DraftState } from '../types';

const MODE_LABEL: Record<Mode, string> = { classic: 'Classic', mantra: 'Mantra' };

export default function Header({
  mode,
  onModeChange,
  onReplaceData,
  dataFileName,
  onStatsFile,
  statsFileName,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onReplaceData?: () => void;
  dataFileName?: string;
  onStatsFile?: (file: File) => void;
  statsFileName?: string;
}) {
  const { store, dispatch } = useDraft();
  const fileRef = useRef<HTMLInputElement>(null);
  const statsRef = useRef<HTMLInputElement>(null);
  const drafting = store.present.phase === 'draft';

  const exportState = () => {
    const blob = new Blob([JSON.stringify(store.present, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fanta-draft-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importState = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(String(reader.result)) as DraftState;
        if (
          !s ||
          typeof s.config?.budget !== 'number' ||
          !Array.isArray(s.purchases) ||
          !Array.isArray(s.takenOthers)
        ) {
          throw new Error('formato non valido');
        }
        dispatch({ type: 'IMPORT', state: s });
      } catch {
        alert('File di stato non valido');
      }
    };
    reader.readAsText(file);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <h1 className="text-lg font-bold tracking-tight">Fanta Draft</h1>
          <span className="hidden text-xs text-zinc-500 sm:inline">2026/27</span>
        </div>

        <div className="flex overflow-hidden rounded-lg border border-zinc-700">
          {(['classic', 'mantra'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                mode === m
                  ? 'bg-emerald-600 font-semibold text-white'
                  : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {onStatsFile && (
            <>
              <button
                onClick={() => statsRef.current?.click()}
                title={
                  statsFileName
                    ? `Statistiche in uso: ${statsFileName}`
                    : 'Importa le statistiche della scorsa stagione (presenze, MV, gol…)'
                }
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-zinc-800 ${
                  statsFileName
                    ? 'border-sky-800 text-sky-300'
                    : 'border-zinc-700 text-zinc-300'
                }`}
              >
                📊 Statistiche
              </button>
              <input
                ref={statsRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onStatsFile(f);
                  e.target.value = '';
                }}
              />
            </>
          )}
          {onReplaceData && (
            <button
              onClick={onReplaceData}
              title={dataFileName ? `In uso: ${dataFileName}` : undefined}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              📄 Quotazioni
            </button>
          )}
          {drafting && (
            <button
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={store.past.length === 0}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↩ Annulla
            </button>
          )}
          <button
            onClick={exportState}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Esporta
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Importa
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importState(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Azzerare completamente lo stato di questa modalità (configurazione e asta)?',
                )
              ) {
                dispatch({ type: 'RESET' });
              }
            }}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-950"
          >
            Azzera
          </button>
        </div>
      </div>
    </header>
  );
}
