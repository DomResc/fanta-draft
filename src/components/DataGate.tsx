import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

export default function DataGate({
  onFile,
  parsing,
  error,
  onCancel,
}: {
  onFile: (file: File) => void;
  parsing: boolean;
  error: string | null;
  onCancel?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (parsing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          ⚽ Fanta Draft <span className="text-emerald-400">Assistant</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Carica il file quotazioni Fantacalcio (.xlsx) per iniziare
        </p>

        {parsing ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-zinc-400">
            Lettura del file in corso…
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`mt-8 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-12 transition-colors ${
              dragOver
                ? 'border-emerald-500 bg-emerald-950/30'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
            }`}
          >
            <span className="text-4xl">📄</span>
            <span className="font-semibold">Trascina qui il file</span>
            <span className="text-xs text-zinc-500">
              oppure clicca per selezionarlo · es. Quotazioni_Fantacalcio_2026_27.xlsx
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />

        {error && (
          <div className="mt-4 rounded-xl border border-red-900 bg-red-950/50 p-4 text-left text-sm">
            <p className="font-semibold text-red-400">{error}</p>
          </div>
        )}

        {onCancel && !parsing && (
          <button
            onClick={onCancel}
            className="mt-6 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            ← Annulla, torna al draft
          </button>
        )}

        <p className="mt-8 text-xs text-zinc-600">
          Il file resta sul tuo computer: i dati vengono elaborati solo nel browser.
        </p>
      </div>
    </div>
  );
}
