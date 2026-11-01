import { Routes, Route, Link } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import {
  Card,
  Button,
  Input,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  StatCard,
  Spinner,
  EmptyState,
} from '../../components/ui'

function getUserRoles(user) {
  if (!user) return []
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles
  if (user.role) return [user.role]
  return []
}

/* --------------------------------------------------------------------------
 * ClubDashboard shell
 * -------------------------------------------------------------------------- */
export default function ClubDashboard() {
  return (
    <Routes>
      <Route path="/" element={<ClubOverview />} />
      <Route path="/matches" element={<ClubMatches />} />
      <Route path="/tickets" element={<ClubTickets />} />
      <Route path="/team" element={<TeamManagement />} />
    </Routes>
  )
}

/* --------------------------------------------------------------------------
 * ClubOverview
 * -------------------------------------------------------------------------- */
function ClubOverview() {
  const { api, user } = useAuth()
  const roles = useMemo(() => getUserRoles(user), [user])
  const isAdmin = roles.includes('super_admin') || roles.includes('faz_admin')

  const [stats, setStats] = useState({ matches: 0, tickets: 0, revenue: 0 })
  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [needsClubAssignment, setNeedsClubAssignment] = useState(false)
  const [needsClubSetup, setNeedsClubSetup] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch dashboard summary
        const dashRes = await api
          .get('/api/ticketing/club/dashboard')
          .catch(() => ({ data: {} }))
        const data = dashRes.data || {}

        if (data.needs_club_assignment) {
          if (!cancelled) {
            setNeedsClubAssignment(true)
            setMessage(data.message)
          }
          return
        }
        if (data.needs_club_setup) {
          if (!cancelled) {
            setNeedsClubSetup(true)
            setMessage(data.message)
          }
          return
        }

        // Fetch full match list
        const matchesRes = await api
          .get('/api/ticketing/club/matches')
          .catch(() => ({ data: [] }))
        const allMatches = matchesRes.data || []
        const upcoming = data.upcoming_matches || allMatches

        if (!cancelled) {
          setClub(data.club || null)
          setStats({
            matches: upcoming.length || 0,
            tickets: data.total_tickets_sold || 0,
            revenue: data.total_revenue || 0,
          })
          setUpcomingMatches(upcoming.slice(0, 6))
        }
      } catch (error) {
        console.error('Club dashboard error:', error)
        if (!cancelled) toast.error('Failed to load dashboard data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [api])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="xl" />
      </div>
    )
  }

  if (needsClubAssignment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Club Dashboard</h1>
          <p className="text-gray-500">Welcome to your club portal</p>
        </div>
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Club Not Assigned</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              {message || 'Your account is not yet linked to a club.'}
            </p>
            <div className="bg-blue-50 p-4 rounded-xl text-left max-w-md mx-auto">
              <p className="text-sm text-blue-800">
                <span className="font-medium">📧 Need help?</span>
                <br />
                Please contact the FAZ administrator at{' '}
                <strong>admin@faz.co.zm</strong> to have your account linked to
                your club.
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (needsClubSetup) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Club Dashboard</h1>
          <p className="text-gray-500">Manage your club's matches and ticket sales</p>
        </div>
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Clubs Found</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              {message || 'There are no active clubs in the system yet.'}
            </p>
            <Button to="/admin/clubs" variant="primary">
              ➕ Create Your First Club
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          {club?.name || 'Club'} Dashboard
        </h1>
        <p className="text-gray-500">Manage your club's matches and ticket sales</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Upcoming Matches"
          value={stats.matches}
          icon="⚽"
          color="primary"
        />
        <StatCard
          title="Tickets Sold"
          value={stats.tickets}
          icon="🎫"
          color="orange"
        />
        <StatCard
          title="Revenue"
          value={`ZMW ${(stats.revenue || 0).toFixed(2)}`}
          icon="💰"
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">Upcoming Matches</h3>
            <Link
              to="/club/matches"
              className="text-orange-600 hover:underline text-sm"
            >
              View All →
            </Link>
          </div>
          {upcomingMatches.length > 0 ? (
            <div className="space-y-3">
              {upcomingMatches.slice(0, 3).map(match => (
                <div
                  key={match.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {match.home_team} vs {match.away_team}
                    </p>
                    <p className="text-sm text-gray-500">
                      {match.match_date
                        ? new Date(match.match_date).toLocaleDateString()
                        : 'Date TBA'}
                    </p>
                  </div>
                  <Badge variant={match.is_active ? 'success' : 'secondary'}>
                    {match.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No upcoming matches</p>
          )}
        </Card>

        <Card padding="lg">
          <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Button to="/club/matches" variant="primary" fullWidth>
              ➕ Create New Match
            </Button>
            <Button to="/club/tickets" variant="outline" fullWidth>
              📊 View Ticket Sales
            </Button>
            <Button to="/club/team" variant="outline" fullWidth>
              👕 Manage Squad
            </Button>
            {isAdmin && (
              <Button to="/admin/users" variant="outline" fullWidth>
                👥 Manage Users
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * ClubMatches
 * -------------------------------------------------------------------------- */
function ClubMatches() {
  const { api, user } = useAuth()
  const roles = useMemo(() => getUserRoles(user), [user])

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [noClubAssigned, setNoClubAssigned] = useState(false)
  const [formData, setFormData] = useState({
    home_team: '',
    away_team: '',
    venue: '',
    date_time: '',
    description: '',
    ticket_types: [{ name: 'Regular', price: '', capacity: '' }],
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const needsClub =
      (roles.includes('club_admin') || roles.includes('club_officer')) &&
      !user?.club_id
    if (needsClub) {
      setNoClubAssigned(true)
      setLoading(false)
      return
    }
    fetchMatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roles])

  const fetchMatches = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/ticketing/club/matches')
      setMatches(res.data || [])
    } catch (error) {
      toast.error('Failed to load matches')
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const addTicketType = () =>
    setFormData(prev => ({
      ...prev,
      ticket_types: [...prev.ticket_types, { name: '', price: '', capacity: '' }],
    }))

  const updateTicketType = (index, field, value) =>
    setFormData(prev => {
      const updated = [...prev.ticket_types]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, ticket_types: updated }
    })

  const removeTicketType = (index) =>
    setFormData(prev => ({
      ...prev,
      ticket_types: prev.ticket_types.filter((_, i) => i !== index),
    }))

  const resetForm = () =>
    setFormData({
      home_team: '',
      away_team: '',
      venue: '',
      date_time: '',
      description: '',
      ticket_types: [{ name: 'Regular', price: '', capacity: '' }],
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const submitData = {
        ...formData,
        ticket_types: formData.ticket_types
          .filter(tt => tt.name.trim() && tt.price !== '' && tt.capacity !== '')
          .map(tt => ({
            name: tt.name.trim(),
            price: parseFloat(tt.price),
            capacity: parseInt(tt.capacity),
          })),
      }
      await api.post('/api/ticketing/club/matches', submitData)
      toast.success('Match created successfully!')
      setShowForm(false)
      resetForm()
      fetchMatches()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create match')
    } finally {
      setSubmitting(false)
    }
  }

  if (noClubAssigned) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Club Matches</h1>
          <p className="text-gray-500">Manage your club's fixtures</p>
        </div>
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Club Assigned</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Your account is not linked to a club. Please contact an
              administrator to get set up.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Club Matches</h1>
          <p className="text-gray-500">Manage your club's fixtures</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'outline' : 'primary'}
        >
          {showForm ? 'Cancel' : '+ New Match'}
        </Button>
      </div>

      {showForm && (
        <Card padding="lg">
          <h3 className="font-bold text-gray-800 mb-4">Create New Match</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Home Team"
                placeholder="e.g., ZESCO United"
                value={formData.home_team}
                onChange={e => setFormData({ ...formData, home_team: e.target.value })}
                required
              />
              <Input
                label="Away Team"
                placeholder="e.g., Nkana FC"
                value={formData.away_team}
                onChange={e => setFormData({ ...formData, away_team: e.target.value })}
                required
              />
              <Input
                label="Venue"
                placeholder="e.g., Levy Mwanawasa Stadium"
                value={formData.venue}
                onChange={e => setFormData({ ...formData, venue: e.target.value })}
                required
              />
              <Input
                label="Date & Time"
                type="datetime-local"
                value={formData.date_time}
                onChange={e => setFormData({ ...formData, date_time: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ticket Types
              </label>
              <div className="space-y-3">
                {formData.ticket_types.map((tt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <Input
                        placeholder="Name (e.g., VIP)"
                        value={tt.name}
                        onChange={e => updateTicketType(idx, 'name', e.target.value)}
                        required
                      />
                      <Input
                        type="number"
                        placeholder="Price (ZMW)"
                        value={tt.price}
                        onChange={e => updateTicketType(idx, 'price', e.target.value)}
                        min="0"
                        step="0.01"
                        required
                      />
                      <Input
                        type="number"
                        placeholder="Capacity"
                        value={tt.capacity}
                        onChange={e => updateTicketType(idx, 'capacity', e.target.value)}
                        min="1"
                        required
                      />
                    </div>
                    {formData.ticket_types.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTicketType(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTicketType}
                className="mt-3 text-sm text-orange-600 hover:underline"
              >
                + Add Another Ticket Type
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" loading={submitting}>
                Create Match
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding="none">
        {matches.length === 0 ? (
          <EmptyState
            icon="⚽"
            title="No matches found"
            description="Create your first match to start selling tickets."
            actionLabel="Create Match"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Match</TableHeaderCell>
                <TableHeaderCell>Venue</TableHeaderCell>
                <TableHeaderCell>Date & Time</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.map(match => (
                <TableRow key={match.id}>
                  <TableCell className="font-medium">
                    {match.home_team} vs {match.away_team}
                  </TableCell>
                  <TableCell>{match.venue}</TableCell>
                  <TableCell>
                    {match.match_date
                      ? new Date(match.match_date).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={match.is_active ? 'success' : 'secondary'}>
                      {match.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * ClubTickets
 * -------------------------------------------------------------------------- */
function ClubTickets() {
  const { api } = useAuth()
  const [ticketSales, setTicketSales] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await api
          .get('/api/ticketing/club/tickets/sales')
          .catch(() => ({ data: [] }))
        setTicketSales(res.data || [])
      } catch (error) {
        toast.error('Failed to load ticket sales')
        setTicketSales([])
      } finally {
        setLoading(false)
      }
    }
    fetchSales()
  }, [api])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Ticket Sales</h1>
        <p className="text-gray-500">View ticket sales for your matches</p>
      </div>

      <Card padding="none">
        {ticketSales.length === 0 ? (
          <EmptyState
            icon="🎫"
            title="No ticket sales yet"
            description="Sales data will appear here once tickets are purchased."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Match</TableHeaderCell>
                <TableHeaderCell>Ticket Type</TableHeaderCell>
                <TableHeaderCell>Sold</TableHeaderCell>
                <TableHeaderCell>Revenue</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ticketSales.map((sale, idx) => (
                <TableRow key={idx}>
                  <TableCell>{sale.match}</TableCell>
                  <TableCell>{sale.type}</TableCell>
                  <TableCell>{sale.sold}</TableCell>
                  <TableCell>ZMW {Number(sale.revenue || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * TeamManagement
 * -------------------------------------------------------------------------- */
function TeamManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Team Management</h1>
        <p className="text-gray-500">Manage your club's squad and staff</p>
      </div>

      <Card padding="lg">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👕</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Coming Soon</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Team management features are under development.
          </p>
        </div>
      </Card>
    </div>
  )
}