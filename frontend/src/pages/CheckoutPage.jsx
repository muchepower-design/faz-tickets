import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { Button, Card, Input, Alert, Spinner } from '../components/ui'
import toast from 'react-hot-toast'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, totalAmount, updateQuantity, updateItem, removeItem, clearCart } = useCart()
  const { user, api } = useAuth()
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    customer_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    customer_email: user?.email || '',
    customer_phone: user?.phone || '',
  })

  const hasValidated = useRef(false)

  useEffect(() => {
    if (hasValidated.current) return
    if (items.length === 0) {
      setValidating(false)
      return
    }
    hasValidated.current = true

    const validateHolds = async () => {
      for (const item of items) {
        if (!item.holdToken) continue

        try {
          const payload = {
            ticket_type_id: item.ticket_type_id,
            quantity: item.quantity,
            hold_token: item.holdToken,
            // Keep the seat identity when refreshing the hold
            section: item.section || undefined,
            row: item.row || undefined,
            seat: item.seat || undefined,
          }
          const res = await api.post(`/api/ticketing/matches/${item.match_id}/hold`, payload)
          const data = res.data

          if (data.hold_token && data.hold_token !== item.holdToken) {
            updateItem(item.cart_key, { holdToken: data.hold_token })
            toast.success(`Hold refreshed for ${item.ticket_type_name}`)
          }
        } catch (err) {
          if (err.response?.status === 404) {
            removeItem(item.cart_key)
            toast.error(`${item.ticket_type_name} hold expired. Please add again.`)
          } else if (err.response?.status === 409) {
            const available = err.response.data?.available || 0
            if (available > 0 && !item.seat) {
              // Only auto-adjust quantity for non-seat lines
              try {
                const res = await api.post(`/api/ticketing/matches/${item.match_id}/hold`, {
                  ticket_type_id: item.ticket_type_id,
                  quantity: available,
                  hold_token: undefined,
                })
                const data = res.data
                if (data.hold_token) {
                  updateItem(item.cart_key, { quantity: available, holdToken: data.hold_token })
                  toast.warning(`Only ${available} seats left. Quantity adjusted.`)
                }
              } catch {
                removeItem(item.cart_key)
                toast.error(`${item.ticket_type_name} no longer available.`)
              }
            } else {
              // Seat-level conflict → remove the line
              removeItem(item.cart_key)
              toast.error(item.seat
                ? `Seat ${item.seat} is no longer available.`
                : `${item.ticket_type_name} sold out.`)
            }
          }
        }
      }
      setValidating(false)
    }

    validateHolds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (validating) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center py-20">
          <Spinner size="xl" />
          <p className="ml-4 text-gray-500">Checking seat availability...</p>
        </div>
      </MainLayout>
    )
  }

  if (items.length === 0) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Card padding="xl" className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some tickets to get started!</p>
            <Button to="/matches" variant="primary" size="lg">Browse Matches</Button>
          </Card>
        </div>
      </MainLayout>
    )
  }

  const handleQuantityChange = async (item, delta) => {
    // Seat-picked lines are fixed at quantity 1
    if (item.seat) {
      toast.error('Seats are fixed at quantity 1. Remove and re-pick to change.')
      return
    }
    const newQty = item.quantity + delta
    if (newQty < 0) return

    try {
      const payload = {
        ticket_type_id: item.ticket_type_id,
        quantity: newQty,
        hold_token: item.holdToken || undefined,
      }
      const res = await api.post(`/api/ticketing/matches/${item.match_id}/hold`, payload)
      const data = res.data

      if (data.hold_token && data.hold_token !== item.holdToken) {
        updateItem(item.cart_key, { quantity: newQty, holdToken: data.hold_token })
      } else {
        updateQuantity(item.cart_key, newQty)
      }
      if (newQty === 0) toast.success('Item removed')
    } catch (err) {
      if (err.response?.status === 404) {
        removeItem(item.cart_key)
        toast.error('Hold expired. Please add tickets again.')
      } else if (err.response?.status === 409) {
        const available = err.response.data?.available || 0
        if (available > 0) {
          try {
            const res = await api.post(`/api/ticketing/matches/${item.match_id}/hold`, {
              ticket_type_id: item.ticket_type_id,
              quantity: available,
              hold_token: undefined,
            })
            const data = res.data
            if (data.hold_token) {
              updateItem(item.cart_key, { quantity: available, holdToken: data.hold_token })
              toast.warning(`Only ${available} seats available. Quantity adjusted.`)
            }
          } catch {
            removeItem(item.cart_key)
            toast.error('Failed to reserve seats. Item removed.')
          }
        } else {
          removeItem(item.cart_key)
          toast.error('Seats no longer available. Item removed.')
        }
      } else {
        toast.error('Failed to update reservation')
      }
    }
  }

  const handleRemoveItem = (item) => {
    if (item.holdToken) {
      api.delete(`/api/ticketing/matches/${item.match_id}/hold/${item.holdToken}`).catch(() => {})
    }
    removeItem(item.cart_key)
    toast.success('Item removed')
  }

  const handleCancelOrder = async () => {
    if (items.length === 0) return
    setCancelLoading(true)
    try {
      for (const item of items) {
        if (item.holdToken) {
          await api
            .delete(`/api/ticketing/matches/${item.match_id}/hold/${item.holdToken}`)
            .catch(() => {})
        }
      }
      clearCart()
      toast.success('Order cancelled, seats released')
      navigate('/matches')
    } catch (err) {
      toast.error('Failed to cancel')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.customer_email || !formData.customer_name) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const orderData = {
        ...formData,
        items: items.map(item => ({
          ticket_type_id: item.ticket_type_id,
          quantity: item.quantity,
          // ⬇️ THE FIX: carry seat assignment through to the backend
          section: item.section || null,
          row: item.row || null,
          seat: item.seat || null,
        })),
        hold_tokens: items.map(item => item.holdToken).filter(Boolean),
      }

      const response = await api.post('/api/ticketing/orders', orderData)
      clearCart()
      toast.success('Order placed successfully!')
      navigate(`/payment/${response.data.id}`)
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Checkout</h1>
          <Button variant="danger" onClick={handleCancelOrder} loading={cancelLoading}>
            Cancel Order
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card padding="lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Customer Information</h2>

              {error && (
                <Alert variant="error" dismissible onDismiss={() => setError('')} className="mb-6">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input label="Full Name" name="customer_name" value={formData.customer_name} onChange={handleChange} icon="👤" required />
                <Input label="Email Address" type="email" name="customer_email" value={formData.customer_email} onChange={handleChange} icon="📧" required />
                <Input label="Phone Number" type="tel" name="customer_phone" value={formData.customer_phone} onChange={handleChange} icon="📱" />

                <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} icon="🔒">
                  Proceed to Payment - ZMW {(totalAmount || 0).toFixed(2)}
                </Button>
              </form>
            </Card>
          </div>

          <div>
            <Card padding="lg" className="bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>

              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.cart_key} className="pb-3 border-b border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.match_name}</p>
                        <p className="text-sm text-gray-500">{item.ticket_type_name}</p>
                        {item.seat && (
                          <p className="text-xs text-green-700 mt-1">
                            {item.section} · Row {item.row} · Seat {item.seat}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item)}
                        className="text-red-500 hover:text-red-700 text-sm ml-2"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item, -1)}
                          className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 font-bold"
                          disabled={item.quantity <= 1 || !!item.seat}
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(item, 1)}
                          className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 font-bold"
                          disabled={!!item.seat}
                        >
                          +
                        </button>
                      </div>
                      <p className="text-green-600 font-medium">
                        ZMW {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-lg font-bold text-gray-800 pt-3 border-t border-gray-200">
                <span>Total</span>
                <span className="text-green-600">ZMW {(totalAmount || 0).toFixed(2)}</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}