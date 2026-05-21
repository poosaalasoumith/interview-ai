import { BrandLogo } from "@/components/ui/brand-logo";

export default function DashboardLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="relative flex flex-col items-center justify-center">
        {/* Animated breathing glow background */}
        <div className="absolute inset-0 bg-primary/25 blur-[30px] rounded-full w-14 h-14 animate-pulse" />
        
        {/* Breathing brand logo asset */}
        <div className="relative w-14 h-14 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-lg shadow-black/50 animate-bounce">
          <BrandLogo size="lg" className="w-10 h-10 p-1 flex items-center justify-center" />
        </div>
      </div>
      <p className="mt-6 text-xs tracking-widest text-zinc-400 font-medium uppercase font-mono animate-pulse">Initializing Interface...</p>
    </div>
  );
}
