import { useEffect, useRef } from 'react';
import { useOffice } from '../store';

export function ActivityLog({ sessionId }: { sessionId?: string }) {
  const log = useOffice((u) => u.state?.log ?? []);
  const box = useRef<HTMLDivElement>(null);
  const lines = sessionId ? log.filter((l) => l.sessionId === sessionId) : log;
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines.length, sessionId]);
  return (
    <div className="log" ref={box}>
      {lines.map((l, i) => (
        <div key={`${l.at}-${l.sessionId}-${i}`}><span className="at">{l.at.slice(11, 19)}</span> {!sessionId && <span className="who">{l.name}</span>} {l.text}</div>
      ))}
      {lines.length === 0 && <div>— no activity yet —</div>}
    </div>
  );
}
