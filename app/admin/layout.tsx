"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Taxonomy", href: "/admin/taxonomy" },
  { label: "Question Bank", href: "/admin/question-bank" },
  { label: "Imports", href: "/admin/imports" },
  { label: "Test Series", href: "/admin/test-series" },
  { label: "Tests", href: "/admin/tests" },
  { label: "Flashcards", href: "/admin/flashcards" },
  { label: "Content Library", href: "/admin/content-library" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "XP Rules", href: "/admin/xp-rules" },
  { label: "Learners", href: "/admin/learners" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }, [router]);

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>Saphala Admin</div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                ...styles.navLink,
                ...(pathname === item.href ? styles.navLinkActive : {}),
              }}
            >
              {item.label}
            </a>
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
    width: "240px",
    backgroundColor: "#1e293b",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  brand: {
    padding: "1.25rem 1rem",
    fontSize: "1.125rem",
    fontWeight: 700,
    borderBottom: "1px solid #334155",
  },
  nav: {
    flex: 1,
    padding: "0.5rem 0",
    overflowY: "auto",
  },
  navLink: {
    display: "block",
    padding: "0.5rem 1rem",
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
