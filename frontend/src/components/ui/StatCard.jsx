export default function StatCard({ 
  title, 
  value, 
  icon, 
  change,
  changeLabel,
  color = 'primary',
  className = '' 
}) {
  const colors = {
    primary: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    blue: 'from-blue-500 to-blue-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
  }

  const isPositive = change?.startsWith('+')

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
        {icon && (
          <div className={`w-12 h-12 bg-gradient-to-br ${colors[color]} rounded-xl flex items-center justify-center text-white text-2xl shadow-lg`}>
            {icon}
          </div>
        )}
      </div>
      {change && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {change}
          </span>
          {changeLabel && <span className="text-sm text-gray-500">{changeLabel}</span>}
        </div>
      )}
    </div>
  )
}