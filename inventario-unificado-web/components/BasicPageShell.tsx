/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\components\BasicPageShell.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/lib/supabase/client";
import { invokeAuthedEdgeAction } from "@/lib/supabase/invokeEdge";

type BasicPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

type NavLink = {
  href: string;
  label: string;
  icon: string;
};

const navGroups: Array<{ title: string; links: NavLink[] }> = [
  {
    title: "Principal",
    links: [{ href: "/", label: "Painel", icon: "fi-rr-dashboard" }],
  },
  {
    title: "Inventário",
    links: [
      { href: "/inventario", label: "Visão geral", icon: "fi-rr-clipboard-list" },
      { href: "/inventario/conciliacao", label: "Conciliação", icon: "fi-rr-search-alt" },
      { href: "/inventario/devolucao", label: "Devolução", icon: "fi-rr-undo-alt" },
      { href: "/inventario/categorias", label: "Categorias", icon: "fi-rr-category" },
      { href: "/inventario/importacoes", label: "Importações", icon: "fi-rr-file-upload" },
    ],
  },
  {
    title: "Operação",
    links: [{ href: "/impressoras", label: "Impressoras", icon: "fi-rr-print" }],
  },
  {
    title: "Administração",
    links: [{ href: "/usuarios", label: "Usuários", icon: "fi-rr-user" }],
  },
];

const adminOnlyHrefs = new Set<string>(["/inventario/categorias", "/usuarios"]);

const THEME_KEY = "inventario-ui-theme";
const NOTIFICATIONS_SEEN_KEY = "inventario-ui-notifications-seen-v1";

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

type PendenciaTroca = {
  id: number;
  nr_ocorrencias?: number;
  dt_ultima_detecao?: string | null;
  setor_referencia_label?: string | null;
  referencia?: { nr_patrimonio?: string | null } | null;
  detectado?: {
    nr_ip?: string | null;
    nr_patrimonio?: string | null;
    nr_serie?: string | null;
    nm_mac?: string | null;
  } | null;
};

type AlertaSuprimento = {
  nr_inventario: number;
  patrimonio: string;
  ip: string;
  setor: string;
  modelo: string;
  suprimento: string;
  nivel_percentual: number | null;
  status: "critico" | "atencao" | "ok" | "desconhecido";
  dt_ultima_leitura: string | null;
};

type NotificationItem = {
  id: string;
  tipo: "troca" | "suprimento";
  titulo: string;
  descricao: string;
  dataRef: string | null;
};

/**
 * [DOC-FUNC] BasicPageShell
 * O que faz: A funcao 'BasicPageShell' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
 * Entradas: Recebe os parametros: { title, subtitle, children, actions }. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
 * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
 * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
 */
export function BasicPageShell({ title, subtitle, children, actions }: BasicPageShellProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const [usuarioSessao, setUsuarioSessao] = useState<UsuarioSessao | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSwitching, setProfileSwitching] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  const seenNotificationsRef = useRef<Set<string>>(new Set());

  /**
   * [DOC-FUNC] getAccessToken
   * O que faz: A funcao 'getAccessToken' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

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

    /**
     * [DOC-FUNC] loadSession
     * O que faz: A funcao 'loadSession' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
     * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
     * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
     * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
     */
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
  }, [getAccessToken]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_SEEN_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      seenNotificationsRef.current = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      seenNotificationsRef.current = new Set();
    }
  }, []);

  useEffect(() => {
    if (!profileMenuOpen && !notificationsOpen) return;

    /**
     * [DOC-FUNC] handleClick
     * O que faz: A funcao 'handleClick' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
     * Entradas: Recebe os parametros: event. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
     * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
     * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
     */
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current?.contains(target)) return;
      if (notificationsMenuRef.current?.contains(target)) return;
      setProfileMenuOpen(false);
      setNotificationsOpen(false);
    };

    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [profileMenuOpen, notificationsOpen]);

  /**
   * [DOC-FUNC] alternarTema
   * O que faz: A funcao 'alternarTema' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const alternarTema = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
    setTheme(nextTheme);
  };

  /**
   * [DOC-FUNC] logout
   * O que faz: A funcao 'logout' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  /**
   * [DOC-FUNC] getUserInitials
   * O que faz: A funcao 'getUserInitials' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
   * Entradas: Recebe os parametros: name. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const getUserInitials = (name: string | null | undefined) => {
    const safeName = String(name || "").trim();
    if (!safeName) return "?";
    const parts = safeName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  };

  const formatarDataCurta = useCallback((valor: string | null | undefined) => {
    if (!valor) return null;
    const date = new Date(valor);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date);
  }, []);

  const persistSeenNotifications = useCallback((ids: Set<string>) => {
    const lista = Array.from(ids).slice(-500);
    localStorage.setItem(NOTIFICATIONS_SEEN_KEY, JSON.stringify(lista));
  }, []);

  const carregarNotificacoes = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const [resResumo, resTrocas] = await Promise.all([
        fetch("/api/telemetria/resumo-diario?dias=2", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        invokeAuthedEdgeAction<PendenciaTroca[]>(
          "inventory-core",
          "list_substituicao_pendente",
          { somente_pendentes: true, limite: 30 },
          "Falha ao carregar notificacoes de troca.",
        ).catch(() => []),
      ]);

      const itensNotificacao: NotificationItem[] = [];

      const bodyResumo = await resResumo.json().catch(() => null);
      const suprimentos = (bodyResumo?.sucesso ? bodyResumo?.dados?.suprimentos_alertas?.itens : []) as
        | AlertaSuprimento[]
        | undefined;

      const criticosPorInventario = new Map<
        number,
        { patrimonio: string; ip: string; setor: string; partes: string[]; dtUltimaLeitura: string | null }
      >();
      for (const item of suprimentos || []) {
        if (String(item.status || "") !== "critico") continue;
        const atual = criticosPorInventario.get(item.nr_inventario) || {
          patrimonio: item.patrimonio || `INV-${item.nr_inventario}`,
          ip: item.ip || "-",
          setor: item.setor || "Setor não informado",
          partes: [],
          dtUltimaLeitura: item.dt_ultima_leitura || null,
        };
        const nivel = item.nivel_percentual === null ? "-" : `${Math.round(Number(item.nivel_percentual) || 0)}%`;
        atual.partes.push(`${item.suprimento} ${nivel}`);
        if (!atual.dtUltimaLeitura && item.dt_ultima_leitura) {
          atual.dtUltimaLeitura = item.dt_ultima_leitura;
        }
        criticosPorInventario.set(item.nr_inventario, atual);
      }

      for (const [nrInventario, alerta] of criticosPorInventario.entries()) {
        const resumo = alerta.partes.slice(0, 4).join(" | ");
        const id = `sup:${nrInventario}:${resumo}`;
        const dataRef = formatarDataCurta(alerta.dtUltimaLeitura);
        itensNotificacao.push({
          id,
          tipo: "suprimento",
          titulo: `Impressora ${alerta.patrimonio} | IP ${alerta.ip}`,
          descricao: `${alerta.setor} • ${resumo}`,
          dataRef,
        });
      }

      for (const item of resTrocas || []) {
        const dataRef = formatarDataCurta(item.dt_ultima_detecao || null);
        const patrimonioRef = String(item.referencia?.nr_patrimonio || `INV-${item.id}`);
        const detectadoResumo = [
          item.detectado?.nr_patrimonio ? `Pat ${item.detectado.nr_patrimonio}` : null,
          item.detectado?.nr_serie ? `Série ${item.detectado.nr_serie}` : null,
          item.detectado?.nr_ip ? `IP ${item.detectado.nr_ip}` : null,
        ]
          .filter(Boolean)
          .join(" • ");
        const id = `swap:${item.id}:${item.dt_ultima_detecao || ""}:${item.nr_ocorrencias || 1}`;
        itensNotificacao.push({
          id,
          tipo: "troca",
          titulo: `Troca pendente na vaga ${patrimonioRef}`,
          descricao: `${item.setor_referencia_label || "Setor não informado"}${detectadoResumo ? ` • ${detectadoResumo}` : ""}`,
          dataRef,
        });
      }

      itensNotificacao.sort((a, b) => {
        if (a.tipo === b.tipo) return (a.titulo || "").localeCompare(b.titulo || "");
        return a.tipo === "troca" ? -1 : 1;
      });

      const seen = seenNotificationsRef.current;
      const unread = itensNotificacao.filter((item) => !seen.has(item.id)).length;
      setNotifications(itensNotificacao.slice(0, 40));
      setUnreadCount(unread);
    } finally {
      setNotificationsLoading(false);
    }
  }, [formatarDataCurta, getAccessToken]);

  useEffect(() => {
    if (!sessionChecked) return;
    void carregarNotificacoes();
    const timer = window.setInterval(() => {
      void carregarNotificacoes();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [sessionChecked, carregarNotificacoes]);

  /**
   * [DOC-FUNC] handleSwitchPerfil
   * O que faz: A funcao 'handleSwitchPerfil' encapsula uma etapa de processamento interno. Ela organiza as entradas, aplica regras do modulo e gera uma saida previsivel para a camada chamadora.
   * Entradas: Recebe os parametros: cdPerfil. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 3) percorre colecoes quando necessario para consolidar ou transformar resultados; 4) interage com servicos externos/rede com controle de falha e retentativa quando aplicavel.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
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

  const handleToggleNotifications = () => {
    setNotificationsOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen) {
        const seen = new Set(seenNotificationsRef.current);
        for (const item of notifications) {
          seen.add(item.id);
        }
        seenNotificationsRef.current = seen;
        persistSeenNotifications(seen);
        setUnreadCount(0);
      }
      return nextOpen;
    });
  };

  const perfilNomeAtivo = String(usuarioSessao?.perfil?.nm_perfil || "").trim().toUpperCase();
  const isAdmin = perfilNomeAtivo === "ADMIN";
  const navGroupsFiltrados = navGroups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => isAdmin || !adminOnlyHrefs.has(link.href)),
    }))
    .filter((group) => group.links.length > 0);
  const notificacoesTroca = notifications.filter((item) => item.tipo === "troca");
  const notificacoesSuprimento = notifications.filter((item) => item.tipo === "suprimento");

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
          <span className="ui-brand-icon">
            <Image
              src="/brand/ntech-n.png"
              alt="NTECHN"
              width={22}
              height={22}
              className="ui-brand-icon-image"
              priority
            />
          </span>
          <div className="ui-brand-copy">
            <Image
              src="/brand/ntech-black.png"
              alt="NTECH"
              width={92}
              height={20}
              className="ui-brand-logo ui-brand-logo-light"
              priority
            />
            <Image
              src="/brand/ntech-white.png"
              alt="NTECH"
              width={92}
              height={20}
              className="ui-brand-logo ui-brand-logo-dark"
              priority
            />
            <p className="ui-brand-subtitle">Inventário</p>
          </div>
        </div>

        <nav className="ui-nav" aria-label="Menu principal">
          {navGroupsFiltrados.map((group) => (
            <div className="ui-nav-group" key={group.title}>
              <span className="ui-nav-group-title">{group.title}</span>
              <div className="ui-nav-subnav">
                {group.links.map((link) => {
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
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="ui-main">
        <header className="ui-topbar">
          <div className="ui-topbar-brand">Gestão de Inventário</div>
          <div className="ui-topbar-actions">
            <div className="ui-notifications" ref={notificationsMenuRef}>
              <button
                type="button"
                className={`ui-notifications-button${unreadCount > 0 ? " has-unread" : ""}`}
                onClick={handleToggleNotifications}
                aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
                title="Notificações"
              >
                <i className="fi fi-rr-bell" />
                {unreadCount > 0 ? <span className="ui-notifications-badge">{unreadCount}</span> : null}
              </button>

              {notificationsOpen ? (
                <div className="ui-notifications-menu">
                  <div className="ui-notifications-header">
                    <p>Notificações</p>
                    <button
                      type="button"
                      className="ui-link-btn"
                      onClick={() => void carregarNotificacoes()}
                      disabled={notificationsLoading}
                    >
                      {notificationsLoading ? "Atualizando..." : "Atualizar"}
                    </button>
                  </div>

                  <div className="ui-notifications-section">
                    <h4>Troca de impressora</h4>
                    {notificacoesTroca.length ? (
                      notificacoesTroca.slice(0, 8).map((item) => (
                        <article key={item.id} className="ui-notification-item">
                          <strong>{item.titulo}</strong>
                          <span>{item.descricao}</span>
                          {item.dataRef ? <small>{item.dataRef}</small> : null}
                        </article>
                      ))
                    ) : (
                      <p className="ui-notification-empty">Sem alertas pendentes.</p>
                    )}
                  </div>

                  <div className="ui-notifications-section">
                    <h4>Suprimento</h4>
                    {notificacoesSuprimento.length ? (
                      notificacoesSuprimento.slice(0, 10).map((item) => (
                        <article key={item.id} className="ui-notification-item">
                          <strong>{item.titulo}</strong>
                          <span>{item.descricao}</span>
                          {item.dataRef ? <small>{item.dataRef}</small> : null}
                        </article>
                      ))
                    ) : (
                      <p className="ui-notification-empty">Sem suprimentos críticos.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
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
