import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useOffice } from './store';
import { Floor } from './floor/Floor';
import { SidePanel } from './panels/SidePanel';
import { Legend } from './panels/Legend';
import './panels/panels.css';

function App() {
  const setState = useOffice((u) => u.setState);
  useEffect(() => { const off = window.office.onState(setState); window.office.requestState(); return off; }, [setState]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Legend />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}><Floor /><SidePanel /></div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
