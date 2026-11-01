import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout, loading } = useAuth()

  return (
    <nav className="bg-green-700 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-bold">FAZ Ticketing</Link>
          <div className="flex space-x-4 items-center">
            <Link to="/matches" className="hover:text-green-200">Matches</Link>
            
            {loading ? (
              <span className="text-sm">Loading...</span>
            ) : user ? (
              <>
                <Link to="/dashboard" className="hover:text-green-200">Dashboard</Link>
                {(user.roles?.includes('super_admin') || user.roles?.includes('faz_admin')) && (
                  <Link to="/admin" className="hover:text-green-200">Admin</Link>
                )}
                {(user.roles?.includes('club_admin') || user.roles?.includes('club_officer')) && (
                  <Link to="/club" className="hover:text-green-200">Club</Link>
                )}
                {(user.roles?.includes('scanner') || user.roles?.includes('super_admin')) && (
                  <Link to="/verify" className="hover:text-green-200">Verify</Link>
                )}
                <span className="text-sm">Hi, {user.first_name || user.email}</span>
                <button onClick={logout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-700">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-green-200">Login</Link>
                <Link to="/register" className="bg-white text-green-700 px-3 py-1 rounded hover:bg-gray-100">Register</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}