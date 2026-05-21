import Link from "next/link";
import { Code, Video, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-zinc-50 font-sans selection:bg-primary/30">
      {/* Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <BrandLogo size="md" className="w-8 h-8 bg-primary/10 rounded-lg p-1 flex items-center justify-center shadow-md shadow-primary/5" />
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text">InterviewAI</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/signup">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
              Get Started
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative px-6 text-center pt-32 pb-24">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

        <Badge />
        <h1 className="mt-8 text-5xl md:text-7xl font-extrabold tracking-tighter max-w-4xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          The Future of Technical Interviews is Here.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-zinc-400 max-w-2xl leading-relaxed">
          Experience seamless real-time coding, WebRTC video collaboration, and instant AI-powered code reviews. Engineered for the next generation of engineers.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all hover:scale-105">
              Start Interviewing For Free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-white/20 hover:bg-white/5 transition-all">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full text-left">
          <FeatureCard 
            icon={<Code className="w-6 h-6 text-blue-400" />}
            title="Real-time Execution"
            description="Write and execute code in 10+ languages instantly using our secure, containerized Piston engine."
          />
          <FeatureCard 
            icon={<Video className="w-6 h-6 text-emerald-400" />}
            title="Ultra-low Latency Video"
            description="Collaborate face-to-face with built-in WebRTC video and screen sharing powered by LiveKit."
          />
          <FeatureCard 
            icon={<Bot className="w-6 h-6 text-purple-400" />}
            title="AI Co-Pilot & Review"
            description="Receive dynamic algorithmic questions and get instant, streaming feedback on time/space complexity."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-zinc-500 text-sm mt-auto">
        <p>&copy; {new Date().getFullYear()} InterviewAI Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}

function Badge() {
  return (
    <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
      <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
      InterviewAI v2.0 is Live
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
