export default function CourseLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back button skeleton */}
      <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse mb-6" />

      {/* Header skeleton */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-14 w-14 bg-gray-200 rounded-xl animate-pulse" />
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-48 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Quiz list skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-40 bg-gray-200 rounded-lg animate-pulse mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-gray-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
