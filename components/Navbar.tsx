"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Compass,
  UploadCloud,
  Network,
  HelpCircle,
  FileCheck2,
  CalendarDays,
  Sparkles,
  LogOut,
  GraduationCap
} from "lucide-react";
import { useEffect, useState } from "react";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Hide navbar on login page
  if (pathname === "/login") return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Compass },
    { href: "/upload", label: "Upload", icon: UploadCloud },
    { href: "/topics", label: "Topics", icon: Network },
    { href: "/quiz", label: "Quiz", icon: HelpCircle },
    { href: "/report", label: "Gap Report", icon: FileCheck2 },
    { href: "/plan", label: "Revision Plan", icon: CalendarDays },
    { href: "/assistant", label: "Explain AI", icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                GapFinder <span className="text-brand-400 text-xs px-1.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/30">AI</span>
              </span>
            </div>
          </Link>

          {/* Navigation items */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User profile / Logout */}
          <div className="flex items-center space-x-3">
            {userEmail ? (
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="hidden sm:inline-block max-w-[140px] truncate text-slate-300">
                  {userEmail}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
