import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import {
  FaFutbol, FaBars, FaTimes, FaUserCircle,
  FaFacebookF, FaInstagram, FaYoutube,
  FaPhone, FaEnvelope, FaChevronDown, FaChevronRight,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import logoImage from '../pages/assets/logo/faz logo.jpg';

export default function MainLayout({ children }) {
  const frontendUrl = import.meta.env.VITE_API_FRONTEND_MAIN || 'https://www.faz.kanchtech.com';
  const shopUrl = import.meta.env.VITE_API_FRONTEND_SHOP || 'https://shop.faz.kanchtech.com';
  const { user, logout, loading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const socialLinks = [
    { icon: FaFacebookF, href: 'https://web.facebook.com/FootballAssociationZambia', label: 'Facebook' },
    { icon: FaXTwitter, href: 'https://x.com/FAZFootball', label: 'X' },
    { icon: FaYoutube, href: 'https://www.youtube.com/@FAZTVOfficial', label: 'YouTube' },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50">
      {/* Header */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg py-2'
          : 'bg-gradient-to-r from-green-700 via-green-600 to-green-700 py-4'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                  <img src={logoImage} alt="FAZ Logo" className="h-10 w-auto object-contain rounded-md" />
                </div>
              </div>
              <div>
                <h1 className={`font-bold text-2xl tracking-tight ${scrolled ? 'text-green-700' : 'text-white'}`}>
                  FAZ<span className="text-orange-400">Tickets</span>
                </h1>
                <p className={`text-xs -mt-1 ${scrolled ? 'text-green-600' : 'text-green-100'}`}>
                  Football Association of Zambia
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <NavLink to="/" scrolled={scrolled}>Home</NavLink>
              <NavLink to="/matches" scrolled={scrolled}>Matches</NavLink>

              {/* External links to sibling subsystems */}
              <NavLink to={frontendUrl} scrolled={scrolled} external>
                Main Website <FaExternalLinkAlt className="inline-block text-[10px] ml-1 opacity-70" />
              </NavLink>
              <NavLink to={shopUrl} scrolled={scrolled} external>
                FAZ Shop <FaExternalLinkAlt className="inline-block text-[10px] ml-1 opacity-70" />
              </NavLink>

              {!loading && user && (
                <>
                  <NavLink to="/dashboard" scrolled={scrolled}>Dashboard</NavLink>
                  {(user.roles?.includes('super_admin') || user.roles?.includes('faz_admin')) && (
                    <NavLink to="/admin" scrolled={scrolled}>Admin</NavLink>
                  )}
                  {(user.roles?.includes('club_admin') || user.roles?.includes('club_officer')) && (
                    <NavLink to="/club" scrolled={scrolled}>Club</NavLink>
                  )}
                  {(user.roles?.includes('scanner') || user.roles?.includes('super_admin')) && (
                    <NavLink to="/verify" scrolled={scrolled}>Verify</NavLink>
                  )}
                </>
              )}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {!loading && (
                <>
                  {user ? (
                    <div className="flex items-center gap-3">
                      <div className="hidden md:block">
                        <p className={`text-sm font-medium ${scrolled ? 'text-gray-700' : 'text-white'}`}>
                          {user.first_name || user.email}
                        </p>
                        <p className={`text-xs ${scrolled ? 'text-gray-500' : 'text-green-100'}`}>
                          {user.roles?.[0]?.replace('_', ' ') || 'User'}
                        </p>
                      </div>
                      <div className="relative group">
                        <button className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-orange-500 to-red-600 shadow-lg hover:shadow-xl transition`}>
                          {user.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100">
                          <div className="p-2">
                            <button
                              onClick={logout}
                              className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              Sign Out
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        to="/login"
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          scrolled
                            ? 'text-green-700 hover:bg-green-50'
                            : 'text-white hover:bg-white/10'
                        }`}
                      >
                        Login
                      </Link>
                      <Link
                        to="/register"
                        className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl transition hover:scale-105"
                      >
                        Register
                      </Link>
                    </div>
                  )}
                </>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`md:hidden p-2 rounded-lg ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-2">
              <MobileNavLink to="/" onClick={() => setMobileMenuOpen(false)}>Home</MobileNavLink>
              <MobileNavLink to="/matches" onClick={() => setMobileMenuOpen(false)}>Matches</MobileNavLink>

              {/* External links to sibling subsystems */}
              <MobileNavLink to={frontendUrl} onClick={() => setMobileMenuOpen(false)} external>
                Main Website <FaExternalLinkAlt className="inline-block text-[10px] ml-2 opacity-60" />
              </MobileNavLink>
              <MobileNavLink to={shopUrl} onClick={() => setMobileMenuOpen(false)} external>
                FAZ Shop <FaExternalLinkAlt className="inline-block text-[10px] ml-2 opacity-60" />
              </MobileNavLink>

              {user && (
                <>
                  <MobileNavLink to="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</MobileNavLink>
                  {(user.roles?.includes('super_admin') || user.roles?.includes('faz_admin')) && (
                    <MobileNavLink to="/admin" onClick={() => setMobileMenuOpen(false)}>Admin</MobileNavLink>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-900 to-gray-800 text-white mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <img src={logoImage} alt="FAZ Logo" className="h-10 w-auto object-contain rounded-md" />
                FAZ Tickets
              </h3>
              <p className="text-gray-400 text-sm">
                Official ticketing platform of the Football Association of Zambia.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/matches" className="hover:text-orange-400 transition">Find Matches</Link></li>
                <li><Link to="/register" className="hover:text-orange-400 transition">Create Account</Link></li>
                <li><Link to="/login" className="hover:text-orange-400 transition">Sign In</Link></li>
                <li>
                  <a href={frontendUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition">
                    FAZ Main Website
                  </a>
                </li>
                <li>
                  <a href={shopUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition">
                    FAZ Shop
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Football House, Lusaka</li>
                <li>tickets@faz.co.zm</li>
                <li>+260 211 123 456</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Follow Us</h4>
              <div className="flex gap-3">
                {socialLinks.map((social, idx) => (
                  <a key={idx} href={social.href} target="_blank" rel="noopener noreferrer" className="hover:text-faz-orange transition-colors">
                    <social.icon size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-500 text-sm">
            © 2026{' '}
            <a href={frontendUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition">
              Football Association of Zambia
            </a>
            . All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NavLink — internal or external
 * ------------------------------------------------------------------ */
function NavLink({ to, children, scrolled, external = false }) {
  const className = `font-medium transition ${
    scrolled
      ? 'text-gray-700 hover:text-green-600'
      : 'text-white hover:text-orange-200'
  }`

  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return <Link to={to} className={className}>{children}</Link>
}

/* ------------------------------------------------------------------ *
 * MobileNavLink — internal or external
 * ------------------------------------------------------------------ */
function MobileNavLink({ to, children, onClick, external = false }) {
  const className = "block px-4 py-3 text-gray-700 hover:bg-green-50 rounded-lg transition"

  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={className}
      >
        {children}
      </a>
    )
  }
  return (
    <Link to={to} onClick={onClick} className={className}>
      {children}
    </Link>
  )
}