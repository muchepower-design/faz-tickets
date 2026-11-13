import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../layouts/AuthLayout'
import { Button, Card, Input, Alert } from '../components/ui'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const googleButtonRef = useRef(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id || !googleButtonRef.current) return

    const handleCredential = async (response) => {
      setError('')
      setLoading(true)
      const result = await loginWithGoogle(response.credential)
      setLoading(false)
      if (result.success) navigate('/dashboard')
      else setError('Google sign-in failed. Please try again.')
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    })
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 340,
      text: 'continue_with',
      shape: 'rectangular',
    })
  }, [loginWithGoogle, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(formData.email, formData.password)
    setLoading(false)
    if (result.success) navigate('/dashboard')
    else setError('Invalid email or password. Please try again.')
  }

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to your FAZ Tickets account">
      <Card padding="lg" hover>
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError('')} className="mb-6">
            {error}
          </Alert>
        )}

        {GOOGLE_CLIENT_ID ? (
          <div className="mb-5 flex justify-center">
            <div ref={googleButtonRef}></div>
          </div>
        ) : (
          <p className="text-xs text-center text-gray-500 mb-4">
            (Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable Google sign-in)
          </p>
        )}

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-gray-500">or sign in with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            icon="📧"
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            icon="🔒"
            required
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input type="checkbox" className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-green-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-600 font-medium hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </Card>
    </AuthLayout>
  )
}