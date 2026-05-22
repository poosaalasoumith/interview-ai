"use client";

import React, { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { X, Mail, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiEmailInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function MultiEmailInput({
  emails,
  onChange,
  placeholder = "Enter email addresses...",
  disabled = false,
}: MultiEmailInputProps) {
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate single email
  const isValidEmail = (email: string) => EMAIL_REGEX.test(email);

  // Add multiple emails and filter out empty strings and duplicates
  const addEmails = (rawEmails: string[]) => {
    const cleaned = rawEmails
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const uniqueNew = cleaned.filter((e) => !emails.includes(e));

    if (uniqueNew.length > 0) {
      onChange([...emails, ...uniqueNew]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    // Trigger add on Enter, comma, semicolon, space, or Tab
    if (["Enter", ",", ";", "Tab", " "].includes(e.key)) {
      if (e.key === "Tab" && !inputValue) return; // Allow tabbing away if empty
      
      e.preventDefault();
      if (inputValue.trim()) {
        addEmails([inputValue]);
        setInputValue("");
      }
    }

    // Remove last tag on Backspace if input is empty
    if (e.key === "Backspace" && !inputValue && emails.length > 0) {
      e.preventDefault();
      const updated = [...emails];
      updated.pop();
      onChange(updated);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    // Split by commas, semicolons, spaces, or newlines
    const splitEmails = pastedData.split(/[\s,;\n]+/);
    addEmails(splitEmails);
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addEmails([inputValue]);
      setInputValue("");
    }
  };

  const removeEmail = (indexToRemove: number) => {
    if (disabled) return;
    onChange(emails.filter((_, index) => index !== indexToRemove));
  };

  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={cn(
          "flex flex-wrap items-center gap-1.5 min-h-[44px] w-full rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2 text-sm ring-offset-background transition-all cursor-text focus-within:border-stone-600 focus-within:ring-1 focus-within:ring-stone-600",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <Mail className="h-4 w-4 text-zinc-500 mr-1 shrink-0" />
        
        {/* Render Email Tags */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {emails.map((email, index) => {
            const valid = isValidEmail(email);
            return (
              <span
                key={index}
                className={cn(
                  "inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-md text-xs font-medium border transition-all animate-in fade-in zoom-in-95 duration-150",
                  valid
                    ? "bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/15"
                    : "bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/15"
                )}
              >
                {!valid && <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />}
                {email}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEmail(index);
                  }}
                  className="rounded-sm p-0.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>

        {/* Real text input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={emails.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-0 p-0 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-0 min-w-[120px] h-6 text-sm"
        />
      </div>
      
      <p className="text-[11px] text-zinc-500 leading-normal pl-1">
        Separate emails with <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400">Enter</kbd>, <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400">Comma</kbd>, or paste a list.
      </p>
    </div>
  );
}
