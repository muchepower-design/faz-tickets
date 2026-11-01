import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { matchTeamLabels } from '../utils/teams'

function safeDate(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export default function HomePage() {
  const { api } = useAuth()
  const [nationalMatches, setNationalMatches] = useState([])
  const [clubMatches, setClubMatches] = useState([])
  const [stats, setStats] = useState({ matches: '—', clubs: '—', tickets: '50K+' })
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [nat, club, clubsRes] = await Promise.all([
        api.get('/api/ticketing/matches?type=national&active_only=true').catch(() => ({ data: [] })),
        api.get('/api/ticketing/matches?type=club&active_only=true').catch(() => ({ data: [] })),
        api.get('/api/ticketing/clubs?active_only=true').catch(() => ({ data: [] })),
      ])
      const n = nat.data || []
      const c = club.data || []
      setNationalMatches(n.slice(0, 3))
      setClubMatches(c.slice(0, 3))
      setStats({
        matches: n.length + c.length,
        clubs: (clubsRes.data || []).length,
        tickets: '50K+',
      })
    } catch (err) {
      console.error('HomePage fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <MainLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-700 via-green-600 to-orange-600">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-400 rounded-full blur-3xl"></div>
          </div>
        </div>

        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                <span className="text-orange-300">⚽</span>
                <span className="text-sm font-medium">Official FAZ Ticketing System</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                Secure Your Seat for{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-yellow-300">
                  Chipolopolo
                </span>
              </h1>
              <p className="text-xl text-green-100 mb-8 leading-relaxed">
                Experience the thrill of Zambian football. Book tickets for national team matches and club games instantly.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/matches" className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition transform hover:-translate-y-1">
                  Browse Matches →
                </Link>
                <Link to="/register" className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border border-white/30 hover:bg-white/20 transition">
                  Create Account
                </Link>
              </div>
            </div>

            <div className="hidden md:block relative">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
                <div className="grid grid-cols-3 gap-4 text-center text-white">
                  <StatCard value={stats.matches} label="Ticketed Matches" />
                  <StatCard value={stats.clubs} label="Active Clubs" />
                  <StatCard value={stats.tickets} label="Tickets Sold" />
                </div>
                <div className="mt-8 p-4 bg-white/10 rounded-2xl">
                  <p className="text-white/80 text-sm mb-2">Next National Team Match</p>
                  {nationalMatches[0] ? (
                    <div>
                      <p className="text-white font-bold text-lg">
                        {nationalMatches[0].home_team} vs {nationalMatches[0].away_team}
                      </p>
                      <p className="text-white/70 text-sm">
                        {nationalMatches[0].venue} • {safeDate(nationalMatches[0].match_date)?.toLocaleDateString() || 'TBA'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-white/60 text-sm">No upcoming national matches.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative h-16">
          <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 74" fill="none" preserveAspectRatio="none">
            <path d="M0 74L60 61.7C120 49.3 240 24.7 360 18.5C480 12.3 600 24.7 720 30.8C840 37 960 37 1080 30.8C1200 24.7 1320 12.3 1380 6.2L1440 0V74H1380C1320 74 1200 74 1080 74C960 74 840 74 720 74C600 74 480 74 360 74C240 74 120 74 60 74H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Why Choose <span className="text-green-600">FAZ Tickets</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              The safest and easiest way to secure your spot at Zambia's biggest football matches
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard icon="🎟️" title="Instant Tickets" description="Get your tickets immediately via email with secure QR codes for easy entry." color="green" />
            <FeatureCard icon="🔒" title="Secure Payments" description="Your transactions are protected with industry-leading security standards." color="orange" />
            <FeatureCard icon="📱" title="Mobile Ready" description="Access your tickets anywhere, anytime on any device. No printing needed." color="red" />
          </div>
        </div>
      </section>

      {/* National */}
      <section className="py-16 bg-gradient-to-br from-green-50 to-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full mb-3">
                <span className="text-green-600">🇿🇲</span>
                <span className="text-sm font-medium text-green-700">Chipolopolo</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">National Team Matches</h2>
            </div>
            <Link to="/matches?type=national" className="text-green-600 font-medium hover:underline">View All →</Link>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading…</div>
          ) : nationalMatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No upcoming national team matches.</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {nationalMatches.map(m => <HomeMatchCard key={m.id} match={m} type="national" />)}
            </div>
          )}
        </div>
      </section>

      {/* Club */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full mb-3">
                <span className="text-orange-600">🏆</span>
                <span className="text-sm font-medium text-orange-700">Zambian Premier League</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">Club Football</h2>
            </div>
            <Link to="/matches?type=club" className="text-orange-600 font-medium hover:underline">View All →</Link>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading…</div>
          ) : clubMatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No upcoming club matches.</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {clubMatches.map(m => <HomeMatchCard key={m.id} match={m} type="club" />)}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-green-700 to-green-800">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Experience the Action?</h2>
          <p className="text-green-100 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of fans and secure your tickets for the biggest matches in Zambian football.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/matches" className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition transform hover:-translate-y-1">Find Matches</Link>
            <Link to="/register" className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border border-white/30 hover:bg-white/20 transition">Sign Up Free</Link>
          </div>
        </div>
      </section>
    </MainLayout>
  )
}

function StatCard({ value, label }) {
  return (
    <div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-white/70">{label}</div>
    </div>
  )
}

function FeatureCard({ icon, title, description, color }) {
  const colorClasses = { green: 'from-green-500 to-green-600', orange: 'from-orange-500 to-orange-600', red: 'from-red-500 to-red-600' }
  return (
    <div className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:-translate-y-2">
      <div className={`w-16 h-16 bg-gradient-to-br ${colorClasses[color]} rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-lg group-hover:scale-110 transition`}>{icon}</div>
      <h3 className="text-xl font-bold text-gray-800 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}

function HomeMatchCard({ match, type }) {
  const gradient = type === 'national' ? 'from-green-600 to-green-700' : 'from-orange-500 to-orange-600'
  const lowestPrice = match.ticket_types?.length > 0 ? Math.min(...match.ticket_types.map(tt => tt.price)) : null
  const dt = safeDate(match.match_date)
  const { home, away } = matchTeamLabels(match)

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
      <div className={`bg-gradient-to-r ${gradient} p-6 text-white`}>
        <div className="flex justify-between items-start mb-4">
          <div className="text-sm font-medium opacity-90">
            {type === 'national' ? '🇿🇲 National Team' : '🏆 Club Match'}
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-xs">
            {dt ? dt.toLocaleDateString() : 'TBA'}
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2">{home} vs {away}</h3>
        <p className="text-white/80 text-sm flex items-center gap-1"><span>📍</span> {match.venue || 'Venue TBA'}</p>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">Starting from</p>
            <p className="text-2xl font-bold text-gray-800">
              {lowestPrice != null ? `ZMW ${lowestPrice.toFixed(2)}` : 'TBA'}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            ⏰ {dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </div>
        </div>
        <Link
          to={`/matches/${match.id}`}
          className={`block w-full text-center py-3 rounded-xl font-medium transition ${
            type === 'national' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          Get Tickets →
        </Link>
      </div>
    </div>
  )
}