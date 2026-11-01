import { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext()
export const useCart = () => useContext(CartContext)

// Deterministic-ish key: hold tokens are unique, so they're the safest anchor.
// Fallback: ticket_type + section/row/seat + timestamp.
function makeCartKey(item) {
  if (item.cart_key) return item.cart_key
  if (item.holdToken) return item.holdToken
  const parts = [
    item.ticket_type_id || '',
    item.section || '',
    item.row || '',
    item.seat || '',
  ]
  return `${parts.join(':')}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (!saved) return []
      const parsed = JSON.parse(saved)
      // Migrate old entries that lack a cart_key
      return parsed.map(i => ({ ...i, cart_key: i.cart_key || makeCartKey(i) }))
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items))
  }, [items])

  const addItem = (newItem) => {
    setItems(prev => {
      const key = makeCartKey(newItem)
      const itemWithKey = { ...newItem, cart_key: key }

      const idx = prev.findIndex(i => i.cart_key === key)
      if (idx !== -1) {
        // Same key (e.g. hold refresh) → replace the existing line
        const next = [...prev]
        next[idx] = { ...next[idx], ...itemWithKey }
        return next
      }
      // New line — one per seat, or one per ticket type in quantity flow
      return [...prev, itemWithKey]
    })
  }

  const updateItem = (cartKey, updates) => {
    setItems(prev =>
      prev.map(i => (i.cart_key === cartKey ? { ...i, ...updates } : i))
    )
  }

  const removeItem = (cartKey) => {
    setItems(prev => prev.filter(i => i.cart_key !== cartKey))
  }

  const updateQuantity = (cartKey, quantity) => {
    if (quantity <= 0) return removeItem(cartKey)
    setItems(prev =>
      prev.map(i => (i.cart_key === cartKey ? { ...i, quantity } : i))
    )
  }

  const clearCart = () => {
    setItems([])
    localStorage.removeItem('cart')
  }

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalAmount,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}