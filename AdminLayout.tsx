import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutDashboard, Users, Building2, Banknote, Sparkles, GraduationCap, CreditCard, FileText, Menu, X, ArrowLeft, LogOut,
  HandCoins, Newspaper, Settings, ClipboardCheck, Map, PackageOpen
} from "lucide-react";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/realtors", label: "Realtors", icon: Users },
  { to: "/admin/products", label: "Products", icon: Building2 },
  { to: "/admin/payments", label: "Payments", icon: HandCoins },
  { to: "/admin/commissions", label: "Commissions", icon: Banknote },
  { to: "/admin/points", label: "Points & Rewards", icon: Sparkles },
  { to: "/admin/academy", label: "Academy", icon: GraduationCap },
  { to: "/admin/compliance", label: "Compliance", icon: ClipboardCheck },
  { to: "/admin/marketing-tracker", label: "Marketing Tracker", icon: Map },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/plans", label: "Membership Plans", icon: CreditCard },
  { to: "/admin/cms", label: "Site Content (CMS)", icon: FileText },
  { to: "/admin/starter-kit", label: "Starter Kit", icon: PackageOpen },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink">
        <div className="w-8 h-8 border-2 border-[#a8842b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/login", { replace: true });
    return null;
  }
  if (user.role !== "admin") {
    navigate("/app", { replace: true });
    return null;
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <Logo dark />
        <button className="lg:hidden text-white/60 p-1" onClick={() => setOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <p className="px-5 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.25em] text-[#a8842b]">Admin console</p>
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                isActive ? "gold-bg-grad text-white" : "text-white/60 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link to="/app" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5">
          <ArrowLeft className="w-[18px] h-[18px]" /> Member dashboard
        </Link>
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5">
          <ArrowLeft className="w-[18px] h-[18px]" /> Public site
        </Link>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5"
        >
          <LogOut className="w-[18px] h-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f3ea]">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-ink text-white flex items-center justify-between px-4 py-3">
        <Logo dark />
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-white/10">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-ink flex-col z-40">{sidebar}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink flex flex-col">{sidebar}</aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
