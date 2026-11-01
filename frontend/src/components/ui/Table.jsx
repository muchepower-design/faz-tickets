export default function Table({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-gray-100 ${className}`}>
      <table className="w-full">
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children, className = '' }) {
  return (
    <thead className={`bg-gray-50 border-b border-gray-100 ${className}`}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className = '' }) {
  return (
    <tbody className={`divide-y divide-gray-100 ${className}`}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className = '', onClick }) {
  return (
    <tr 
      className={`hover:bg-gray-50 transition ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableHeaderCell({ children, className = '', align = 'left' }) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }
  
  return (
    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${alignClasses[align]} ${className}`}>
      {children}
    </th>
  )
}

export function TableCell({ children, className = '', align = 'left' }) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }
  
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-700 ${alignClasses[align]} ${className}`}>
      {children}
    </td>
  )
}