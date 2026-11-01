import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import DashboardLayout from './layouts/DashboardLayout'
import HomePage from './pages/HomePage'
import MatchesPage from './pages/MatchesPage'
import MatchDetailPage from './pages/MatchDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderConfirmationPage from './pages/OrderConfirmationPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import ClubDashboard from './pages/club/ClubDashboard'
import VerifyTicketPage from './pages/VerifyTicketPage'
import ProtectedRoute from './components/ProtectedRoute'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import PaymentPage from './pages/PaymentPage'

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:orderNumber" element={<OrderConfirmationPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/payment/:id" element={<PaymentPage />} />

            {/* Protected routes wrapped in DashboardLayout */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin/*" element={<ProtectedRoute roles={['super_admin', 'faz_admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/club/*" element={<ProtectedRoute roles={['club_admin', 'club_officer']}><ClubDashboard /></ProtectedRoute>} />
              <Route path="/verify" element={<ProtectedRoute roles={['scanner', 'super_admin', 'faz_admin']}><VerifyTicketPage /></ProtectedRoute>} />
            </Route>
          </Routes>
          <Toaster 
            position="top-right"
            toastOptions={{
              style: {
                background: '#1F2937',
                color: '#fff',
                borderRadius: '12px',
              },
              success: {
                iconTheme: { primary: '#10B981', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: '#fff' },
              },
            }}
          />
        </CartProvider>
      </AuthProvider>
    </Router>
  )
}

export default App