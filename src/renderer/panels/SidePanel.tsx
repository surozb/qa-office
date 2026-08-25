import { useOffice } from '../store';
import { ActivityLog } from './ActivityLog';
import { LobbyAssign } from './LobbyAssign';

const fmt = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));

export function SidePanel() {
  const state = useOffice((u) => u.state); const selected = useOffice((u) => u.selected);
  const follow = useOffice((u) => u.follow); const toggleFollow = useOffice((u) => u.toggleFollow);
  if (!state) return <aside className="side"><div className="side-head"><h2>QA Office</h2><div className="side-sub">waiting for state…</div></div></aside>;

  if (selected?.startsWith('occupant:')) {
    const o = state.occupants.find((x) => x.sessionId === selected.slice(9));
    if (o) {
      const station = state.stations.find((s) => s.id === o.stationId);
      return (
        <aside className="side">
          <div className="side-head"><h2>{o.name}</h2><div className="side-sub">{o.title ?? 'untitled session'}</div></div>
          <div className="side-body">
            <div><span className={`pill ${o.status}`}>{o.status}</span><span className="pill walkin">walk-in</span>
              <button className={follow ? 'btn on' : 'btn'} style={{ float: 'right' }} onClick={toggleFollow}>{follow ? '◉ following' : '○ follow'}</button></div>
            <dl className="kv">
              <dt>station</dt><dd>{station?.name ?? o.stationId}</dd>
              <dt>branch</dt><dd>{o.branch ?? '—'}</dd>
              <dt>pid</dt><dd>{o.pid}</dd>
              <dt>doing</dt><dd>{o.currentTool ?? '—'}</dd>
              <dt>tokens</dt><dd>{fmt(o.tokens.output)} out · {fmt(o.tokens.input)} in · {fmt(o.tokens.cacheRead)} cached</dd>
              <dt>cwd</dt><dd>{o.cwd}</dd>
            </dl>
            {o.stationId === state.lobbyId && <LobbyAssign o={o} />}
            <div><div className="side-sub" style={{ marginBottom: 4 }}>ACTIVITY · read-only</div><ActivityLog sessionId={o.sessionId} /></div>
            <p className="note">Walk-ins are watched, never controlled — the app reads the session registry and transcript files and touches nothing.</p>
          </div>
        </aside>
      );
    }
  }
  if (selected?.startsWith('station:')) {
    const s = state.stations.find((x) => x.id === selected.slice(8));
    if (s) {
      const occ = state.occupants.filter((o) => o.stationId === s.id);
      return (
        <aside className="side">
          <div className="side-head"><h2>{s.name}</h2><div className="side-sub">{s.cwds.join(' · ') || 'no folders bound'}</div></div>
          <div className="side-body">
            <dl className="kv"><dt>skills</dt><dd>{s.skills.join(', ') || '—'}</dd><dt>occupants</dt><dd>{occ.length || 'none'}</dd></dl>
            {occ.map((o) => <div key={o.sessionId}><span className={`pill ${o.status}`}>{o.status}</span>{o.name} — {o.currentTool ?? 'idle'}</div>)}
            {occ.length === 0 && <p className="note">Room is empty. An empty room is information — nobody is working this area.</p>}
          </div>
        </aside>
      );
    }
  }
  return (
    <aside className="side">
      <div className="side-head"><h2>Front Desk</h2><div className="side-sub">{state.occupants.length} on the floor · click a room or a worker</div></div>
      <div className="side-body"><div className="side-sub" style={{ marginBottom: 4 }}>ACTIVITY · all</div><ActivityLog /></div>
    </aside>
  );
}
