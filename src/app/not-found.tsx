import Link from "next/link";
import { Ghost, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full w-48 h-48 -z-10" />
        <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl relative z-10 mx-auto">
          <Ghost className="w-12 h-12 text-primary" />
        </div>
      </div>
      
      <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">404</h1>
      <h2 className="text-2xl font-semibold text-zinc-300 mb-4">Page not found</h2>
      
      <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
        We couldn't find the page you're looking for. It might have been moved, deleted, or never existed in the first place.
      </p>

      <Link 
        href="/"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-full font-medium transition shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Return Home
      </Link>
    </div>
  );
}
