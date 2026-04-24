"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type BasicPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

const navLinks = [
  { href: "/", label: "Painel", icon: "fi-rr-dashboard" },
  { href: "/inventario", label: "Inventario", icon: "fi-rr-clipboard-list" },
  { href: "/inventario/devolucao", label: "Devolucao", icon: "fi-rr-undo-alt" },
  { href: "/inventario/categorias", label: "Gerenciar Categorias", icon: "fi-rr-category" },
  { href: "/impressoras", label: "Impressoras", icon: "fi-rr-print" },
  { href: "/inventario/importacoes", label: "Importacoes", icon: "fi-rr-file-upload" }
];

const THEME_KEY = "inventario-ui-theme";

type Theme = "light" | "dark";

export function BasicPageShell({ title, subtitle, children, actions }: BasicPageShellProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const fallbackTheme: Theme = prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", fallbackTheme);
    document.documentElement.style.colorScheme = fallbackTheme;
    setTheme(fallbackTheme);
  }, []);

  const alternarTema = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
    setTheme(nextTheme);
  };

  return (
    <div className="ui-shell">
      <aside className="ui-sidebar">
        <div className="ui-brand">
          <span className="ui-brand-icon">TI</span>
          <div className="ui-brand-copy">
            <p className="ui-brand-title">Inventario TI</p>
            <p className="ui-brand-subtitle">Sistema de Gestao</p>
          </div>
        </div>

        <nav className="ui-nav">
          {navLinks.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/" && pathname?.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`ui-nav-link${active ? " active" : ""}`}
                title={link.label}
              >
                <span className="ui-nav-link-short" aria-hidden>
                  <i className={`fi ${link.icon} ui-nav-link-icon`} />
                </span>
                <span className="ui-nav-link-label">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="ui-main">
        <header className="ui-topbar">
          <div className="ui-topbar-brand">Gestao de Inventario</div>
          <div className="ui-topbar-actions">
            <input className="ui-search" placeholder="Buscar..." />
            <button
              type="button"
              onClick={alternarTema}
              className="ui-theme-toggle"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            >
              <span className={`ui-theme-switch${theme === "dark" ? " dark" : ""}`} aria-hidden>
                <span className="ui-theme-switch-thumb">
                  <i className={`fi ${theme === "dark" ? "fi-rr-moon-stars" : "fi-rr-sun"}`} />
                </span>
              </span>
              <span className="ui-theme-toggle-text">{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
            </button>
          </div>
        </header>

        <main className="ui-content">
          <header className="ui-header">
            <div>
              <h1 className="ui-title">{title}</h1>
              {subtitle ? <p className="ui-subtitle">{subtitle}</p> : null}
            </div>
            {actions ? <div>{actions}</div> : null}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
