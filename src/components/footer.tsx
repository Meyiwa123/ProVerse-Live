import { Heart, Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-primary/20 bg-zinc-950/50 backdrop-blur-sm mt-auto">
      <div className="mx-auto max-w-[95rem] px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Love message */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Built with</span>
            <Heart className="w-4 h-4 text-primary fill-primary animate-pulse" />
            <span>for worship teams everywhere</span>
          </div>

          {/* Right: Links */}
          <div className="flex items-center gap-4 text-sm">
            <a
              href="https://github.com/Meyiwa123/ProVerse-Live"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-zinc-400 hover:text-primary transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href="https://lighthouseottawa.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-zinc-400 hover:text-primary transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Lighthouse Church Ottawa</span>
            </a>
          </div>
        </div>

        {/* Bottom: Copyright */}
        <div className="mt-6 pt-6 border-t border-zinc-800 text-center text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} ProVerseLive. Powered by faith.</p>
        </div>
      </div>
    </footer>
  );
}