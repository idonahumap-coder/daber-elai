export function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="דבר אליי">
      <rect width="140" height="140" rx="36" fill="var(--accent)" />
      <path d="M36 44a12 12 0 0 1 12-12h44a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12H66l-18 16v-16a12 12 0 0 1-12-12z" fill="var(--on-accent)" />
      <path d="M56 62l10 10 20-22" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Splash() {
  return (
    <div className="splash">
      <div />
      <div className="col" style={{ alignItems: 'center', gap: 26 }}>
        <Logo size={112} />
        <div className="col" style={{ alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>דבר אליי</div>
          <div className="muted" style={{ fontSize: 15, fontWeight: 300 }}>אתה מדבר, אני זוכר.</div>
        </div>
      </div>
      <div className="splash-bar"><span /></div>
    </div>
  )
}
