"use client";

import { useState, useRef, useEffect } from "react";
import { Music, LogOut, History, ChevronDown, User } from "lucide-react";
import type { UserProfile } from "@/lib/auth";

interface NavBarProps {
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  onToggleHistory: () => void;
  showHistory: boolean;
}

export default function NavBar({
  user,
  onLogin,
  onLogout,
  onToggleHistory,
  showHistory,
}: NavBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/[0.05] bg-[#080b12]/80 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Music className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-bold text-white tracking-tight">
            SonicSplit
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Task History toggle */}
              <button
                onClick={onToggleHistory}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showHistory
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
                    : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                History
              </button>

              {/* User menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 text-xs font-medium hover:bg-zinc-800 transition-all"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-indigo-400" />
                  </div>
                  <span className="hidden sm:inline">{user.name}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-white/[0.07] rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-800">
                      <p className="text-xs text-zinc-400">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        onLogout();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800/50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={onLogin}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-xs font-semibold cursor-pointer hover:brightness-110 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.25)]"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
