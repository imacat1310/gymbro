import { lazy, Suspense } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { BottomNav } from './components/BottomNav'
import { UpdateBanner } from './components/UpdateBanner'
import { formatDuration, useActiveSession, useNow } from './lib/hooks'
import { ExercisePage } from './pages/ExercisePage'
import { GymPage } from './pages/GymPage'
import { HistoryPage } from './pages/HistoryPage'
import { LibraryPage } from './pages/LibraryPage'
import { ProfilePage } from './pages/ProfilePage'
import { PlanPage } from './pages/PlanPage'
import { SessionPage } from './pages/SessionPage'
import { TodayPage } from './pages/TodayPage'
import { WelcomePage } from './pages/WelcomePage'
import { WorkoutPage } from './pages/WorkoutPage'
import './App.css'
import './theme.css'

// Rarely opened screens load on demand to keep the first load small (the service worker still precaches them).
const DeviceCheck = lazy(() => import('./components/DeviceCheck').then((m) => ({ default: m.DeviceCheck })))
const PoseTest = lazy(() => import('./components/PoseTest').then((m) => ({ default: m.PoseTest })))
const BodyPage = lazy(() => import('./pages/BodyPage').then((m) => ({ default: m.BodyPage })))
const PosturePage = lazy(() => import('./pages/PosturePage').then((m) => ({ default: m.PosturePage })))
const ImbalancePage = lazy(() => import('./pages/ImbalancePage').then((m) => ({ default: m.ImbalancePage })))
const GymTourPage = lazy(() => import('./pages/GymTourPage').then((m) => ({ default: m.GymTourPage })))
const BodyReportPage = lazy(() => import('./pages/BodyReportPage').then((m) => ({ default: m.BodyReportPage })))
const PlanReportPage = lazy(() => import('./pages/PlanReportPage').then((m) => ({ default: m.PlanReportPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const BadgesPage = lazy(() => import('./pages/BadgesPage').then((m) => ({ default: m.BadgesPage })))
const TrunkTestPage = lazy(() => import('./pages/TrunkTestPage').then((m) => ({ default: m.TrunkTestPage })))
const PostureReportPage = lazy(() => import('./pages/PostureReportPage').then((m) => ({ default: m.PostureReportPage })))
const FormCheckPage = lazy(() => import('./pages/FormCheckPage').then((m) => ({ default: m.FormCheckPage })))

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
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Outlet />
        </Suspense>
        <p className="muted small footer">GymBro v{__APP_VERSION__}</p>
      </main>
      {!onWorkout && <BottomNav />}
    </>
  )
}

/** Old "More" links (bookmarks, saved E2E paths) now live under Profile. */
function MoreRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate to={pathname.replace(/^\/more/, '/profile') + search} replace />
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
    <>
      <UpdateBanner />
      <Routes>
      <Route path="/welcome" element={<main className="app"><WelcomePage /></main>} />
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="workout" element={<WorkoutPage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="session/:id" element={<SessionPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/plan/:id" element={<PlanReportPage />} />
        <Route path="exercise/:id" element={<ExercisePage />} />
        <Route path="form/:exerciseId" element={<FormCheckPage />} />
        <Route path="gym" element={<GymPage />} />
        <Route path="gym/setup" element={<GymTourPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/device" element={<Wrap title="Device check"><DeviceCheck /></Wrap>} />
        <Route path="profile/posture" element={<PosturePage />} />
        <Route path="profile/posture/:id" element={<PostureReportPage />} />
        <Route path="profile/body" element={<BodyPage />} />
        <Route path="profile/badges" element={<BadgesPage />} />
        <Route path="profile/goals" element={<GoalsPage />} />
        <Route path="profile/body-report" element={<BodyReportPage />} />
        <Route path="profile/imbalance" element={<ImbalancePage />} />
        <Route path="profile/imbalance/trunk" element={<TrunkTestPage />} />
        <Route path="profile/pose" element={<Wrap title="Pose speed test"><PoseTest /></Wrap>} />
        <Route path="more/*" element={<MoreRedirect />} />
        <Route path="*" element={<TodayPage />} />
      </Route>
      </Routes>
    </>
  )
}

export default App
