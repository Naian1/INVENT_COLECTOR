"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type BasicPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

const navLinks = [
  { href: "/", label: "Painel", short: "P" },
  { href: "/inventario", label: "Inventario", short: "I" },
  { href: "/inventario/devolucao", label: "Devolucao", short: "D" },
  { href: "/inventario/categorias", label: "Gerenciar Categorias", short: "C" },
  { href: "/impressoras", label: "Impressoras", short: "R" },
  { href: "/inventario/importacoes", label: "Importacoes", short: "M" }
];

export function BasicPageShell({ title, subtitle, children, actions }: BasicPageShellProps) {
  const pathname = usePathname();

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
                <span className="ui-nav-link-short">{link.short}</span>
                <span className="ui-nav-link-label">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="ui-main">
        <header className="ui-topbar">
          <div className="ui-topbar-brand">Gestao de Inventario</div>
          <input className="ui-search" placeholder="Buscar..." />
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
