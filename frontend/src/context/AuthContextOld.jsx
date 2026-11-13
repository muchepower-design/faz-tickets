import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        if (userData.role) userData.roles = [userData.role]
        else userData.roles = ['customer']
        setUser(userData)
        setLoading(false)
        // Optionally refresh user data in background
        api.get('/api/ticketing/auth/me')
          .then(res => {
            const freshUser = res.data
            if (freshUser.role) freshUser.roles = [freshUser.role]
            else freshUser.roles = ['customer']
            setUser(freshUser)
            localStorage.setItem('user', JSON.stringify(freshUser))
          })
          .catch(() => {
            // Token invalid, clear storage
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setUser(null)
          })
      } catch (e) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    try {
      const res = await api.post('/api/ticketing/auth/login', { email, password })
      const token = res.data.access_token
      let userData = res.data.user
      if (userData.role) userData.roles = [userData.role]
      else userData.roles = ['customer']
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      toast.success('Login successful')
      return true
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
      return false
    }
  }

  const register = async (userData) => {
    try {
      const res = await api.post('/api/ticketing/auth/register', userData)
      const token = res.data.access_token
      let newUser = res.data.user
      if (newUser.role) newUser.roles = [newUser.role]
      else newUser.roles = ['customer']
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(newUser))
      setUser(newUser)
      toast.success('Account created')
      return true
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    toast.success('Logged out')
  }

  const hasRole = (role) => user?.roles?.includes(role) || false
  const hasAnyRole = (roles) => roles.some(r => user?.roles?.includes(r))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole, hasAnyRole, api }}>
      {children}
    </AuthContext.Provider>
  )
}