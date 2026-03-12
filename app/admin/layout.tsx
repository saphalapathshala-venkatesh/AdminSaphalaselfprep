"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

const navSections = [
  {
    heading: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/admin/dashboard" },
    ],
  },
  {
    heading: "CONTENT",
    items: [
      { label: "Taxonomy", href: "/admin/taxonomy" },
      { label: "Question Bank", href: "/admin/question-bank" },
      { label: "Imports", href: "/admin/imports" },
      { label: "Test Series", href: "/admin/test-series" },
      { label: "Tests", href: "/admin/tests" },
      { label: "Flashcards", href: "/admin/flashcards" },
      { label: "Content Library", href: "/admin/content-library" },
    ],
  },
  {
    heading: "MEDIA",
    items: [
      { label: "Videos", href: "/admin/videos" },
      { label: "Live Classes", href: "/admin/live-classes" },
      { label: "Content Flow", href: "/admin/content-flow" },
    ],
  },
  {
    heading: "COMMERCE",
    items: [
      { label: "Products", href: "/admin/products" },
      { label: "Coupons", href: "/admin/coupons" },
    ],
  },
  {
    heading: "ENGAGEMENT",
    items: [
      { label: "XP Rules", href: "/admin/xp-rules" },
      { label: "Learners", href: "/admin/learners" },
    ],
  },
  {
    heading: "REPORTING",
    items: [
      { label: "Analytics", href: "/admin/analytics" },
    ],
  },
  {
    heading: "SYSTEM",
    items: [
      { label: "Settings", href: "/admin/settings", comingSoon: true },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = useCallback(() => {
    // [Auth timing] logout start
    console.debug("[Auth] Logout start", new Date().toISOString());

    // Fire-and-forget: keepalive ensures the request completes even after navigation.
    // Do NOT await — redirect immediately so the user never sees a frozen UI.
    fetch("/api/auth/logout", { method: "POST", keepalive: true })
      .then(() => console.debug("[Auth] Logout API complete"))
      .catch(() => {});

    router.replace("/login");
  }, [router]);

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <img
            src="/saphala-logo.png"
            alt="Saphala"
            style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "8px", background: "#fff", flexShrink: 0 }}
          />
          <span>Saphala Admin</span>
        </div>
        <nav style={styles.nav}>
          {navSections.map((section) => (
            <div key={section.heading}>
              <div style={styles.sectionHeading}>{section.heading}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const isComingSoon = (item as any).comingSoon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      ...styles.navLink,
                      ...(isActive ? styles.navLinkActive : {}),
                      ...(isComingSoon ? styles.navLinkDimmed : {}),
                    }}
                  >
                    {item.label}
                    {isComingSoon && (
                      <span style={styles.comingSoonBadge}>Soon</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Sign Out
        </button>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "system-ui, sans-serif",
  },
  sidebar: {
    width: "220px",
    backgroundColor: "#1e293b",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  brand: {
    padding: "0.875rem 1rem",
    fontSize: "1rem",
    fontWeight: 700,
    borderBottom: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
  },
  nav: {
    flex: 1,
    padding: "0.5rem 0",
    overflowY: "auto",
  },
  sectionHeading: {
    padding: "0.75rem 1rem 0.25rem",
    fontSize: "0.625rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#64748b",
    textTransform: "uppercase" as const,
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.4rem 1rem",
    color: "#cbd5e1",
    textDecoration: "none",
    fontSize: "0.875rem",
    borderLeft: "3px solid transparent",
  },
  navLinkActive: {
    backgroundColor: "#334155",
    color: "#fff",
    borderLeftColor: "#3b82f6",
  },
  navLinkDimmed: {
    opacity: 0.5,
  },
  comingSoonBadge: {
    fontSize: "0.55rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: "#94a3b8",
    backgroundColor: "#334155",
    padding: "0.1rem 0.35rem",
    borderRadius: "3px",
    textTransform: "uppercase" as const,
  },
  logoutBtn: {
    margin: "0.5rem 1rem 1rem",
    padding: "0.5rem",
    backgroundColor: "#475569",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.8125rem",
  },
  main: {
    flex: 1,
    padding: "2rem",
    backgroundColor: "#f8fafc",
  },
};
