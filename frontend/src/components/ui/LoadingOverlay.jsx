import Spinner from './Spinner'

export default function LoadingOverlay({ isLoading, children, text = 'Loading...' }) {
  if (!isLoading) return children

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
        <div className="text-center">
          <Spinner size="lg" />
          {text && <p className="mt-3 text-gray-600 font-medium">{text}</p>}
        </div>
      </div>
    </div>
  )
}