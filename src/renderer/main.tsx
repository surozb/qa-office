import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { OfficeState } from '../shared/types';

function App() {
  const [s, setS] = useState<OfficeState | null>(null);
  useEffect(() => { const off = window.office.onState(setS); window.office.requestState(); return off; }, []);
  return <pre style={{ padding: 16, fontSize: 12 }}>{s ? JSON.stringify({ n: s.occupants.length, occupants: s.occupants.map((o) => [o.name, o.stationId, o.status, o.currentTool]), lastLog: s.log.at(-1) }, null, 2) : 'waiting…'}</pre>;
}
createRoot(document.getElementById('root')!).render(<App />);
