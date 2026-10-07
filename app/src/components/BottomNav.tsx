import { NavLink } from 'react-router'

const ICONS = {
  today: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  gym: 'M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12',
  history: 'M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
}

const ITEMS = [
  { to: '/', label: 'Today', icon: ICONS.today },
  { to: '/gym', label: 'Gym', icon: ICONS.gym },
  { to: '/history', label: 'History', icon: ICONS.history },
  { to: '/more', label: 'More', icon: ICONS.more },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d={i.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
