import { setState, useStore } from '../lib/store'

export default function Toast() {
  const t = useStore((s) => s.toast)
  if (!t) return null
  return (
    <div className={'toast' + (t.undo ? '' : ' solo')} role="status" key={t.id}>
      <span>{t.text}</span>
      {t.undo && <button onClick={() => { t.undo!(); setState({ toast: null }) }}>החזר</button>}
    </div>
  )
}
