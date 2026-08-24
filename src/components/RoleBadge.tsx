import type { Ruolo } from '../types';

const ROLE_BADGE_CLASS: Record<Ruolo, string> = {
  P: 'bg-amber-950 text-amber-400',
  D: 'bg-sky-950 text-sky-400',
  C: 'bg-emerald-950 text-emerald-400',
  A: 'bg-violet-950 text-violet-300',
};

export function RoleBadge({ ruolo }: { ruolo: Ruolo }) {
  return (
    <span
      className={`w-4 shrink-0 rounded text-center text-[10px] font-bold ${ROLE_BADGE_CLASS[ruolo]}`}
    >
      {ruolo}
    </span>
  );
}
