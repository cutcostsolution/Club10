import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { WhatsAppFloat } from "@/components/brand/WhatsAppFloat";
import { useAuth } from "@/hooks/useAuth";
import { useContent } from "@/lib/content";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/brand", label: "The Brain" },
  { to: "/business", label: "The Business" },
  { to: "/academy", label: "Academy" },
  { to: "/blog", label: "Blog" },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const c = useContent("global");
  const darkHeader = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className={`sticky top-0 z-50 border-b ${darkHeader ? "bg-ink/95 border-white/5 backdrop-blur" : "bg-background/95 border-border backdrop-blur"}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo dark={darkHeader} />
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? "text-gold" : darkHeader ? "text-ivory/80 hover:text-ivory" : "text-ink/70 hover:text-ink"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <Link
                to={(user as { role?: string } | null)?.role === "admin" ? "/admin" : "/app"}
                className={`text-sm font-semibold ${darkHeader ? "text-ivory" : "text-ink"}`}
              >
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className={`text-sm font-semibold ${darkHeader ? "text-ivory" : "text-ink"}`}>
                Sign in
              </Link>
            )}
            <Link
              to="/join"
              className="gold-bg-grad inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-ink shadow-[0_4px_20px_rgba(168,132,43,0.35)] transition-transform hover:scale-[1.03]"
            >
              Join Club 10 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <button
            className={`md:hidden ${darkHeader ? "text-ivory" : "text-ink"}`}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className={`border-t px-4 pb-4 md:hidden ${darkHeader ? "bg-ink border-white/10" : "bg-background border-border"}`}>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block py-3 text-base font-medium ${isActive ? "text-gold" : darkHeader ? "text-ivory/80" : "text-ink/80"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <div className="mt-2 flex gap-3">
              {isAuthenticated ? (
                <Link to={(user as { role?: string } | null)?.role === "admin" ? "/admin" : "/app"} className="text-sm font-semibold text-gold py-2.5">
                  Dashboard
                </Link>
              ) : (
                <Link to="/login" className={`py-2.5 text-sm font-semibold ${darkHeader ? "text-ivory" : "text-ink"}`}>
                  Sign in
                </Link>
              )}
              <Link to="/join" className="gold-bg-grad rounded-full px-5 py-2.5 text-sm font-bold text-ink" onClick={() => setOpen(false)}>
                Join Club 10
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-ink text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <Logo dark />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory/60">
                {c("global.footer.blurb", "The real estate sales hub where busy professionals learn, get guided daily, and earn through ten levels — powered by Mosaic Homes.")}
              </p>
              {/* social profiles — edited at Admin → Site Content (global.social.*); hidden while empty */}
              {(() => {
                const socials: Array<[string, string]> = [
                  ["Instagram", c("global.social.instagram")],
                  ["WhatsApp", c("global.social.whatsapp")],
                  ["LinkedIn", c("global.social.linkedin")],
                  ["Facebook", c("global.social.facebook")],
                  ["X", c("global.social.x")],
                  ["YouTube", c("global.social.youtube")],
                  ["TikTok", c("global.social.tiktok")],
                ];
                const live = socials.filter(([, url]) => url && /^https?:\/\//i.test(url));
                if (live.length === 0) return null;
                return (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {live.map(([name, url]) => (
                      <a
                        key={name}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-gold-soft px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold transition-colors hover:bg-gold hover:text-ink"
                      >
                        {name}
                      </a>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div>
              <h4 className="kicker mb-4">Platform</h4>
              <ul className="space-y-2.5 text-sm text-ivory/70">
                <li><Link to="/academy" className="hover:text-gold">The Academy</Link></li>
                <li><Link to="/app" className="hover:text-ivory">Marketing Studio</Link></li>
                <li><Link to="/business#community" className="hover:text-ivory">Community & Points</Link></li>
                <li><Link to="/business#rewards" className="hover:text-ivory">Rewards Store</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="kicker mb-4">The Business</h4>
              <ul className="space-y-2.5 text-sm text-ivory/70">
                <li><Link to="/business#engine" className="hover:text-ivory">How earnings work</Link></li>
                <li><Link to="/business#engine" className="hover:text-ivory">Commission structure</Link></li>
                <li><Link to="/business#catalogue" className="hover:text-ivory">Products</Link></li>
                <li><Link to="/join" className="hover:text-ivory">Membership plans</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="kicker mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-ivory/70">
                <li><Link to="/brand" className="hover:text-ivory">About Club 10</Link></li>
                <li><Link to="/brand#chairman" className="hover:text-ivory">The Chairman</Link></li>
                <li><Link to="/blog" className="hover:text-ivory">Blog</Link></li>
                <li><Link to="/verify" className="hover:text-ivory">Verify a certificate</Link></li>
                <li><Link to="/join" className="hover:text-ivory">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-ivory/50 sm:flex-row sm:items-center">
            <span>{c("global.footer.copyright", "© 2026 CLUB 10 · A Mosaic Homes initiative")}</span>
            <span>{c("global.tagline", "Learn · Get guided · Get paid")}</span>
          </div>
        </div>
      </footer>
      <WhatsAppFloat />
    </div>
  );
}
