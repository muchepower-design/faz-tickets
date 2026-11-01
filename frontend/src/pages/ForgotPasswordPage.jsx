import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { Button, Card, Input, Alert } from '../components/ui'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
      toast.success('Password reset link sent! (Demo mode)')
    }, 1500)
  }

  return (
    <AuthLayout 
      title="Reset Password" 
      subtitle="We'll send you a link to reset your password"
    >
      <Card padding="lg" hover>
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError('')} className="mb-6">
            {error}
          </Alert>
        )}

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-3xl">✉️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h3>
            <p className="text-gray-600 mb-6">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <Button
              variant="outline"
              onClick={() => setSubmitted(false)}
              fullWidth
            >
              Try Another Email
            </Button>
            <div className="mt-4">
              <Link to="/login" className="text-green-600 hover:underline">
                ← Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon="📧"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
            >
              Send Reset Link
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-green-600 hover:underline">
                ← Back to Login
              </Link>
            </div>
          </form>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-800">
            <span className="font-medium">💡 Demo Mode:</span> This is a demonstration. 
            In production, a real email would be sent with a password reset link.
          </p>
        </div>
      </Card>
    </AuthLayout>
  )
}