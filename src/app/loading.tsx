export default function Loading() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-lime/10 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-lime rounded-full animate-spin" />
        </div>
        <p className="text-xs text-white/30">Yuklanmoqda...</p>
      </div>
    </div>
  );
}
