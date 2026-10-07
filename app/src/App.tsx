import { Link, Outlet, Route, Routes, useLocation } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { DeviceCheck } from './components/DeviceCheck'
import { PoseTest } from './components/PoseTest'
import { formatDuration, useActiveSession, useNow } from './lib/hooks'
import { ExercisePage } from './pages/ExercisePage'
import { GymPage } from './pages/GymPage'
import { HistoryPage } from './pages/HistoryPage'
import { LibraryPage } from './pages/LibraryPage'
import { MorePage } from './pages/MorePage'
import { PlanPage } from './pages/PlanPage'
import { SessionPage } from './pages/SessionPage'
import { TodayPage } from './pages/TodayPage'
import { WelcomePage } from './pages/WelcomePage'
import { WorkoutPage } from './pages/WorkoutPage'
import './App.css'

/** Shown on every screen except the workout itself, so an active session is never lost. */
function ActiveWorkoutBanner() {
  const session = useActiveSession()
  const now = useNow(1000)
  if (!session) return null
  const rest = session.restEndsAt ? session.restEndsAt - now : 0
  return (
    <Link to="/workout" className="active-banner">
      <span>Workout in progress · {formatDuration(now - session.startedAt)}</span>
      <span>{rest > 0 ? `Rest ${formatDuration(rest + 999)}` : 'Resume →'}</span>
    </Link>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const onWorkout = pathname === '/workout'
  return (
    <>
      {!onWorkout && <ActiveWorkoutBanner />}
      <main className="app">
        <Outlet />
        <p className="muted small footer">GymBro v{__APP_VERSION__}</p>
      </main>
      {!onWorkout && <BottomNav />}
    </>
  )
}

function Wrap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page">
      <header className="page-head"><h1>{title}</h1></header>
      {children}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<main className="app"><WelcomePage /></main>} />
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="workout" element={<WorkoutPage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="session/:id" element={<SessionPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="exercise/:id" element={<ExercisePage />} />
        <Route path="gym" element={<GymPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="more/device" element={<Wrap title="Device check"><DeviceCheck /></Wrap>} />
        <Route path="more/pose" element={<Wrap title="Pose speed test"><PoseTest /></Wrap>} />
        <Route path="*" element={<TodayPage />} />
      </Route>
    </Routes>
  )
}

export default App
