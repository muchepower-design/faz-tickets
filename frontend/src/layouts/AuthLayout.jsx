import { Link } from 'react-router-dom'
import logoImage from '../pages/assets/logo/faz logo.jpg';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-200 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-200 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-100 rounded-full blur-3xl opacity-20"></div>
      </div>

      <div className="relative flex min-h-screen">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-700 via-green-600 to-green-800 p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-40 h-40 border-4 border-white rounded-full"></div>
            <div className="absolute bottom-20 right-10 w-60 h-60 border-4 border-white rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border border-white rounded-full"></div>
          </div>
          
          <div className="relative z-10 flex flex-col justify-between max-w-md">
            <div>
              <Link to="/" className="flex items-center gap-3 mb-12">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  
                     <img src={logoImage} alt="FAZ Logo" className="h-10 w-auto object-contain rounded-md" />
                  
                </div>
                <span className="text-2xl font-bold">FAZ Tickets</span>
              </Link>
              
              <h2 className="text-4xl font-bold mb-4 leading-tight">
                Welcome to the Heart of Zambian Football
              </h2>
              <p className="text-green-100 text-lg leading-relaxed">
                Secure your seat for the biggest matches. Join thousands of passionate fans and experience the thrill live.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-xl">
                  🎟️
                </div>
                <div>
                  <p className="font-medium">Instant Digital Tickets</p>
                  <p className="text-sm text-green-100">QR codes delivered instantly</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-xl">
                  🔒
                </div>
                <div>
                  <p className="font-medium">Secure Transactions</p>
                  <p className="text-sm text-green-100">Your data is protected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <p className="font-medium">Mobile Ready</p>
                  <p className="text-sm text-green-100">Access anywhere, anytime</p>
                </div>
              </div>
            </div>

            <div className="mt-12 text-sm text-green-200">
              © 2026 Football Association of Zambia
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <Link to="/" className="inline-flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">⚽</span>
                </div>
                <span className="text-xl font-bold text-gray-800">FAZ Tickets</span>
              </Link>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
                {title || 'Welcome'}
              </h1>
              {subtitle && (
                <p className="text-gray-500 mt-2">{subtitle}</p>
              )}
            </div>

            {/* Content */}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}