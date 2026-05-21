"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Bell, 
  Code, 
  Video, 
  Volume2, 
  Laptop, 
  Info 
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Custom UI Switch for compatibility with @base-ui codebase
function CustomSwitch({ 
  checked, 
  onCheckedChange 
}: { 
  checked: boolean; 
  onCheckedChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
        checked ? "bg-primary" : "bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function SettingsPanel() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Settings State
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);
  const [autocomplete, setAutocomplete] = useState(true);
  const [videoQuality, setVideoQuality] = useState("high");
  const [reduceNoise, setReduceNoise] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load local selections
    const savedAuto = localStorage.getItem("setting_autocomplete");
    if (savedAuto) setAutocomplete(savedAuto === "true");
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem("setting_autocomplete", autocomplete.toString());
      setIsSaving(false);
      toast.success("Settings preferences saved successfully!");
    }, 800);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* 1. Theme and Workspace Settings */}
      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Laptop className="w-4 h-4 text-primary" />
            Appearance & Workspace
          </CardTitle>
          <CardDescription className="text-zinc-500">Configure your editor settings and app theme.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* App Theme Select */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-850/60 font-sans">
            <div className="space-y-0.5">
              <Label className="text-zinc-200 font-semibold text-sm">Theme Mode</Label>
              <p className="text-xs text-zinc-500">Choose between dark mode, light mode, or system default.</p>
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-zinc-950 border border-zinc-850 text-zinc-350 text-xs rounded-lg px-2.5 py-1.5 focus:border-primary outline-none transition"
            >
              <option value="dark">Dark Theme</option>
              <option value="light">Light Theme</option>
              <option value="system">System Default</option>
            </select>
          </div>

          {/* Monaco Autocomplete toggle */}
          <div className="flex items-center justify-between py-2 font-sans">
            <div className="space-y-0.5">
              <Label className="text-zinc-200 font-semibold text-sm flex items-center gap-1">
                <Code className="w-3.5 h-3.5 text-primary" />
                Editor IntelliSense
              </Label>
              <p className="text-xs text-zinc-500">Enable advanced completion and format-on-paste in Monaco.</p>
            </div>
            <CustomSwitch
              checked={autocomplete}
              onCheckedChange={setAutocomplete}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Notifications Card */}
      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Communication & Alerts
          </CardTitle>
          <CardDescription className="text-zinc-550">Manage when and where you receive round reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 font-sans">
          <div className="flex items-center justify-between py-2 border-b border-zinc-850/60">
            <div className="space-y-0.5">
              <Label className="text-zinc-200 font-semibold text-sm">Email Reports</Label>
              <p className="text-xs text-zinc-500">Receive summaries and evaluation PDFs directly via inbox.</p>
            </div>
            <CustomSwitch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="text-zinc-200 font-semibold text-sm">Upcoming reminders</Label>
              <p className="text-xs text-zinc-500">Alert me 15 minutes before an interview lobby goes live.</p>
            </div>
            <CustomSwitch
              checked={sessionReminders}
              onCheckedChange={setSessionReminders}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Audio & Video Card */}
      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Video className="w-4 h-4 text-emerald-500" />
            Lobby & Video Settings
          </CardTitle>
          <CardDescription className="text-zinc-550">Configure streaming preferences for LiveKit calls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 font-sans">
          <div className="flex items-center justify-between py-2 border-b border-zinc-850/60">
            <div className="space-y-0.5">
              <Label className="text-zinc-200 font-semibold text-sm">Default Quality</Label>
              <p className="text-xs text-zinc-500">Set resolution limit (saves bandwidth during screen-shares).</p>
            </div>
            <select
              value={videoQuality}
              onChange={(e) => setVideoQuality(e.target.value)}
              className="bg-zinc-950 border border-zinc-850 text-zinc-350 text-xs rounded-lg px-2.5 py-1.5 focus:border-primary outline-none transition"
            >
              <option value="high">High Definition (1080p)</option>
              <option value="medium">Standard (720p)</option>
              <option value="low">Low Bandwidth (480p)</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label className="text-zinc-200 font-semibold text-sm flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                Echo Cancellation
              </Label>
              <p className="text-xs text-zinc-500">Apply voice isolation filters to cut out background hums.</p>
            </div>
            <CustomSwitch
              checked={reduceNoise}
              onCheckedChange={setReduceNoise}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardContent className="py-4 flex justify-between items-center gap-4 font-sans">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Info className="w-4 h-4 text-primary" />
            Config updates apply instantly inside rooms.
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/10 text-xs px-5 h-9 shrink-0 cursor-pointer"
          >
            {isSaving ? "Saving Config..." : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
