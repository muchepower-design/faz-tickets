import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useMemo } from 'react'

/* --------------------------------------------------------------------------
 * Role helpers
 * Roles come from the backend as `user.roles` (array of names). If that is
 * empty — e.g. an older user not yet backfilled — we fall back to the legacy
 * `user.role` string.
 * -------------------------------------------------------------------------- */
const ROLE_PRIORITY = [
  'super_admin',
  'faz_admin',
  'club_admin',
  'club_officer',
  'scanner',
  'customer',
]

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  faz_admin: 'FAZ Admin',
  club_admin: 'Club Admin',
  club_officer: 'Club Officer',
  scanner: 'Ticket Scanner',
  customer: 'Fan',
}

function getUserRoles(user) {
  if (!user) return []
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles
  if (user.role) return [user.role]
  return []
}

function primaryRole(roles) {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r
  }
  return roles[0] || null
}

/* --------------------------------------------------------------------------
 * DashboardLayout
 * -------------------------------------------------------------------------- */
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const roles = useMemo(() => getUserRoles(user), [user])

  const isSuperAdmin = roles.includes('super_admin')
  const isFazAdmin = roles.includes('faz_admin')
  const isAdmin = isSuperAdmin || isFazAdmin
  const isClub = roles.includes('club_admin') || roles.includes('club_officer')
  const isScanner = roles.includes('scanner')

  // Exact-match for top-level tabs, prefix-match for section roots so that
  // /admin/matches highlights "Admin Panel" too.
  const isActive = (path) => {
    if (location.pathname === path) return true
    // Only treat as a match if the path is a distinct segment prefix
    if (path === '/') return false
    return location.pathname.startsWith(path + '/')
  }

  const baseNavItems = [
    { path: '/dashboard', label: 'Overview', icon: '📊' },
  ]

  const adminNavItems = isAdmin ? [
    { path: '/admin', label: 'Admin Panel', icon: '⚙️' },
    { path: '/admin/competitions', label: 'Competitions', icon: '🏆' },
    { path: '/admin/matches', label: 'Matches', icon: '⚽' },
    { path: '/admin/clubs', label: 'Clubs', icon: '🏢' },
    { path: '/admin/users', label: 'Users', icon: '👥' },
    { path: '/admin/orders', label: 'Orders', icon: '📦' },
    { path: '/admin/reports', label: 'Reports', icon: '📈' },
  ] : []

  const clubNavItems = isClub ? [
    { path: '/club', label: 'Club Dashboard', icon: '🏟️' },
    { path: '/club/matches', label: 'My Matches', icon: '📅' },
    { path: '/club/tickets', label: 'Ticket Sales', icon: '🎫' },
    { path: '/club/team', label: 'Team Management', icon: '👕' },
  ] : []

  const scannerNavItems = isScanner ? [
    { path: '/verify', label: 'Scan Tickets', icon: '📷' },
  ] : []

  const navItems = [
    ...baseNavItems,
    ...adminNavItems,
    ...clubNavItems,
    ...scannerNavItems,
  ]

  const currentRole = primaryRole(roles)
  const roleLabel = currentRole ? (ROLE_LABELS[currentRole] || currentRole) : 'User'

  const displayName =
    user?.full_name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.email ||
    'User'

  const avatarLetter =
    user?.first_name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
              <p className="text-sm text-gray-500">{roleLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-700 leading-tight">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 leading-tight">{roleLabel}</p>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>

            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
              {avatarLetter}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-white shadow-lg min-h-[calc(100vh-73px)] transition-all duration-300 border-r border-gray-200 sticky top-[73px] self-start`}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                    active
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {sidebarOpen && (
                    <span className="font-medium truncate">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer note in the sidebar (only when expanded) */}
          {sidebarOpen && (
            <div className="px-4 mt-6">
              <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 p-4">
                <p className="text-xs text-green-900 font-semibold mb-1">
                  FAZ Digital Platform
                </p>
                <p className="text-[11px] text-green-800 leading-relaxed">
                  One Nation. One Team. Manage competitions, ticketing, and
                  digital operations in one place.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}