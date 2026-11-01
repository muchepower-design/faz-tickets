import { Routes, Route, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  StatCard,
  Modal,
  ModalFooter,
  Spinner,
  EmptyState,
} from '../../components/ui'
import { Pencil, Trash2, Eye, UserX, UserCheck, ToggleLeft, ToggleRight } from 'lucide-react'

export default function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<Overview />} />
      <Route path="/matches" element={<MatchesManager />} />
      <Route path="/clubs" element={<ClubsManager />} />
      <Route path="/users" element={<UsersManager />} />
      <Route path="/orders" element={<OrdersManager />} />
      <Route path="/reports" element={<ReportsManager />} />
    </Routes>
  )
}

// -------------------- Overview --------------------
function Overview() {
  const { api } = useAuth()
  const [stats, setStats] = useState({ matches: 0, clubs: 0, orders: 0, tickets: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [matchesRes, clubsRes, ordersRes, generalRes] = await Promise.all([
          api.get('/api/ticketing/matches?active_only=false').catch(() => ({ data: [] })),
          api.get('/api/ticketing/clubs?active_only=false').catch(() => ({ data: [] })),
          api.get('/api/ticketing/admin/orders').catch(() => ({ data: [] })),
          api.get('/api/matches?limit=500').catch(() => ({ data: [] })),
        ])

        const ticketingMatches = matchesRes.data || []
        const generalMatches = generalRes.data || []
        const orders = ordersRes.data || []
        const clubs = clubsRes.data || []

        const totalTickets = orders
          .flatMap(o => o.items || [])
          .reduce((sum, item) => sum + (item.quantity || 0), 0)

        setStats({
          matches: ticketingMatches.length + generalMatches.length,
          clubs: clubs.filter(c => c.is_active).length,
          orders: orders.length,
          tickets: totalTickets,
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        toast.error('Failed to load dashboard stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
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
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard Overview</h1>
        <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Matches" value={stats.matches} icon="⚽" color="primary" />
        <StatCard title="Active Clubs" value={stats.clubs} icon="🏢" color="green" />
        <StatCard title="Total Orders" value={stats.orders} icon="📦" color="blue" />
        <StatCard title="Tickets Sold" value={stats.tickets} icon="🎫" color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button to="/admin/matches" variant="primary" fullWidth>➕ New Ticketing Match</Button>
            <Button to="/admin/clubs" variant="outline" fullWidth>🏢 New Club</Button>
            <Button to="/admin/users" variant="outline" fullWidth>👤 New User</Button>
            <Button to="/verify" variant="secondary" fullWidth>📷 Scan Ticket</Button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Competition fixtures are managed separately in{' '}
            <Link to="/admin/competitions" className="text-orange-600 hover:underline">
              Competition Management
            </Link>.
          </p>
        </Card>

        <Card padding="lg">
          <h3 className="font-bold text-gray-800 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Database</span>
              <Badge variant="success" dot>Connected</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">API Status</span>
              <Badge variant="success" dot>Online</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Last Backup</span>
              <span className="text-sm text-gray-500">Today, 03:00</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function MatchesManager() {
  const { api } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [showTicketModal, setShowTicketModal] = useState(false)
  const [ticketMatch, setTicketMatch] = useState(null)
  const [ticketForm, setTicketForm] = useState({
    ticket_types: [{ name: 'Regular', price: '', capacity: '', sections: [] }],
  })
  const [submitting, setSubmitting] = useState(false)

  const [showViewModal, setShowViewModal] = useState(false)
  const [viewMatch, setViewMatch] = useState(null)

  useEffect(() => { fetchMatches() }, [])

  const fetchMatches = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/competitions-management/all-matches')
      setMatches(res.data || [])
    } catch (error) {
      toast.error('Failed to load matches')
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const openTicketModal = async (m) => {
    setTicketMatch(m)

    let sections = []
    try {
      const res = await api.get(`/api/ticketing/admin/matches/${m.id}/sections`)
      sections = res.data || []
    } catch { sections = [] }

    const types = m.ticket_types?.length
      ? m.ticket_types.map(tt => {
          const ttSections = sections
            .filter(s => s.ticket_type_id === tt.id)
            .map(s => ({
              name: s.name,
              side: s.side || '',
              deck: s.deck || '',
              rows: s.rows,
              seats_per_row: s.seats_per_row,
            }))
          return {
            id: tt.id,
            name: tt.name,
            price: String(tt.price),
            capacity: String(tt.capacity),
            sections: ttSections,
          }
        })
      : [{ name: 'Regular', price: '', capacity: '', sections: [] }]

    setTicketForm({ ticket_types: types })
    setShowTicketModal(true)
  }

  // ---- Ticket types ----
  const addTicketType = () =>
    setTicketForm(f => ({
      ...f,
      ticket_types: [...f.ticket_types, { name: '', price: '', capacity: '', sections: [] }],
    }))

  const updateTicketType = (idx, field, value) =>
    setTicketForm(f => {
      const updated = [...f.ticket_types]
      updated[idx] = { ...updated[idx], [field]: value }
      return { ...f, ticket_types: updated }
    })

  const removeTicketType = (idx) =>
    setTicketForm(f => ({ ...f, ticket_types: f.ticket_types.filter((_, i) => i !== idx) }))

  // ---- Sections (per ticket type) ----
  const addSection = (ttIdx) =>
    setTicketForm(f => {
      const updated = [...f.ticket_types]
      updated[ttIdx] = {
        ...updated[ttIdx],
        sections: [
          ...(updated[ttIdx].sections || []),
          { name: '', side: '', deck: '', rows: 0, seats_per_row: 0 },
        ],
      }
      const total = (updated[ttIdx].sections || [])
        .reduce((sum, s) => sum + ((s.rows || 0) * (s.seats_per_row || 0)), 0)
      if (total > 0) updated[ttIdx].capacity = String(total)
      return { ...f, ticket_types: updated }
    })

  const updateSection = (ttIdx, sIdx, field, value) =>
    setTicketForm(f => {
      const updated = [...f.ticket_types]
      const sections = [...(updated[ttIdx].sections || [])]
      sections[sIdx] = { ...sections[sIdx], [field]: value }
      updated[ttIdx] = { ...updated[ttIdx], sections }
      const total = sections.reduce(
        (sum, s) => sum + ((s.rows || 0) * (s.seats_per_row || 0)),
        0
      )
      if (total > 0) updated[ttIdx].capacity = String(total)
      return { ...f, ticket_types: updated }
    })

  const removeSection = (ttIdx, sIdx) =>
    setTicketForm(f => {
      const updated = [...f.ticket_types]
      const sections = (updated[ttIdx].sections || []).filter((_, i) => i !== sIdx)
      updated[ttIdx] = { ...updated[ttIdx], sections }
      const total = sections.reduce(
        (sum, s) => sum + ((s.rows || 0) * (s.seats_per_row || 0)),
        0
      )
      updated[ttIdx].capacity = total > 0 ? String(total) : updated[ttIdx].capacity
      return { ...f, ticket_types: updated }
    })

  const submitTickets = async (e) => {
    e.preventDefault()
    if (!ticketMatch) return
    setSubmitting(true)
    try {
      const payload = {
        competition_match_id: ticketMatch.id,
        ticket_types: ticketForm.ticket_types
          .filter(tt => tt.name.trim() !== '' && tt.price !== '')
          .map(tt => {
            const cleanSections = (tt.sections || [])
              .filter(s => (s.name || '').trim() !== '')
              .map(s => ({
                name: s.name.trim(),
                side: (s.side || '').trim() || null,
                deck: (s.deck || '').trim() || null,
                rows: parseInt(s.rows) || 0,
                seats_per_row: parseInt(s.seats_per_row) || 0,
              }))
            const derived = cleanSections.reduce(
              (sum, s) => sum + s.rows * s.seats_per_row, 0
            )
            const finalCapacity = derived > 0 ? derived : parseInt(tt.capacity) || 0
            return {
              id: tt.id,
              name: tt.name.trim(),
              price: parseFloat(tt.price),
              capacity: finalCapacity,
              sections: cleanSections,
            }
          })
          .filter(tt => tt.capacity > 0),
      }
      await api.post('/api/ticketing/admin/matches', payload)
      toast.success('Tickets saved')
      setShowTicketModal(false)
      setTicketMatch(null)
      fetchMatches()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save tickets')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMatches = matches.filter(m => {
    if (filter === 'upcoming' && m.is_past) return false
    if (filter === 'past' && !m.is_past) return false
    if (filter === 'ticketed' && !m.is_ticketed) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        (m.home_team_name || m.home_team || '').toLowerCase().includes(q) ||
        (m.away_team_name || m.away_team || '').toLowerCase().includes(q) ||
        (m.competition_name || '').toLowerCase().includes(q) ||
        (m.season_name || '').toLowerCase().includes(q) ||
        (m.venue || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const columns = [
    {
      key: 'competition', header: 'Competition',
      render: (m) => (
        <div>
          <p className="font-medium text-gray-800">{m.competition_name || '—'}</p>
          <p className="text-xs text-gray-500">
            {m.season_name || '—'}
            {m.stage_name ? ` • ${m.stage_name}` : ''}
            {m.group_name ? ` • ${m.group_name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'match', header: 'Match',
      render: (m) => (
        <div>
          <p className="font-medium text-gray-800">
            {m.home_team_name || m.home_team} <span className="text-gray-400">vs</span> {m.away_team_name || m.away_team}
          </p>
          <p className="text-xs text-gray-500">📍 {m.venue || 'Venue TBA'}</p>
        </div>
      ),
    },
    { key: 'date', header: 'Date', accessor: (m) => m.match_date ? new Date(m.match_date).toLocaleString() : '—' },
    {
      key: 'status', header: 'Status',
      render: (m) => {
        if (m.is_past) return <Badge variant="secondary">Past</Badge>
        if (m.status === 'finished') return <Badge variant="success">Finished</Badge>
        if (m.status === 'live') return <Badge variant="danger">Live</Badge>
        return <Badge variant="info">Scheduled</Badge>
      },
    },
    {
      key: 'ticketed', header: 'Ticketing',
      render: (m) => m.is_ticketed
        ? <Badge variant="success">Ticketed</Badge>
        : <Badge variant="secondary">Not ticketed</Badge>,
    },
  ]

  const actions = (m) => {
    const canSetTickets = m.is_ticketed && !m.is_past
    return (
      <div className="flex justify-end gap-2">
        {canSetTickets ? (
          <button onClick={() => openTicketModal(m)} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition">🎟️ Set Tickets</button>
        ) : (
          <button disabled className="px-3 py-1 text-sm bg-gray-200 text-gray-500 rounded cursor-not-allowed" title={m.is_past ? 'Past matches are read-only' : 'Mark as ticketed first'}>🎟️ Set Tickets</button>
        )}
        <button onClick={() => { setViewMatch(m); setShowViewModal(true) }} className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition">👁️ View</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">All Matches</h1>
          <p className="text-gray-500">
            Set ticket types and their stadium sections. Capacity is derived from each type's sections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-64" />
          <Select value={filter} onChange={e => setFilter(e.target.value)} options={[
            { value: 'all', label: 'All matches' },
            { value: 'upcoming', label: 'Upcoming only' },
            { value: 'past', label: 'Past only' },
            { value: 'ticketed', label: 'Ticketed only' },
          ]} />
          <Button variant="outline" onClick={fetchMatches}>🔄 Refresh</Button>
        </div>
      </div>

      <Modal
        isOpen={showTicketModal}
        onClose={() => { setShowTicketModal(false); setTicketMatch(null) }}
        title={ticketMatch ? `Set Tickets — ${ticketMatch.home_team_name || ticketMatch.home_team} vs ${ticketMatch.away_team_name || ticketMatch.away_team}` : 'Set Tickets'}
        size="lg"
      >
        {ticketMatch && (
          <form onSubmit={submitTickets} className="space-y-5">
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Competition:</span> {ticketMatch.competition_name || '—'} {ticketMatch.season_name ? `(${ticketMatch.season_name})` : ''}</p>
              <p><span className="font-medium">Date:</span> {ticketMatch.match_date ? new Date(ticketMatch.match_date).toLocaleString() : '—'}</p>
              <p><span className="font-medium">Venue:</span> {ticketMatch.venue || '—'}</p>
            </div>

            <div className="space-y-5">
              {ticketForm.ticket_types.map((tt, ttIdx) => {
                const derived = (tt.sections || []).reduce(
                  (sum, s) => sum + ((parseInt(s.rows) || 0) * (parseInt(s.seats_per_row) || 0)),
                  0
                )
                const hasSections = (tt.sections || []).length > 0
                return (
                  <div key={ttIdx} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-gray-800">Ticket Type #{ttIdx + 1}</p>
                      {ticketForm.ticket_types.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTicketType(ttIdx)}
                          className="text-red-500 hover:bg-red-50 rounded p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <Input placeholder="Name (e.g., Grand Stand)" value={tt.name} onChange={e => updateTicketType(ttIdx, 'name', e.target.value)} required />
                      <Input type="number" placeholder="Price (ZMW)" value={tt.price} onChange={e => updateTicketType(ttIdx, 'price', e.target.value)} min="0" step="0.01" required />
                      {hasSections ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">
                          <span className="text-gray-600">Capacity:</span>
                          <span className="font-bold text-green-700">{derived}</span>
                          <span className="text-xs text-gray-500">(from sections)</span>
                        </div>
                      ) : (
                        <Input type="number" placeholder="Capacity" value={tt.capacity} onChange={e => updateTicketType(ttIdx, 'capacity', e.target.value)} min="1" required />
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">Sections</p>
                        <button
                          type="button"
                          onClick={() => addSection(ttIdx)}
                          className="text-xs text-green-600 hover:underline"
                        >
                          + Add Section
                        </button>
                      </div>

                      {(tt.sections || []).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">
                          No sections — buyers purchase this type by quantity only.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(tt.sections || []).map((s, sIdx) => (
                            <div key={sIdx} className="grid grid-cols-12 gap-2 items-start p-2 bg-gray-50 rounded">
                              <div className="col-span-3">
                                <input
                                  type="text"
                                  placeholder="Section (e.g. A)"
                                  value={s.name}
                                  onChange={e => updateSection(ttIdx, sIdx, 'name', e.target.value)}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                />
                              </div>

                              <div className="col-span-2">
                                <select
                                  value={s.side || ''}
                                  onChange={e => updateSection(ttIdx, sIdx, 'side', e.target.value)}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                  title="Which stand does this section sit in?"
                                >
                                  <option value="">Auto</option>
                                  <option value="north">North</option>
                                  <option value="east">East</option>
                                  <option value="south">South</option>
                                  <option value="west">West</option>
                                </select>
                              </div>

                              {/* Deck dropdown: Normal or 1..10 */}
                              <div className="col-span-2">
                                <select
                                  value={s.deck || ''}
                                  onChange={e => updateSection(ttIdx, sIdx, 'deck', e.target.value)}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                  title="Deck tier"
                                >
                                  <option value="">Normal (no deck)</option>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                    <option key={n} value={String(n)}>Deck {n}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="col-span-1">
                                <input
                                  type="number" min="0"
                                  placeholder="Rows"
                                  value={s.rows}
                                  onChange={e => updateSection(ttIdx, sIdx, 'rows', parseInt(e.target.value) || 0)}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                />
                              </div>

                              <div className="col-span-1">
                                <input
                                  type="number" min="0"
                                  placeholder="Seats/row"
                                  value={s.seats_per_row}
                                  onChange={e => updateSection(ttIdx, sIdx, 'seats_per_row', parseInt(e.target.value) || 0)}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                />
                              </div>

                              <div className="col-span-2 text-xs text-gray-600 self-center">
                                {s.rows > 0 && s.seats_per_row > 0
                                  ? `${s.rows * s.seats_per_row} seats`
                                  : s.rows > 0
                                    ? `${s.rows} rows`
                                    : 'section only'}
                              </div>

                              <div className="col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeSection(ttIdx, sIdx)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="button" onClick={addTicketType} className="text-sm text-green-600 hover:underline">
              + Add Ticket Type
            </button>

            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => { setShowTicketModal(false); setTicketMatch(null) }}>Cancel</Button>
              <Button type="submit" loading={submitting}>Save Tickets</Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setViewMatch(null) }} title="Match Details">
        {viewMatch && (
          <div className="space-y-3 text-sm">
            <p><span className="font-medium">Competition:</span> {viewMatch.competition_name || '—'}</p>
            <p><span className="font-medium">Teams:</span> {viewMatch.home_team_name || viewMatch.home_team} vs {viewMatch.away_team_name || viewMatch.away_team}</p>
            <p><span className="font-medium">Venue:</span> {viewMatch.venue || '—'}</p>
            <p><span className="font-medium">Date:</span> {viewMatch.match_date ? new Date(viewMatch.match_date).toLocaleString() : '—'}</p>
            <p><span className="font-medium">Ticketed:</span> {viewMatch.is_ticketed ? 'Yes' : 'No'}</p>
            <ModalFooter>
              <Button variant="outline" onClick={() => { setShowViewModal(false); setViewMatch(null) }}>Close</Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      <DataTable
        columns={columns}
        data={filteredMatches}
        loading={loading}
        title="All Matches"
        actions={actions}
        exportable
        pageSizeOptions={[10, 20, 50, 100]}
        defaultPageSize={20}
        emptyState={{ icon: '⚽', title: 'No matches found', description: 'Create matches in Competition Management.' }}
      />
    </div>
  )
}

// -------------------- ClubsManager --------------------
function ClubsManager() {
  const { api } = useAuth()
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingClub, setEditingClub] = useState(null)
  const [showToggleConfirm, setShowToggleConfirm] = useState(null)
  const [formData, setFormData] = useState({ name: '', short_name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchClubs() }, [])

  const fetchClubs = async () => {
    try {
      const res = await api.get('/api/ticketing/clubs?active_only=false')
      setClubs(res.data || [])
    } catch (error) {
      toast.error('Failed to load clubs')
      setClubs([])
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', short_name: '', description: '' })
    setEditingClub(null)
  }

  const handleEdit = (club) => {
    setEditingClub(club)
    setFormData({ name: club.name, short_name: club.short_name || '', description: club.description || '' })
    setShowForm(true)
  }

  const handleToggle = async () => {
    if (!showToggleConfirm) return
    try {
      await api.put(`/api/ticketing/admin/clubs/${showToggleConfirm.id}`, { is_active: !showToggleConfirm.is_active })
      toast.success(`Club ${showToggleConfirm.is_active ? 'deactivated' : 'activated'}`)
      fetchClubs()
    } catch (error) {
      toast.error('Failed to update club')
    } finally {
      setShowToggleConfirm(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingClub) {
        await api.put(`/api/ticketing/admin/clubs/${editingClub.id}`, formData)
        toast.success('Club updated')
      } else {
        await api.post('/api/ticketing/admin/clubs', formData)
        toast.success('Club created')
      }
      setShowForm(false)
      resetForm()
      fetchClubs()
    } catch (error) {
      toast.error('Failed to save club')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Club Name', accessor: (c) => c.name },
    { key: 'short_name', header: 'Short Name', accessor: (c) => c.short_name || '-' },
    { key: 'status', header: 'Status', render: (c) => <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
  ]

  const actions = (club) => (
    <div className="flex justify-end gap-2">
      <button onClick={() => setShowToggleConfirm(club)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title={club.is_active ? 'Deactivate' : 'Activate'}>
        {club.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
      </button>
      <button onClick={() => handleEdit(club)} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="Edit">
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Manage Clubs</h1>
          <p className="text-gray-500">Add and manage football clubs</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          variant="primary"
        >
          + New Club
        </Button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          resetForm()
        }}
        title={editingClub ? 'Edit Club' : 'Add New Club'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Club Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          <Input label="Short Name" value={formData.short_name} onChange={e => setFormData({ ...formData, short_name: e.target.value })} />
          <Input label="Description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>{editingClub ? 'Update' : 'Create'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal isOpen={!!showToggleConfirm} onClose={() => setShowToggleConfirm(null)} title="Confirm Status Change">
        <p>Are you sure you want to {showToggleConfirm?.is_active ? 'deactivate' : 'activate'} <strong>{showToggleConfirm?.name}</strong>?</p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowToggleConfirm(null)}>Cancel</Button>
          <Button variant={showToggleConfirm?.is_active ? 'danger' : 'primary'} onClick={handleToggle}>{showToggleConfirm?.is_active ? 'Deactivate' : 'Activate'}</Button>
        </ModalFooter>
      </Modal>

      <DataTable
        columns={columns}
        data={clubs}
        loading={loading}
        title="Clubs"
        actions={actions}
        searchable
        exportable
        pageSizeOptions={[5, 10, 20]}
        defaultPageSize={5}
        emptyState={{ icon: '🏢', title: 'No clubs found', description: 'Add your first club to get started.' }}
      />
    </div>
  )
}

function UsersManager() {
  const { api } = useAuth()
  const [users, setUsers] = useState([])
  const [clubs, setClubs] = useState([])
  const [availableRoles, setAvailableRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [rolesLoading, setRolesLoading] = useState(true)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(null)
  const [editingUser, setEditingUser] = useState(null)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    roles: [],
    club_id: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchClubs()
    fetchRoles()
  }, [])

  /* ---------- Fetchers ---------- */
  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/ticketing/admin/users')
      setUsers(res.data || [])
    } catch (error) {
      toast.error('Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const fetchClubs = async () => {
    try {
      const res = await api.get('/api/ticketing/clubs?active_only=true')
      setClubs(res.data || [])
    } catch (error) {
      console.error('Failed to load clubs')
      setClubs([])
    }
  }

  const fetchRoles = async () => {
    setRolesLoading(true)
    try {
      const res = await api.get('/api/ticketing/admin/roles')
      setAvailableRoles(res.data || [])
    } catch (error) {
      console.error('Failed to load roles', error)
      setAvailableRoles([])
      toast.error('Failed to load roles')
    } finally {
      setRolesLoading(false)
    }
  }

  /* ---------- CRUD ---------- */
  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (formData.roles.length === 0) {
      toast.error('Select at least one role')
      return
    }
    setSubmitting(true)
    try {
      const payload = { ...formData }
      if (!payload.club_id) delete payload.club_id
      await api.post('/api/ticketing/admin/users', payload)
      toast.success('User created')
      setShowCreateModal(false)
      resetForm()
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    if (formData.roles.length === 0) {
      toast.error('Select at least one role')
      return
    }
    setSubmitting(true)
    try {
      const payload = { ...formData }
      delete payload.password
      if (!payload.club_id) payload.club_id = null
      await api.put(`/api/ticketing/admin/users/${editingUser.id}`, payload)
      toast.success('User updated')
      setShowEditModal(false)
      resetForm()
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisableUser = async () => {
    if (!showDisableConfirm) return
    try {
      await api.put(`/api/ticketing/admin/users/${showDisableConfirm.id}`, {
        is_active: !showDisableConfirm.is_active,
      })
      toast.success(`User ${showDisableConfirm.is_active ? 'disabled' : 'enabled'}`)
      fetchUsers()
    } catch (error) {
      toast.error('Failed to update user')
    } finally {
      setShowDisableConfirm(null)
    }
  }

  /* ---------- Form helpers ---------- */
  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      roles: [],
      club_id: '',
    })
    setEditingUser(null)
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      roles: user.roles || [],
      club_id: user.club_id || '',
    })
    setShowEditModal(true)
  }

  const toggleRole = (roleName) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleName)
        ? prev.roles.filter((r) => r !== roleName)
        : [...prev.roles, roleName],
    }))
  }

  /* ---------- Derived ---------- */
  const roleOptions = availableRoles.map((r) => ({
    value: r.name,
    label: r.name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    description: r.description || '',
  }))

  const needsClubAssignment =
    formData.roles.includes('club_admin') || formData.roles.includes('club_officer')

  const clubNameFor = (clubId) => {
    if (!clubId) return '-'
    const club = clubs.find((c) => c.id === clubId)
    return club?.name || `#${clubId}`
  }

  /* ---------- Table ---------- */
  const columns = [
    {
      key: 'name',
      header: 'Name',
      accessor: (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || '-',
    },
    { key: 'email', header: 'Email', accessor: (u) => u.email },
    {
      key: 'roles',
      header: 'Roles',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {(u.roles?.length ? u.roles : [u.role].filter(Boolean)).map((r) => (
            <Badge key={r} variant="info" size="sm">
              {String(r).replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'club',
      header: 'Club',
      accessor: (u) => clubNameFor(u.club_id),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <Badge variant={u.is_active ? 'success' : 'danger'}>
          {u.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  const actions = (user) => (
    <div className="flex justify-end gap-2">
      <button
        onClick={() => openEditModal(user)}
        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
        title="Edit"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        onClick={() => setShowDisableConfirm(user)}
        className="p-1 text-red-600 hover:bg-red-50 rounded"
        title={user.is_active ? 'Disable' : 'Enable'}
      >
        {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
      </button>
    </div>
  )

  /* ---------- Roles picker (shared by both modals) ---------- */
  const RolesPicker = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Roles <span className="text-gray-400 font-normal">(select one or more)</span>
      </label>

      {rolesLoading ? (
        <p className="text-xs text-gray-400 italic">Loading roles…</p>
      ) : roleOptions.length === 0 ? (
        <p className="text-xs text-amber-600">
          No roles found. Restart the backend to seed default roles.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {roleOptions.map((role) => {
            const selected = formData.roles.includes(role.value)
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => toggleRole(role.value)}
                title={role.description}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  selected
                    ? 'bg-green-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Manage Users</h1>
          <p className="text-gray-500">View and manage system users</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} variant="primary">
          + New User
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        title="Users"
        actions={actions}
        searchable
        exportable
        pageSizeOptions={[5, 10, 20]}
        defaultPageSize={10}
        emptyState={{
          icon: '👥',
          title: 'No users found',
          description: 'Create your first user account.',
        }}
      />

      {/* ---------- Create ---------- */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          resetForm()
        }}
        title="Create New User"
        size="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            minLength={6}
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <RolesPicker />

          {needsClubAssignment && (
            <Select
              label="Assign to Club"
              value={formData.club_id}
              onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
              options={[
                { value: '', label: 'Select a club...' },
                ...clubs.map((c) => ({ value: c.id, label: c.name })),
              ]}
              required
            />
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create User
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---------- Edit ---------- */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          resetForm()
        }}
        title="Edit User"
        size="lg"
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="New Password (leave blank to keep current)"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            minLength={6}
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <RolesPicker />

          {needsClubAssignment && (
            <Select
              label="Assign to Club"
              value={formData.club_id}
              onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
              options={[
                { value: '', label: 'Select a club...' },
                ...clubs.map((c) => ({ value: c.id, label: c.name })),
              ]}
              required
            />
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowEditModal(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Update User
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---------- Disable / Enable confirm ---------- */}
      <Modal
        isOpen={!!showDisableConfirm}
        onClose={() => setShowDisableConfirm(null)}
        title="Confirm"
      >
        <p>
          Are you sure you want to{' '}
          {showDisableConfirm?.is_active ? 'disable' : 'enable'}{' '}
          <strong>{showDisableConfirm?.email}</strong>?
        </p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDisableConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant={showDisableConfirm?.is_active ? 'danger' : 'primary'}
            onClick={handleDisableUser}
          >
            {showDisableConfirm?.is_active ? 'Disable' : 'Enable'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

// -------------------- OrdersManager --------------------
function OrdersManager() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => { fetchOrders() }, [])

  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/ticketing/admin/orders')
      setOrders(res.data || [])
    } catch (error) {
      toast.error('Failed to load orders')
      setOrders([])
    } finally { setLoading(false) }
  }

  const viewOrderDetails = async (orderId) => {
    try {
      const res = await api.get(`/api/ticketing/admin/orders/${orderId}`)
      setSelectedOrder(res.data)
      setShowDetailModal(true)
    } catch (error) { toast.error('Failed to load order details') }
  }

  const columns = [
    { key: 'order_number', header: 'Order #', accessor: (o) => o.order_number?.slice(0, 8) + '...' },
    { key: 'customer', header: 'Customer', render: (o) => <div><p className="font-medium">{o.customer_name}</p><p className="text-xs text-gray-500">{o.customer_email}</p></div> },
    { key: 'total', header: 'Total', accessor: (o) => `ZMW ${parseFloat(o.total_amount).toFixed(2)}` },
    { key: 'status', header: 'Status', render: (o) => <Badge variant={o.payment_status === 'paid' ? 'success' : 'warning'}>{o.payment_status}</Badge> },
    { key: 'date', header: 'Date', accessor: (o) => new Date(o.created_at).toLocaleDateString() },
  ]

  const actions = (order) => (
    <div className="flex justify-end">
      <button onClick={() => viewOrderDetails(order.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800 mb-1">Manage Orders</h1><p className="text-gray-500">View and manage all ticket orders</p></div>
      <DataTable columns={columns} data={orders} loading={loading} title="Orders" actions={actions} searchable exportable pageSizeOptions={[5, 10, 20]} defaultPageSize={10} emptyState={{ icon: '📦', title: 'No orders yet', description: 'Orders will appear here once customers start purchasing tickets.' }} />

      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedOrder(null) }} title={`Order #${selectedOrder?.order_number?.slice(0, 8)}`} size="lg">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div><p className="text-sm text-gray-500">Customer</p><p className="font-medium">{selectedOrder.customer_name}</p><p className="text-sm">{selectedOrder.customer_email}</p><p className="text-sm">{selectedOrder.customer_phone || '—'}</p></div>
              <div><p className="text-sm text-gray-500">Order Info</p><p className="font-medium">Total: ZMW {parseFloat(selectedOrder.total_amount).toFixed(2)}</p><p className="text-sm">Status: <Badge variant={selectedOrder.payment_status === 'paid' ? 'success' : 'warning'}>{selectedOrder.payment_status}</Badge></p><p className="text-sm">Date: {new Date(selectedOrder.created_at).toLocaleString()}</p></div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Items</h4>
              <table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-2">Match</th><th className="text-left">Type</th><th className="text-left">Qty</th><th className="text-left">Price</th><th className="text-left">Subtotal</th></tr></thead>
                <tbody>{selectedOrder.items?.map((item, idx) => (<tr key={idx} className="border-b"><td className="py-2">{item.match_name || 'N/A'}</td><td>{item.ticket_type}</td><td>{item.quantity}</td><td>ZMW {parseFloat(item.unit_price).toFixed(2)}</td><td>ZMW {(item.quantity * item.unit_price).toFixed(2)}</td></tr>))}</tbody>
              </table>
            </div>
            {selectedOrder.items?.[0]?.tickets?.length > 0 && (
              <div><h4 className="font-semibold mb-2">Tickets</h4><div className="max-h-64 overflow-y-auto space-y-2">{selectedOrder.items.flatMap(item => item.tickets || []).map(ticket => (<div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-mono text-sm">{ticket.ticket_number}</p><p className="text-xs text-gray-500">{ticket.ticket_type}</p></div><Badge variant={ticket.is_used ? 'danger' : 'success'}>{ticket.is_used ? 'Used' : 'Valid'}</Badge></div>))}</div></div>
            )}
            <ModalFooter><Button variant="outline" onClick={() => { setShowDetailModal(false); setSelectedOrder(null) }}>Close</Button></ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  )
}

// -------------------- ReportsManager --------------------
function ReportsManager() {
  const { api } = useAuth()
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, totalTickets: 0, matchesSold: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReportData() }, [])

  const fetchReportData = async () => {
    try {
      const [ordersRes] = await Promise.all([
        api.get('/api/ticketing/admin/orders').catch(() => ({ data: [] }))
      ])
      const orders = ordersRes.data || []
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0)
      const totalTickets = orders.flatMap(o => o.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)
      const matchSales = {}
      orders.forEach(order => {
        order.items?.forEach(item => {
          const matchId = item.match_id
          if (!matchSales[matchId]) matchSales[matchId] = { matchName: item.match_name, tickets: 0, revenue: 0 }
          matchSales[matchId].tickets += item.quantity
          matchSales[matchId].revenue += item.quantity * item.unit_price
        })
      })
      const matchesSold = Object.entries(matchSales).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
      setStats({ totalRevenue, totalOrders: orders.length, totalTickets, matchesSold })
    } catch (error) {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" /></div>

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800 mb-1">Reports & Analytics</h1><p className="text-gray-500">Sales and performance overview</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Revenue" value={`ZMW ${stats.totalRevenue.toFixed(2)}`} icon="💰" color="green" />
        <StatCard title="Total Orders" value={stats.totalOrders} icon="📦" color="blue" />
        <StatCard title="Tickets Sold" value={stats.totalTickets} icon="🎫" color="orange" />
      </div>
      <Card padding="lg"><h3 className="font-bold text-gray-800 mb-4">Top Selling Matches</h3>
        {stats.matchesSold.length > 0 ? (
          <table className="w-full"><thead><tr className="border-b"><th className="text-left py-2">Match</th><th className="text-left">Tickets</th><th className="text-left">Revenue</th></tr></thead>
            <tbody>{stats.matchesSold.map(m => (<tr key={m.id} className="border-b"><td className="py-2">{m.matchName}</td><td>{m.tickets}</td><td>ZMW {m.revenue.toFixed(2)}</td></tr>))}</tbody>
          </table>
        ) : <EmptyState icon="📊" title="No sales data yet" description="Sales will appear here once tickets are purchased." />}
      </Card>
      <Card padding="lg"><h3 className="font-bold text-gray-800 mb-4">Quick Insights</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-xl"><p className="text-sm text-gray-500">Average Order Value</p><p className="text-2xl font-bold">ZMW {stats.totalOrders ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : '0.00'}</p></div>
          <div className="p-4 bg-blue-50 rounded-xl"><p className="text-sm text-gray-500">Tickets per Order</p><p className="text-2xl font-bold">{stats.totalOrders ? (stats.totalTickets / stats.totalOrders).toFixed(1) : '0'}</p></div>
        </div>
      </Card>
    </div>
  )
}