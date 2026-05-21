import { SettingsPanel } from "@/components/dashboard/settings-panel";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
          System Preferences
        </h1>
        <p className="text-muted-foreground mt-1">
          Adjust code editor autocomplete, sound and video configurations, and notification alerts.
        </p>
      </div>

      <SettingsPanel />
    </div>
  );
}