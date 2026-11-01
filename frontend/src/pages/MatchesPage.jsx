import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { Button, Card, Badge, Select, Spinner, EmptyState } from '../components/ui'
import { matchTeamLabels } from '../utils/teams'

function safeDate(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export default function MatchesPage() {
  const { api } = useAuth()
  const [searchParams] = useSearchParams()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(searchParams.get('type') || 'all')
  const [clubs, setClubs] = useState([])
  const [selectedClub, setSelectedClub] = useState('')

  useEffect(() => {
    api.get('/api/ticketing/clubs?active_only=true')
      .then(r => setClubs(r.data || []))
      .catch(() => setClubs([]))
  }, [api])

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ active_only: 'true' })
      if (filter === 'national' || filter === 'club') params.set('type', filter)
      if (selectedClub) params.set('club_id', selectedClub)

      const res = await api.get(`/api/ticketing/matches?${params.toString()}`)
      const list = res.data || []
      list.sort((a, b) => {
        const da = safeDate(a.match_date)?.getTime() || Infinity
        const db = safeDate(b.match_date)?.getTime() || Infinity
        return da - db
      })
      setMatches(list)
    } catch (err) {
      console.error('MatchesPage fetch error:', err)
      setMatches([])
    } finally {
      setLoading(false)
    }
  }, [api, filter, selectedClub])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  useEffect(() => {
    const interval = setInterval(fetchMatches, 30000)
    return () => clearInterval(interval)
  }, [fetchMatches])

  const filterOptions = [
    { value: 'all', label: '🎯 All Matches' },
    { value: 'national', label: '🇿🇲 National Team' },
    { value: 'club', label: '🏆 Club Matches' },
  ]

  const clubOptions = [
    { value: '', label: 'All Clubs' },
    ...clubs.map(c => ({ value: c.id, label: c.name })),
  ]

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Football Matches</h1>
          <p className="text-gray-600">Find and book tickets for upcoming matches</p>
        </div>

        <Card padding="md" className="mb-8">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full md:w-64">
              <Select label="Match Type" value={filter} onChange={e => setFilter(e.target.value)} options={filterOptions} />
            </div>
            {filter === 'club' && clubs.length > 0 && (
              <div className="w-full md:w-64">
                <Select label="Select Club" value={selectedClub} onChange={e => setSelectedClub(e.target.value)} options={clubOptions} />
              </div>
            )}
            <Button variant="outline" onClick={fetchMatches}>🔄 Refresh</Button>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="xl" /></div>
        ) : matches.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No matches found"
            description="There are no upcoming ticketed matches matching your filters."
            actionLabel="Clear Filters"
            onAction={() => { setFilter('all'); setSelectedClub('') }}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map(m => <MatchesPageCard key={m.id} match={m} />)}
          </div>
        )}
      </div>
    </MainLayout>
  )
}

function MatchesPageCard({ match }) {
  const isNational = match.match_type === 'national'
  const lowestPrice = match.ticket_types?.length > 0 ? Math.min(...match.ticket_types.map(tt => tt.price)) : null
  const totalAvailable = match.total_available ?? '—'
  const dt = safeDate(match.match_date)

  // Country-aware labels
  const { home, away } = matchTeamLabels(match)

  return (
    <Card padding="none" hover className="overflow-hidden group">
      <div className={`p-6 text-white ${isNational ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-orange-500 to-orange-600'}`}>
        <div className="flex justify-between items-start mb-4">
          <Badge variant={isNational ? 'success' : 'orange'}>{isNational ? '🇿🇲 National' : '🏆 Club'}</Badge>
          <span className="text-sm opacity-90">{dt ? dt.toLocaleDateString() : 'TBA'}</span>
        </div>
        <h3 className="text-xl font-bold mb-2">{home} vs {away}</h3>
        <p className="text-white/80 text-sm flex items-center gap-1"><span>📍</span> {match.venue || 'Venue TBA'}</p>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">Starting from</p>
            <p className="text-2xl font-bold text-gray-800">{lowestPrice != null ? `ZMW ${lowestPrice.toFixed(2)}` : 'TBA'}</p>
          </div>
          <div className="text-sm text-gray-500">
            ⏰ {dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <span>🎟️ {totalAvailable} available</span>
        </div>
        <Link to={`/matches/${match.id}`}>
          <Button variant={isNational ? 'primary' : 'secondary'} fullWidth icon="→" iconPosition="right">
            View Tickets
          </Button>
        </Link>
      </div>
    </Card>
  )
}