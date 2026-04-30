"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/lib/supabase/client";

type BasicPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

const navLinks = [
  { href: "/", label: "Painel", icon: "fi-rr-dashboard" },
  { href: "/inventario", label: "Inventário", icon: "fi-rr-clipboard-list" },
  { href: "/inventario/devolucao", label: "Devolução", icon: "fi-rr-undo-alt" },
  { href: "/inventario/categorias", label: "Gerenciar Categorias", icon: "fi-rr-category" },
  { href: "/usuarios", label: "Gerenciar Usuários", icon: "fi-rr-user" },
  { href: "/impressoras", label: "Impressoras", icon: "fi-rr-print" },
  { href: "/inventario/importacoes", label: "Importações", icon: "fi-rr-file-upload" }
];

const adminOnlyHrefs = new Set<string>(["/inventario/categorias", "/usuarios"]);

const THEME_KEY = "inventario-ui-theme";

type Theme = "light" | "dark";

type PerfilInfo = {
  cd_perfil: number;
  nm_perfil: string;
};

type UsuarioSessao = {
  cd_usuario: number;
  nm_usuario: string;
  ds_email?: string | null;
  cd_perfil: number;
  perfil?: PerfilInfo | null;
  perfis?: PerfilInfo[];
};

export function BasicPageShell({ title, subtitle, children, actions }: BasicPageShellProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const [usuarioSessao, setUsuarioSessao] = useState<UsuarioSessao | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSwitching, setProfileSwitching] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  };

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
      return;
    }

    const fallbackTheme: Theme = "light";
    document.documentElement.setAttribute("data-theme", fallbackTheme);
    document.documentElement.style.colorScheme = fallbackTheme;
    setTheme(fallbackTheme);
  }, []);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (active) {
            window.location.href = "/login";
          }
          return;
        }
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          if (active) {
            window.location.href = "/login";
          }
          return;
        }
        const payload = await response.json();
        if (!payload?.sucesso || !payload?.dados) {
          if (active) {
            window.location.href = "/login";
          }
          return;
        }
        if (active) {
          setUsuarioSessao(payload.dados as UsuarioSessao);
          setSessionChecked(true);
        }
      } catch {
        if (active) {
          window.location.href = "/login";
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (profileMenuRef.current.contains(event.target as Node)) return;
      setProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [profileMenuOpen]);

  const alternarTema = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
    setTheme(nextTheme);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  const getUserInitials = (name: string | null | undefined) => {
    const safeName = String(name || "").trim();
    if (!safeName) return "?";
    const parts = safeName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  };

  const handleSwitchPerfil = async (cdPerfil: number) => {
    if (!usuarioSessao || cdPerfil === usuarioSessao.cd_perfil) {
      setProfileMenuOpen(false);
      return;
    }

    setProfileSwitching(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch("/api/auth/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cd_perfil: cdPerfil })
      });

      if (response.ok) {
        window.location.reload();
        return;
      }
    } finally {
      setProfileSwitching(false);
    }
  };

  const perfilNomeAtivo = String(usuarioSessao?.perfil?.nm_perfil || "").trim().toUpperCase();
  const isAdmin = perfilNomeAtivo === "ADMIN";
  const navLinksFiltrados = navLinks.filter((link) => isAdmin || !adminOnlyHrefs.has(link.href));

  if (!sessionChecked) {
    return (
      <div className="ui-shell">
        <div className="ui-main">
          <main className="ui-content">
            <div className="ui-card">Validando sessão...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-shell">
      <aside className="ui-sidebar">
        <div className="ui-brand">
          <span className="ui-brand-icon">TI</span>
          <div className="ui-brand-copy">
            <p className="ui-brand-title">Inventário TI</p>
            <p className="ui-brand-subtitle">Sistema de Gestão</p>
          </div>
        </div>

        <nav className="ui-nav">
          {navLinksFiltrados.map((link) => {
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
          <div className="ui-topbar-brand">Gestão de Inventário</div>
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
            <div className="ui-profile" ref={profileMenuRef}>
              <button
                type="button"
                className="ui-profile-button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                aria-expanded={profileMenuOpen}
              >
                <span className="ui-profile-avatar">
                  {getUserInitials(usuarioSessao?.nm_usuario)}
                </span>
                <span className="ui-profile-name">
                  {usuarioSessao?.nm_usuario || "Perfil"}
                </span>
                <i className={`fi ${profileMenuOpen ? "fi-rr-angle-small-up" : "fi-rr-angle-small-down"}`} />
              </button>

              {profileMenuOpen ? (
                <div className="ui-profile-menu">
                  <div className="ui-profile-header">
                    <p className="ui-profile-title">{usuarioSessao?.nm_usuario || "Conta"}</p>
                    {usuarioSessao?.ds_email ? (
                      <p className="ui-profile-subtitle">{usuarioSessao.ds_email}</p>
                    ) : null}
                  </div>

                  <div className="ui-profile-section">
                    <span className="ui-profile-label">Perfil</span>
                    {usuarioSessao?.perfis && usuarioSessao.perfis.length > 1 ? (
                      <select
                        value={usuarioSessao.cd_perfil}
                        onChange={(event) => handleSwitchPerfil(Number(event.target.value))}
                        disabled={profileSwitching}
                        className="ui-profile-select"
                      >
                        {usuarioSessao.perfis.map((perfil) => (
                          <option key={perfil.cd_perfil} value={perfil.cd_perfil}>
                            {perfil.nm_perfil}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="ui-profile-value">
                        {usuarioSessao?.perfil?.nm_perfil || "Padrão"}
                      </span>
                    )}
                  </div>

                  <button type="button" className="ui-btn ui-btn-danger ui-profile-logout" onClick={logout}>
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
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
