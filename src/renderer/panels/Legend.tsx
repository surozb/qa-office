export function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: '#ffb454' }} />busy</span>
      <span><i style={{ background: '#7dd98f' }} />idle</span>
      <span><i style={{ background: '#6cb6ff' }} />waiting for you</span>
      <span><i style={{ background: '#6b7390' }} />gone</span>
      <span><i style={{ background: '#4a5068' }} />walk-in — your terminal, watch only</span>
    </div>
  );
}
