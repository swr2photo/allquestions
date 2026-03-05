export default function QuizLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Back button skeleton */}
      <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse mb-6" />

      {/* Header skeleton */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
          <div>
            <div className="h-4 w-24 bg-gray-200 rounded-lg animate-pulse mb-2" />
            <div className="h-7 w-56 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Search skeleton */}
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse mb-6" />

      {/* Progress skeleton */}
      <div className="h-3 bg-gray-200 rounded-full animate-pulse mb-6" />

      {/* Question cards skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-48 bg-gray-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
