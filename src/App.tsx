import { useCallback, useEffect, useState } from 'react';
import type { Mode, Player } from './types';
import { parseQuotazioniFile } from './lib/parser';
import { loadData, saveData } from './lib/dataCache';
import type { StoredData } from './lib/dataCache';
import { DraftProvider, useDraft } from './state/store';
import Header from './components/Header';
import DataGate from './components/DataGate';
import SetupScreen from './components/SetupScreen';
import PlayerTable from './components/PlayerTable';
import BudgetCard from './components/BudgetCard';
import Recommendations from './components/Recommendations';
import UpgradePanel from './components/UpgradePanel';
import SquadCard from './components/SquadCard';

const MODE_KEY = 'fanta-draft:mode';

export default function App() {
  const [mode, setMode] = useState<Mode>(() =>
    localStorage.getItem(MODE_KEY) === 'mantra' ? 'mantra' : 'classic',
  );
  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const [data, setData] = useState<StoredData | null>(() => loadData());
  const [replacing, setReplacing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const players = await parseQuotazioniFile(file);
      const stored: StoredData = {
        fileName: file.name,
        savedAt: new Date().toISOString(),
        players,
      };
      const persisted = saveData(stored);
      setData(stored);
      setReplacing(false);
      if (!persisted) {
        alert(
          'Quotazioni caricate, ma lo spazio del browser è pieno: alla prossima apertura va ricaricato il file.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }, []);

  const requestReplace = useCallback(() => {
    if (
      window.confirm(
        'Caricare un nuovo file quotazioni? Lo stato delle aste salvate viene conservato.',
      )
    ) {
      setError(null);
      setReplacing(true);
    }
  }, []);

  const showGate = !data || replacing;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {data && !showGate && (
        <DraftProvider key={mode} mode={mode}>
          <Header
            mode={mode}
            onModeChange={setMode}
            onReplaceData={requestReplace}
            dataFileName={data.fileName}
          />
          <Main players={data.players} mode={mode} />
        </DraftProvider>
      )}
      {showGate && (
        <div className={data ? 'fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm overflow-auto' : ''}>
          <DataGate
            onFile={handleFile}
            parsing={parsing}
            error={error}
            onCancel={data ? () => setReplacing(false) : undefined}
          />
        </div>
      )}
    </div>
  );
}

function Main({ players, mode }: { players: StoredData['players']; mode: Mode }) {
  const { store } = useDraft();

  if (store.present.phase === 'setup') {
    return <SetupScreen players={players} mode={mode} />;
  }
  return <DraftScreen players={players} mode={mode} />;
}

function DraftScreen({
  players,
  mode,
}: {
  players: StoredData['players'];
  mode: Mode;
}) {
  const [focus, setFocus] = useState<Player | null>(null);
  const focusPlayer = useCallback((p: Player) => setFocus(p), []);
  const clearFocus = useCallback(() => setFocus(null), []);

  return (
    <main className="mx-auto grid max-w-[1600px] items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <PlayerTable players={players} mode={mode} focus={focus} />
      <aside className="space-y-4">
        <BudgetCard players={players} />
        <Recommendations players={players} mode={mode} onFocus={focusPlayer} />
        <UpgradePanel players={players} mode={mode} onFocus={focusPlayer} />
        <SquadCard players={players} mode={mode} />
      </aside>
      <FocusClearer onDone={clearFocus} dep={focus?.id ?? null} />
    </main>
  );
}

function FocusClearer({
  dep,
  onDone,
}: {
  dep: number | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (dep != null) {
      const t = setTimeout(onDone, 1500);
      return () => clearTimeout(t);
    }
  }, [dep, onDone]);
  return null;
}
