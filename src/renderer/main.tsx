import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useOffice } from './store';
import { Floor } from './floor/Floor';

function App() {
  const setState = useOffice((u) => u.setState);
  useEffect(() => { const off = window.office.onState(setState); window.office.requestState(); return off; }, [setState]);
  return <div style={{ display: 'flex', height: '100vh' }}><Floor /></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
