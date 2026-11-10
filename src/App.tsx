import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getState, flush, loadCache, loadOutbox, refresh, setState, subscribeRealtime, unsubscribeRealtime, useStore } from './lib/store'
import { syncPush } from './lib/push'
import Login from './pages/Login'
import Pending from './pages/Pending'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import CalendarPage from './pages/Calendar'
import Record from './pages/Record'
import Review from './pages/Review'
import Ideas from './pages/Ideas'
import Insights from './pages/Insights'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Household from './pages/Household'
import AllTasks from './pages/AllTasks'
import Learned from './pages/Learned'
import Shopping from './pages/Shopping'
import Nav from './components/Nav'
import TaskSheet from './components/TaskSheet'
import Toast from './components/Toast'
import { Splash } from './components/Logo'

function applyTheme(theme: string | undefined) {
  const t = theme === 'light' || theme === 'dark' ? theme : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  document.documentElement.dataset.theme = t
  const c = t === 'light' ? '#F2F3F5' : '#131418'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c)
}

function Shell() {
  const loc = useLocation()
  const showNav = !['/record', '/review'].includes(loc.pathname)
  useEffect(() => { document.querySelector('.app')?.scrollTo(0, 0) }, [loc.pathname])
  return (
    <div className="app">
      <div key={loc.pathname} className="route">
      <Routes location={loc}>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/record" element={<Record />} />
        <Route path="/review" element={<Review />} />
        <Route path="/ideas" element={<Ideas />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/household" element={<Household />} />
        <Route path="/tasks" element={<AllTasks />} />
        <Route path="/cancelled" element={<AllTasks cancelled />} />
        <Route path="/learned" element={<Learned />} />
        <Route path="/shopping/:world" element={<Shopping />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </div>
      {showNav && <Nav />}
      <TaskSheet />
    </div>
  )
}

export default function App() {
  const session = useStore((s) => s.session)
  const profile = useStore((s) => s.profile)
  const online = useStore((s) => s.online)
  const pendingOps = useStore((s) => s.pendingOps)
  const authChecked = useStore((s) => s.ready || s.session !== null)
  const [minSplash, setMinSplash] = useState(true)
  useEffect(() => { const t = setTimeout(() => setMinSplash(false), 450); return () => clearTimeout(t) }, [])

  useEffect(() => {
    applyTheme(undefined)
    loadOutbox()
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await loadCache(data.session.user.id)
        setState({ session: data.session })
        refresh().then(() => flush())
        subscribeRealtime()
        syncPush()
      } else setState({ ready: true })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'SIGNED_IN' && s) { setState({ session: s }); refresh(); subscribeRealtime(); syncPush() }
      if (ev === 'TOKEN_REFRESHED' && s) setState({ session: s })
      if (ev === 'SIGNED_OUT') { unsubscribeRealtime(); setState({ session: null, profile: null, tasks: [], ideas: [], shopping: [], ready: true }) }
    })
    const on = () => { setState({ online: true }); flush() }
    const off = () => setState({ online: false })
    const vis = () => { if (document.visibilityState === 'visible') { refresh(); flush() } }
    window.addEventListener('online', on); window.addEventListener('offline', off)
    document.addEventListener('visibilitychange', vis)
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const mqh = () => applyTheme(getState().profile?.theme)
    mq.addEventListener('change', mqh)
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('online', on); window.removeEventListener('offline', off); document.removeEventListener('visibilitychange', vis); mq.removeEventListener('change', mqh) }
  }, [])

  useEffect(() => { applyTheme(profile?.theme) }, [profile?.theme])

  let body
  if (!authChecked || minSplash) body = <Splash />
  else if (!session) body = <Login />
  else if (!profile) body = <Splash />
  else if (profile.status !== 'approved') body = <Pending />
  else if (!profile.onboarded) body = <Onboarding />
  else body = <HashRouter><Shell /></HashRouter>

  return (
    <>
      {!online && <div className="offline">אין חיבור לאינטרנט{pendingOps ? ` · ${pendingOps} שינויים יסונכרנו כשהחיבור יחזור` : ' · השינויים נשמרים בטלפון'}</div>}
      {body}
      <Toast />
    </>
  )
}
