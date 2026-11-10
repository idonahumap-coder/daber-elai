const P: Record<string, string> = {
  home: 'M4 10.5L12 4l8 6.5V20H4z M10 20v-5h4v5',
  cal: 'M3.5 7.5a2.5 2.5 0 0 1 2.5-2.5h12a2.5 2.5 0 0 1 2.5 2.5v10.5a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z M3.5 10h17 M8 3v4 M16 3v4',
  mic: 'M9 6a3 3 0 0 1 6 0v5.5a3 3 0 0 1-6 0z M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21',
  idea: 'M9.5 18h5 M10.5 21h3 M12 3a6 6 0 0 0-3.8 10.6c.6.5.8 1.2.8 1.9V16h6v-.5c0-.7.2-1.4.8-1.9A6 6 0 0 0 12 3z',
  chart: 'M4 19.5V13 M9.5 19.5V5 M15 19.5v-9 M20.5 19.5V8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12 M18 6L6 18',
  plus: 'M12 5v14 M5 12h14',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  image: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15 9.5a1 1 0 1 0 0-.01',
  paste: 'M9 4h6v3H9z M8 5.5H6v15h12v-15h-2 M9 12h6 M9 16h4',
  back: 'M9 6l6 6-6 6',
  chevron: 'M15 6l-6 6 6 6',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  list: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6.2 M9 20a1 1 0 1 0 0-.01 M17 20a1 1 0 1 0 0-.01',
  repeat: 'M17 2l3 3-3 3 M4 11V9a4 4 0 0 1 4-4h12 M7 22l-3-3 3-3 M20 13v2a4 4 0 0 1-4 4H4',
  share: 'M16 6l-4-4-4 4 M12 2v13 M5 12v8h14v-8',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1z M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  logout: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  note: 'M5 4h14v16H5z M9 9h6 M9 13h6 M9 17h3',
  send: 'M4 12l16-8-6 16-3-7z',
  copy: 'M8 8h12v12H8z M4 16V4h12'
}

export function Icon({ name, size = 22, stroke = 1.5, className, style }: { name: string; size?: number; stroke?: number; className?: string; style?: React.CSSProperties }) {
  const d = P[name] || ''
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  )
}
