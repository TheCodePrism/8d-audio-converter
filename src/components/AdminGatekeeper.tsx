"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Lock, KeyRound, ArrowRight, Radio, LogOut, AlertCircle, Eye, EyeOff } from "lucide-react";

interface AdminGatekeeperProps {
  children: (props: { adminKey: string; onLogout: () => void }) => React.ReactNode;
}

const STORAGE_KEY = "sphere8d_admin_session_key";

export function AdminGatekeeper({ children }: AdminGatekeeperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminKey, setAdminKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    async function checkExistingSession() {
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const res = await fetch("/api/admin/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: stored }),
            });
            if (res.ok) {
              setAdminKey(stored);
              setIsAuthenticated(true);
              return;
            }
          } catch {}
          sessionStorage.removeItem(STORAGE_KEY);
        }
        setIsAuthenticated(false);
      }
    }
    checkExistingSession();
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!inputKey.trim()) {
      setError("Please enter the administrator passphrase.");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: inputKey.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem(STORAGE_KEY, inputKey.trim());
        setAdminKey(inputKey.trim());
        setIsAuthenticated(true);
      } else {
        setError(data.error || "Invalid administrative passphrase. Access denied.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to reach verification endpoint.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setInputKey("");
    setIsAuthenticated(false);
  };

  // Loading check on mount
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#07090E] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not authenticated: render the Cyberpunk Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] bg-purple-500/10 rounded-full blur-[130px] pointer-events-none" />

        <div className="relative w-full max-w-md p-8 rounded-3xl border border-slate-800 bg-[#0A0D14]/90 backdrop-blur-2xl shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Admin Debugging Terminal
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                LOCKED
              </span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Restricted area for server telemetry, Invidious pool management, and YouTube extraction diagnostics.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                <span>Admin Passphrase</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Enter administrator key..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>{isVerifying ? "Verifying..." : "Unlock Studio Terminal"}</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Return to 8D Audio Studio</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: Render children with admin control banner
  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Top Admin Status Dock */}
      <div className="bg-slate-950 border-b border-cyan-500/30 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
            Admin Terminal Active
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline text-[11px]">
            Authorized Debugging & Infrastructure Controller
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-slate-300 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Studio</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Lock terminal and end session"
          >
            <LogOut className="w-3 h-3" />
            <span>Lock Terminal</span>
          </button>
        </div>
      </div>

      <div className="flex-1">{children({ adminKey, onLogout: handleLogout })}</div>
    </div>
  );
}
