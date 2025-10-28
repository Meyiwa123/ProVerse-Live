export function Header() {
  return (
    <header className="border-b border-primary/20 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-[95rem] px-4 sm:px-6 h-16 flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          <span className="text-primary">ProVerse</span>
          <span className="text-white">Live</span>
        </h1>
        <div className="hidden sm:block text-sm text-zinc-400">
          Live verse suggestions for ProPresenter
        </div>
        <div className="sm:hidden text-xs text-zinc-500">
          AI-powered
        </div>
      </div>
    </header>
  );
}