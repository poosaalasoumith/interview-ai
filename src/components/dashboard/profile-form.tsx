"use client";

import { useState, useRef } from "react";
import { updateProfile } from "@/app/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Camera, Shield, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

// Predefined set of beautiful premium avatars to avoid empty uploads
const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
];

interface ProfileFormProps {
  user: {
    id: string;
    email?: string;
    name?: string;
    avatar?: string;
    role: string;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [name, setName] = useState(user.name || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || PRESET_AVATARS[0]);
  const [previewUrl, setPreviewUrl] = useState(user.avatar || PRESET_AVATARS[0]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    if (isUploadingImage) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. File Size Validation (< 2MB)
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error("File size exceeds 2MB limit. Please select a smaller image.");
      return;
    }

    // 2. MIME Type Validation
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowedMimeTypes.includes(file.type)) {
      toast.error("Invalid image format. Supported formats: PNG, JPEG, GIF, WEBP");
      return;
    }

    // 3. Set instant preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsUploadingImage(true);

    try {
      const supabase = createClient();

      // Defensive creation of bucket
      try {
        await supabase.storage.createBucket("avatars", {
          public: true,
          fileSizeLimit: 2097152,
          allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        });
      } catch (err) {
        // Safe to ignore if bucket already exists or RLS prevents creation
      }

      // Generate a clean and collision-resistant path
      const fileExt = file.name.split(".").pop();
      const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}.${fileExt}`;
      const filePath = `${user.id}/${cleanFileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 4. Retrieve public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setSelectedAvatar(publicUrl);
      setPreviewUrl(publicUrl);
      toast.success("Custom profile photo uploaded successfully! Click 'Save Changes' to apply.");
    } catch (err: any) {
      console.error("[Profile Avatar Upload Error]", err);
      // Revert preview back to previous selected state on failure
      setPreviewUrl(selectedAvatar);
      toast.error(err.message || "Failed to upload image to storage. Please try again.");
    } finally {
      setIsUploadingImage(false);
      // Reset input value to allow uploading the same file again if desired
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await updateProfile({ name, avatar: selectedAvatar });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Profile updated successfully!");
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/gif, image/webp"
        className="hidden"
      />

      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Personal Profile
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Manage your public identity, display name, and avatar presence on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Profile Image</label>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div 
                className="relative group cursor-pointer select-none" 
                onClick={handleAvatarClick}
                title="Click to upload custom photo"
              >
                <Avatar className="h-20 w-20 border-2 border-zinc-800 ring-2 ring-primary/25 transition-transform group-hover:scale-105 duration-200">
                  <AvatarImage src={previewUrl} className="object-cover" />
                  <AvatarFallback className="bg-zinc-800 text-zinc-350 text-lg font-extrabold">
                    {name.substring(0, 2).toUpperCase() || "ME"}
                  </AvatarFallback>
                </Avatar>

                {isUploadingImage ? (
                  <div className="absolute inset-0 bg-zinc-950/80 rounded-full flex flex-col items-center justify-center border border-primary/40 animate-pulse">
                    <RefreshCw className="w-5 h-5 text-primary animate-spin mb-0.5" />
                    <span className="text-[9px] text-zinc-300 font-semibold tracking-wide">Uploading</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2.5">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-zinc-350">
                    Click the photo to upload your own custom image, or choose a curated avatar:
                  </p>
                  <p className="text-[10px] text-zinc-550">
                    Supports PNG, JPG, GIF or WEBP up to 2MB.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(url);
                        setPreviewUrl(url);
                      }}
                      className={`h-9 w-9 rounded-full overflow-hidden border-2 transition-all ${
                        selectedAvatar === url ? "border-primary ring-2 ring-primary/20 scale-105" : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-850/60" />

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-450 uppercase tracking-wider block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-550" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sowmith Reddy"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-primary outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-455 uppercase tracking-wider block">Email Address</label>
              <div className="relative opacity-60">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-550" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-400 outline-none cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-500" /> Account email is verified and locked for security.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/40 backdrop-blur-sm border-zinc-800/80">
        <CardContent className="py-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Changes sync instantly to dashboard controls.
          </div>
          <Button
            type="submit"
            disabled={isUpdating || isUploadingImage}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/10 text-xs px-5 h-9 shrink-0 cursor-pointer"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving Profiles...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
