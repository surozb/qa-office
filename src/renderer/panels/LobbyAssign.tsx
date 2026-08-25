import { useState } from 'react';
import { useOffice } from '../store';
import type { Occupant } from '../../shared/types';

export function LobbyAssign({ o }: { o: Occupant }) {
  const stations = useOffice((u) => u.state?.stations ?? []); const lobbyId = useOffice((u) => u.state?.lobbyId);
  const choices = stations.filter((s) => s.id !== lobbyId && s.id !== 'your-desk');
  const [pick, setPick] = useState(choices[0]?.id ?? '');
  const effective = pick || choices[0]?.id || '';
  return (
    <div>
      <p className="note">This folder matches no station. Choose where sessions from <code>{o.cwd}</code> should sit.</p>
      <select value={effective} onChange={(e) => setPick(e.target.value)} aria-label="Station">
        {choices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button className="btn" style={{ marginTop: 8 }} disabled={!effective} onClick={() => window.office.assignFolder(o.cwd, effective)}>Assign this folder</button>
    </div>
  );
}
