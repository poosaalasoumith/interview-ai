import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    template: "%s | InterviewAI",
    default: "InterviewAI - AI-Powered Technical Interviews",
  },
  description: "Next-generation technical interview platform featuring dynamic AI problem generation, real-time code execution, WebRTC collaboration, and instant AI code reviews.",
  keywords: ["AI Interview", "Technical Interview", "Code Execution", "WebRTC", "Next.js", "LiveKit", "Gemini AI"],
  authors: [{ name: "InterviewAI Team" }],
  creator: "InterviewAI",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://interview-ai.vercel.app",
    title: "InterviewAI - AI-Powered Technical Interviews",
    description: "Next-generation technical interview platform featuring dynamic AI problem generation, real-time code execution, WebRTC collaboration, and instant AI code reviews.",
    siteName: "InterviewAI",
    images: [
      {
        url: "https://interview-ai.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "InterviewAI Platform Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InterviewAI - AI-Powered Technical Interviews",
    description: "Next-generation technical interview platform featuring dynamic AI problem generation, real-time code execution, WebRTC collaboration, and instant AI code reviews.",
    images: ["https://interview-ai.vercel.app/og-image.png"],
  },
  metadataBase: new URL("https://interview-ai.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
