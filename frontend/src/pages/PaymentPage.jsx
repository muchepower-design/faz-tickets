import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { Button, Card, Input, Alert, Spinner } from '../components/ui'
import toast from 'react-hot-toast'

// Import mobile money logos
import airtelLogo from './assets/momo/logos/momo_airtel.png'
import mtnLogo from './assets/momo/logos/momo_mtn.png'
import zamtelLogo from './assets/momo/logos/momo_zamtel.jpg'

const providerLogos = {
  'AIRTEL_OAPI_ZMB': airtelLogo,
  'MTN_MOMO_ZMB': mtnLogo,
  'ZAMTEL_ZMB': zamtelLogo,
}

const providerNames = {
  'AIRTEL_OAPI_ZMB': 'Airtel Money',
  'MTN_MOMO_ZMB': 'MTN Mobile Money',
  'ZAMTEL_ZMB': 'Zamtel Money',
}

const sanitizeErrorMessage = (message) => {
  if (!message) return ''
  let sanitized = message
  for (const [code, name] of Object.entries(providerNames)) {
    sanitized = sanitized.replace(new RegExp(code, 'g'), name)
    const shortCode = code.replace('_ZMB', '').replace('_OAPI_ZMB', '')
    if (shortCode !== code) {
      sanitized = sanitized.replace(new RegExp(shortCode, 'g'), name)
    }
  }
  return sanitized
}

export default function PaymentPage() {
  const { id: orderId } = useParams()
  const { api } = useAuth()
  const navigate = useNavigate()
  const pollingRef = useRef(null)
  const releasedRef = useRef(false)       // guard against double-cancel
  const redirectTimerRef = useRef(null)   // allows clean unmount

  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)
  const [depositId, setDepositId] = useState(null)
  const [pollStatus, setPollStatus] = useState(null)

  const isValidPhone = /^0\d{9}$/.test(phoneNumber)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const [providersResult, orderResult] = await Promise.allSettled([
        api.get('/api/ticketing/payment/providers'),
        api.get(`/api/ticketing/orders/${orderId}`),
      ])

      if (cancelled) return

      if (providersResult.status === 'fulfilled') {
        setProviders(providersResult.value.data || [])
      } else {
        toast.error('Failed to load payment providers')
        setProviders([])
      }

      let orderOk = false
      if (orderResult.status === 'fulfilled') {
        const data = orderResult.value.data
        if (data.payment_status !== 'pending') {
          toast.error('Order is already processed')
          navigate('/checkout')
          return
        }
        setOrder(data)
        orderOk = true
      } else {
        toast.error('Order not found')
        navigate('/checkout')
        return
      }

      if (orderOk) setLoading(false)
    }

    init()

    return () => {
      cancelled = true
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Release the order's seats and return to the matches list.
   * Identical behaviour to clicking the "Cancel Order" button.
   * Idempotent — the same order is never cancelled twice.
   */
  const cancelOrderAndReturn = async (toastMessage = 'Order cancelled, seats released') => {
    // Already cancelled (or currently cancelling) — just get the user back.
    if (releasedRef.current) {
      navigate('/matches')
      return
    }

    releasedRef.current = true
    setCancelling(true)
    try {
      await api.post(`/api/ticketing/orders/${orderId}/cancel`)
      toast.success(toastMessage)
    } catch (err) {
      console.warn('Cancel failed:', err?.response?.data?.error || err.message)
      toast.error('Failed to cancel order')
    } finally {
      setCancelling(false)
      navigate('/matches')
    }
  }

  /** Manual "Cancel Order" button handler */
  const handleCancelOrder = () => cancelOrderAndReturn('Order cancelled, seats released')

  /**
   * Payment failure handler — shows the failure briefly, then runs the
   * same cancel flow so the seats are freed and the user lands on /matches.
   */
  const handlePaymentFailure = (failureMessage) => {
    setPollStatus('FAILED')
    setError(failureMessage || 'Payment failed')
    toast.error('Payment failed')

    // Give the user a beat to read the failure card, then cancel + redirect.
    redirectTimerRef.current = setTimeout(() => {
      cancelOrderAndReturn('Payment failed — seats released')
    }, 2000)
  }

  const handlePhoneChange = (e) => {
    let input = e.target.value.replace(/\D/g, '')
    if (input.length > 10) input = input.slice(0, 10)
    if (input.length > 0 && input[0] !== '0') return
    setPhoneNumber(input)
  }

  const startPolling = (depId) => {
    setDepositId(depId)
    setPollStatus('WAITING')
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/ticketing/payment/deposit/${depId}/check`)
        const data = res.data

        if (data.status === 'COMPLETED') {
          clearInterval(pollingRef.current)
          setPollStatus('COMPLETED')
          toast.success('Payment successful! Redirecting...')
          redirectTimerRef.current = setTimeout(
            () => navigate(`/order/${order.order_number}`),
            2000,
          )
        } else if (data.success === false) {
          clearInterval(pollingRef.current)
          const message = data.failureReason?.failureMessage || 'Payment failed. Please try again.'
          handlePaymentFailure(sanitizeErrorMessage(message))
        }
      } catch (err) {
        clearInterval(pollingRef.current)
        handlePaymentFailure('Failed to check payment status')
      }
    }, 5000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedProvider) {
      setError('Please select a mobile money provider')
      return
    }
    if (!isValidPhone) {
      setError('Please enter a valid 10-digit phone number starting with 0')
      return
    }

    const formattedPhone = '26' + phoneNumber

    setProcessing(true)
    try {
      const payload = {
        order_id: order.id,
        provider: selectedProvider,
        phone_number: formattedPhone,
        amount: order.total_amount,
        customer_email: order.customer_email,
      }
      const res = await api.post('/api/ticketing/payment/deposit', payload)
      const data = res.data

      if (data.success) {
        toast.success('Payment request sent. Please check your phone to approve.')
        startPolling(data.depositId)
      } else {
        // Immediate failure from the deposit call — treat like a poll failure
        const reason = data.failureReason
        let message = 'Payment failed. Please try again.'
        if (reason) {
          const code = reason.failureCode
          const msg = reason.failureMessage
          if (code === 'INVALID_PHONE_NUMBER') message = 'Invalid phone number. Please check and try again.'
          else if (code === 'AMOUNT_OUT_OF_BOUNDS') message = 'Amount is outside allowed limits.'
          else if (code === 'INVALID_AMOUNT') message = 'Invalid amount format.'
          else if (code === 'PROVIDER_TEMPORARILY_UNAVAILABLE') message = 'Provider is temporarily unavailable. Try again later.'
          else if (code === 'INVALID_CURRENCY') message = 'Invalid currency.'
          else if (code === 'INVALID_INPUT') message = 'Invalid request. Please try again.'
          else if (code === 'MISSING_PARAMETER') message = 'Missing payment details.'
          else if (code === 'INVALID_PARAMETER') message = 'Invalid payment parameter.'
          else if (code === 'UNSUPPORTED_PARAMETER') message = 'Unsupported payment parameter.'
          else if (code === 'AUTHENTICATION_ERROR' || code === 'AUTHORISATION_ERROR') message = 'Payment service authentication error. Contact support.'
          else if (code === 'UNKNOWN_ERROR') message = 'Payment service error. Try again later.'
          else message = sanitizeErrorMessage(msg || message)
        }
        handlePaymentFailure(message)
      }
    } catch (err) {
      handlePaymentFailure(err.response?.data?.error || 'Failed to process payment')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <Spinner size="xl" />
          <p className="mt-4 text-gray-500">Loading payment details…</p>
        </div>
      </MainLayout>
    )
  }

  if (!order) return null

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Complete Payment</h1>
          <Button variant="danger" onClick={handleCancelOrder} loading={cancelling}>
            Cancel Order
          </Button>
        </div>

        <Card padding="lg">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Order #{order.order_number?.slice(0,8)}</h2>
            <p className="text-2xl font-bold text-green-600">ZMW {parseFloat(order.total_amount).toFixed(2)}</p>
          </div>

          {pollStatus === 'WAITING' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center mb-4">
              <Spinner size="lg" className="mx-auto mb-3" />
              <h3 className="text-lg font-bold text-blue-800">Waiting for Payment</h3>
              <p className="text-blue-600 mt-1">
                Please check your phone and enter your Mobile Money PIN to approve the payment.
              </p>
            </div>
          )}

          {pollStatus === 'COMPLETED' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-4">
              <span className="text-4xl">✅</span>
              <h3 className="text-lg font-bold text-green-800 mt-2">Payment Complete!</h3>
              <p className="text-green-600">Redirecting to your tickets...</p>
            </div>
          )}

          {pollStatus === 'FAILED' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-4">
              <span className="text-4xl">❌</span>
              <h3 className="text-lg font-bold text-red-800 mt-2">Payment Failed</h3>
              <p className="text-red-600">{error || 'Transaction could not be completed.'}</p>
              <p className="text-xs text-gray-500 mt-2">
                Cancelling your order and releasing seats…
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
                <Spinner size="sm" />
                <span>Redirecting to matches…</span>
              </div>
            </div>
          )}

          {!pollStatus && (
            <>
              {error && <Alert variant="error" dismissible onDismiss={() => setError('')} className="mb-4">{error}</Alert>}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Mobile Money Provider</label>
                  <div className="grid grid-cols-3 gap-3">
                    {providers.map(prov => (
                      <button
                        key={prov.provider}
                        type="button"
                        disabled={!prov.deposit_operational}
                        onClick={() => setSelectedProvider(prov.provider)}
                        className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition ${
                          !prov.deposit_operational
                            ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                            : selectedProvider === prov.provider
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={providerLogos[prov.provider] || '📱'}
                          alt={providerNames[prov.provider] || prov.provider}
                          className="w-30 h-10 object-contain"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {providerNames[prov.provider] || prov.provider}
                        </span>
                        {!prov.deposit_operational && (
                          <span className="text-xs text-red-500">Temporarily Unavailable</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Mobile Money Phone Number"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="0xxxxxxxxx (10 digits)"
                  maxLength={10}
                  inputMode="numeric"
                  required
                  icon="📱"
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={processing}
                  disabled={!isValidPhone || !selectedProvider}
                >
                  {processing ? 'Sending...' : `Pay ZMW ${parseFloat(order.total_amount).toFixed(2)}`}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate('/checkout')}
                  className="text-green-600 font-medium hover:underline"
                >
                  ← Back to Checkout
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  )
}