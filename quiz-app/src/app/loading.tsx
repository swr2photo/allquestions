export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero skeleton */}
      <div className="max-w-2xl mx-auto text-center mb-12">
        <div className="h-10 w-64 mx-auto bg-gray-200 rounded-lg animate-pulse mb-4" />
        <div className="h-5 w-96 mx-auto bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-44 bg-gray-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
