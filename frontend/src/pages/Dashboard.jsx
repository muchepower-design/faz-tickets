import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Card, Button, Badge, StatCard, Spinner, EmptyState,
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '../components/ui'

function safeDate(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function getUserRoles(user) {
  if (!user) return []
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles
  if (user.role) return [user.role]
  return []
}

const ROLE_PRIORITY = [
  'super_admin',
  'faz_admin',
  'club_admin',
  'club_officer',
  'scanner',
  'customer',
]

function primaryRole(roles) {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r
  }
  return roles[0] || 'customer'
}

const ROLE_META = {
  super_admin: {
    title: 'Super Admin',
    description: 'Full system access and management',
    link: '/admin',
    icon: '👑',
    color: 'purple',
    dashboardLabel: 'Super Admin Dashboard',
  },
  faz_admin: {
    title: 'FAZ Admin',
    description: 'Manage national matches, competitions and clubs',
    link: '/admin',
    icon: '🏆',
    color: 'green',
    dashboardLabel: 'FAZ Admin Dashboard',
  },
  club_admin: {
    title: 'Club Admin',
    description: 'Manage your club operations',
    link: '/club',
    icon: '🏟️',
    color: 'orange',
    dashboardLabel: 'Club Admin Dashboard',
  },
  club_officer: {
    title: 'Club Officer',
    description: 'Manage matches and ticket sales',
    link: '/club',
    icon: '📋',
    color: 'blue',
    dashboardLabel: 'Club Officer Dashboard',
  },
  scanner: {
    title: 'Ticket Scanner',
    description: 'Verify tickets at stadium gates',
    link: '/verify',
    icon: '📷',
    color: 'red',
    dashboardLabel: 'Ticket Scanner Dashboard',
  },
  customer: {
    title: 'Fan',
    description: 'Browse matches and buy tickets',
    link: '/matches',
    icon: '🎟️',
    color: 'green',
    dashboardLabel: 'Fan Dashboard',
  },
}

const COLOR_GRADIENT = {
  purple: 'from-purple-500 to-purple-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  blue: 'from-blue-500 to-blue-600',
  red: 'from-red-500 to-red-600',
}

/* --------------------------------------------------------------------------
 * Dashboard
 * -------------------------------------------------------------------------- */
export default function Dashboard() {
  const { user, api } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    upcomingMatches: 0,
    totalOrders: 0,
    ticketsPurchased: 0,
    clubsManaged: 0,
    mySales: 0,
    myRevenue: 0,
  })
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [recentOrders, setRecentOrders] = useState([])

  const roles = useMemo(() => getUserRoles(user), [user])
  const role = primaryRole(roles)
  const isSuperAdmin = roles.includes('super_admin')
  const isFazAdmin = roles.includes('faz_admin')
  const isAdmin = isSuperAdmin || isFazAdmin
  const isClub = roles.includes('club_admin') || roles.includes('club_officer')
  const isScanner = roles.includes('scanner')

  /* ---------------- Load dashboard data ---------------- */
  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      if (isAdmin) {
        const [matchesRes, clubsRes, ordersRes] = await Promise.all([
          api.get('/api/ticketing/matches?active_only=true').catch(() => ({ data: [] })),
          api.get('/api/ticketing/clubs?active_only=false').catch(() => ({ data: [] })),
          api.get('/api/ticketing/admin/orders').catch(() => ({ data: [] })),
        ])
        const matches = matchesRes.data || []
        const clubs = clubsRes.data || []
        const orders = ordersRes.data || []
        const ticketsSold = orders
          .flatMap(o => o.items || [])
          .reduce((s, it) => s + (it.quantity || 0), 0)

        setStats({
          upcomingMatches: matches.length,
          totalOrders: orders.length,
          ticketsPurchased: ticketsSold,
          clubsManaged: clubs.filter(c => c.is_active).length,
          mySales: 0,
          myRevenue: 0,
        })
        setUpcomingMatches(matches.slice(0, 6))
        setRecentOrders(orders.slice(0, 5))
      } else if (isClub) {
        const [dashRes, matchesRes] = await Promise.all([
          api.get('/api/ticketing/club/dashboard').catch(() => ({ data: {} })),
          api.get('/api/ticketing/club/matches').catch(() => ({ data: [] })),
        ])
        const upcoming = dashRes.data?.upcoming_matches || []
        const allMatches = matchesRes.data || []

        setStats({
          upcomingMatches: upcoming.length,
          totalOrders: 0,
          ticketsPurchased: dashRes.data?.total_tickets_sold || 0,
          clubsManaged: 1,
          mySales: allMatches.length,
          myRevenue: dashRes.data?.total_revenue || 0,
        })
        setUpcomingMatches(allMatches.slice(0, 6))
      } else if (isScanner) {
        // Scanner sees upcoming matches they might need to verify at
        const res = await api.get('/api/ticketing/matches?active_only=true').catch(() => ({ data: [] }))
        const matches = res.data || []
        setStats({
          upcomingMatches: matches.length,
          totalOrders: 0,
          ticketsPurchased: 0,
          clubsManaged: 0,
          mySales: 0,
          myRevenue: 0,
        })
        setUpcomingMatches(matches.slice(0, 6))
      } else {
        // Customer / fan
        const [matchesRes, ordersRes] = await Promise.all([
          api.get('/api/ticketing/matches?active_only=true').catch(() => ({ data: [] })),
          api.get('/api/ticketing/orders?mine=true').catch(() => ({ data: [] })),
        ])
        const matches = matchesRes.data || []
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : []
        const ticketsBought = orders
          .flatMap(o => o.items || [])
          .reduce((s, it) => s + (it.quantity || 0), 0)

        setUpcomingMatches(matches.slice(0, 6))
        setRecentOrders(orders.slice(0, 5))
        setStats({
          upcomingMatches: matches.length,
          totalOrders: orders.length,
          ticketsPurchased: ticketsBought,
          clubsManaged: 0,
          mySales: 0,
          myRevenue: 0,
        })
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [api, isAdmin, isClub, isScanner])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const roleInfo = ROLE_META[role] || ROLE_META.customer

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="xl" /></div>
  }

  /* -------------------- Render -------------------- */
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, {user?.first_name || user?.full_name || 'there'}!
        </h1>
        <p className="text-gray-500">{roleInfo.dashboardLabel}</p>
      </div>

      <div className="space-y-8">
        {/* Hero card */}
        <Card padding="lg" gradient>
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 bg-gradient-to-br ${
                COLOR_GRADIENT[roleInfo.color] || COLOR_GRADIENT.green
              } rounded-2xl flex items-center justify-center text-3xl shadow-lg`}
            >
              {roleInfo.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-gray-800 truncate">
                {user?.full_name ||
                  `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
                  'User'}
              </h2>
              <p className="text-gray-600 truncate">
                {user?.email} • {roleInfo.description}
              </p>
              {roles.length > 1 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {roles.map(r => (
                    <Badge key={r} variant="info" size="sm">
                      {ROLE_META[r]?.title || r.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Upcoming Matches"
            value={stats.upcomingMatches}
            icon="⚽"
            color="primary"
          />

          {isAdmin && (
            <>
              <StatCard
                title="Total Orders"
                value={stats.totalOrders}
                icon="📦"
                color="blue"
              />
              <StatCard
                title="Tickets Sold"
                value={stats.ticketsPurchased}
                icon="🎫"
                color="orange"
              />
              <StatCard
                title="Active Clubs"
                value={stats.clubsManaged}
                icon="🏢"
                color="purple"
              />
            </>
          )}

          {isClub && (
            <>
              <StatCard
                title="My Matches"
                value={stats.mySales}
                icon="📅"
                color="blue"
              />
              <StatCard
                title="Tickets Sold"
                value={stats.ticketsPurchased}
                icon="🎫"
                color="orange"
              />
              <StatCard
                title="Revenue"
                value={`ZMW ${(stats.myRevenue || 0).toFixed(2)}`}
                icon="💰"
                color="green"
              />
            </>
          )}

          {isScanner && (
            <>
              <StatCard
                title="Tickets to Verify"
                value="—"
                icon="🎫"
                color="orange"
              />
              <StatCard
                title="Scan Mode"
                value="Ready"
                icon="📷"
                color="green"
              />
              <StatCard
                title="Today"
                value={new Date().toLocaleDateString()}
                icon="📅"
                color="blue"
              />
            </>
          )}

          {!isAdmin && !isClub && !isScanner && (
            <>
              <StatCard
                title="My Orders"
                value={stats.totalOrders}
                icon="📦"
                color="blue"
              />
              <StatCard
                title="Tickets Bought"
                value={stats.ticketsPurchased}
                icon="🎫"
                color="orange"
              />
              <StatCard
                title="Account Status"
                value={user?.is_active !== false ? 'Active' : 'Inactive'}
                icon="✅"
                color="green"
              />
            </>
          )}
        </div>

        {/* Quick Access Cards */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Access</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Primary role card */}
            <Link to={roleInfo.link}>
              <Card padding="md" hover className="h-full group">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${
                      COLOR_GRADIENT[roleInfo.color] || COLOR_GRADIENT.green
                    } rounded-xl flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition`}
                  >
                    {roleInfo.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800">{roleInfo.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{roleInfo.description}</p>
                  </div>
                  <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                </div>
              </Card>
            </Link>

            {/* Extra access cards for combined roles */}
            {isSuperAdmin && (
              <Link to="/admin/competitions">
                <Card padding="md" hover className="h-full group">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-faz-orange to-faz-red rounded-xl flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition">
                      🏆
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">Competitions</h4>
                      <p className="text-sm text-gray-500 mt-1">Leagues, cups, seasons, standings</p>
                    </div>
                    <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                  </div>
                </Card>
              </Link>
            )}

            {(isAdmin || isClub) && (
              <Link to="/admin/users">
                <Card padding="md" hover className="h-full group">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition">
                      👥
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">Users</h4>
                      <p className="text-sm text-gray-500 mt-1">Manage roles and access</p>
                    </div>
                    <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                  </div>
                </Card>
              </Link>
            )}

            {isScanner && (
              <Link to="/verify">
                <Card padding="md" hover className="h-full group">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition">
                      📷
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">Scan Tickets</h4>
                      <p className="text-sm text-gray-500 mt-1">Open the scanner</p>
                    </div>
                    <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                  </div>
                </Card>
              </Link>
            )}

            {!isScanner && (
              <Link to="/matches">
                <Card padding="md" hover className="h-full group">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition">
                      ⚽
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">Browse Matches</h4>
                      <p className="text-sm text-gray-500 mt-1">See fixtures and buy tickets</p>
                    </div>
                    <span className="text-gray-400 group-hover:translate-x-1 transition">→</span>
                  </div>
                </Card>
              </Link>
            )}
          </div>
        </div>

        {/* Upcoming matches */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Upcoming Matches</h3>
            <Link to="/matches" className="text-green-600 hover:underline text-sm font-medium">
              View All →
            </Link>
          </div>

          {upcomingMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingMatches.slice(0, 6).map(match => {
                const dt = safeDate(match.match_date)
                const lowestPrice = match.ticket_types?.length > 0
                  ? Math.min(...match.ticket_types.map(tt => tt.price))
                  : null
                const isNational = match.match_type === 'national'
                return (
                  <Link key={match.id} to={`/matches/${match.id}`}>
                    <Card padding="md" hover className="h-full group">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant={isNational ? 'success' : 'orange'} size="sm">
                          {isNational ? 'National' : 'Club'}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {dt ? dt.toLocaleDateString() : 'TBA'}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-800 mb-1">
                        {match.home_team} vs {match.away_team}
                      </h4>
                      <p className="text-sm text-gray-500 mb-2">
                        📍 {match.venue || 'Venue TBA'}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-green-600 font-medium">
                          {lowestPrice != null
                            ? `From ZMW ${lowestPrice.toFixed(2)}`
                            : 'Tickets TBA'}
                        </span>
                        <span className="text-green-600 group-hover:translate-x-1 transition">→</span>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon="📅"
              title="No upcoming matches"
              description="Check back later for new matches!"
              actionLabel="Browse All Matches"
              actionTo="/matches"
            />
          )}
        </div>

        {/* Recent orders — admins and fans */}
        {(isAdmin || (!isClub && !isScanner)) && recentOrders.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Recent Orders</h3>
              {isAdmin && (
                <Link
                  to="/admin/orders"
                  className="text-green-600 hover:underline text-sm font-medium"
                >
                  View All →
                </Link>
              )}
            </div>
            <Card padding="none">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Order #</TableHeaderCell>
                    <TableHeaderCell>Customer</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {(order.order_number || '').slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.customer_name || order.customer_email || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="font-medium">
                        ZMW {parseFloat(order.total_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={order.payment_status === 'paid' ? 'success' : 'warning'}
                        >
                          {order.payment_status || 'pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button to="/matches" variant="primary">Browse Matches</Button>

            {isAdmin && (
              <>
                <Button to="/admin/matches" variant="outline">🎟️ Set Tickets</Button>
                <Button to="/admin/competitions" variant="outline">🏆 Competition Management</Button>
                <Button to="/admin/clubs" variant="outline">🏢 Manage Clubs</Button>
                <Button to="/admin/users" variant="outline">👥 Manage Users</Button>
                <Button to="/admin/orders" variant="outline">📦 Orders</Button>
                <Button to="/admin/reports" variant="outline">📈 Reports</Button>
              </>
            )}

            {isClub && (
              <>
                <Button to="/club/matches" variant="outline">➕ Create Club Match</Button>
                <Button to="/club/tickets" variant="outline">🎫 Ticket Sales</Button>
                <Button to="/club/team" variant="outline">👕 Squad</Button>
              </>
            )}

            {isScanner && (
              <>
                <Button to="/verify" variant="secondary">📷 Scan Tickets</Button>
                <Button to="/matches" variant="outline">📅 Today's Fixtures</Button>
              </>
            )}

            {!isAdmin && !isClub && !isScanner && (
              <>
                <Button to="/matches" variant="outline">🎟️ Buy Tickets</Button>
                <Button to="/orders" variant="outline">📦 My Orders</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}