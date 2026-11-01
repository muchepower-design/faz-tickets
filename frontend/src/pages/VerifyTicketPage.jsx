import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function VerifyTicketPage() {
  const { api } = useAuth()
  const [ticketNumber, setTicketNumber] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!ticketNumber.trim()) return

    setVerifying(true)
    setResult(null)
    try {
      const response = await api.post('/api/ticketing/tickets/verify', { ticket_number: ticketNumber })
      setResult({ success: true, data: response.data })
      toast.success('Ticket verified successfully!')
    } catch (error) {
      setResult({ success: false, message: error.response?.data?.message || 'Verification failed' })
      toast.error(error.response?.data?.message || 'Invalid ticket')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Verify Ticket</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleVerify} className="flex gap-4 mb-6">
          <input
            type="text"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            placeholder="Enter ticket number or scan QR code"
            className="flex-1 border rounded px-4 py-2 text-lg"
            autoFocus
          />
          <button
            type="submit"
            disabled={verifying || !ticketNumber.trim()}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        {result && (
          <div className={`border rounded-lg p-4 ${result.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            {result.success ? (
              <div>
                <h3 className="text-xl font-bold text-green-700 mb-2">✅ Valid Ticket</h3>
                <p><span className="font-medium">Match:</span> {result.data.match.home_team} vs {result.data.match.away_team}</p>
                <p><span className="font-medium">Ticket Type:</span> {result.data.ticket.ticket_type}</p>
                <p><span className="font-medium">Status:</span> {result.data.ticket.is_used ? 'Already Used' : 'Valid'}</p>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-bold text-red-700 mb-2">❌ Invalid Ticket</h3>
                <p>{result.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}