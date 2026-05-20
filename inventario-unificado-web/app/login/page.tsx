/**
 * [DOC-CODEMAP] Arquivo: inventario-unificado-web\app\login\page.tsx
 * [DOC-CODEMAP] Papel: Arquivo de suporte da aplicacao: participa do fluxo funcional do sistema.
 */
"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

const LOGIN_REMEMBER_KEY = "inventario-login-remember";
const LOGIN_EMAIL_KEY = "inventario-login-email";

/**
 * [DOC-FUNC] LoginPage
 * Objetivo: controla uma tela administrativa do sistema web.
 * Entradas: usa os parametros da assinatura e/ou estado ja carregado pela tela/servico.
 * Como executa: carrega dados da API/Edge, mantem estado de filtros e formulario, e renderiza a resposta visual para o usuario; quando algo falha, propaga mensagem contextualizada para facilitar suporte e apresentacao.
 * Saida/Efeito: devolve dados prontos para a proxima etapa ou renderiza/atualiza a interface sem alterar a regra de negocio principal.
 */
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrarMe, setLembrarMe] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    try {
      const remember = localStorage.getItem(LOGIN_REMEMBER_KEY) === "1";
      const savedEmail = localStorage.getItem(LOGIN_EMAIL_KEY) || "";
      if (remember && savedEmail) {
        setLembrarMe(true);
        setEmail(savedEmail);
      }
    } catch {
      // Ignore localStorage unavailability.
    }
  }, []);

  /**
   * [DOC-FUNC] onSubmit
   * O que faz: A funcao 'onSubmit' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
   * Entradas: Recebe os parametros: event. Esses argumentos formam o contrato de entrada e sao tratados/validados antes de influenciar a regra principal.
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setInfo(null);
    setCarregando(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error || !data.session) {
        setErro(error?.message || "Não foi possível entrar.");
        return;
      }

      try {
        if (lembrarMe) {
          localStorage.setItem(LOGIN_REMEMBER_KEY, "1");
          localStorage.setItem(LOGIN_EMAIL_KEY, email.trim());
        } else {
          localStorage.removeItem(LOGIN_REMEMBER_KEY);
          localStorage.removeItem(LOGIN_EMAIL_KEY);
        }
      } catch {
        // Ignore storage failure.
      }

      router.push("/");
      router.refresh();
    } catch {
      setErro("Falha de conexão ao autenticar.");
    } finally {
      setCarregando(false);
    }
  };

  /**
   * [DOC-FUNC] handleRecuperarSenha
   * O que faz: A funcao 'handleRecuperarSenha' realiza uma leitura de dados. Ela localiza a fonte correta, aplica filtros/normalizacoes necessarios e entrega um resultado pronto para consumo pela proxima etapa.
   * Entradas: Nao recebe parametros diretos; usa contexto do modulo (estado em memoria, constantes, ambiente ou dependencias ja carregadas).
   * Como executa: Fluxo resumido: 1) valida pre-condicoes e consistencia minima da entrada; 2) consulta as fontes de dados necessarias e aplica os filtros do contexto; 3) normaliza formato/tipo para manter comparacao e armazenamento consistentes; 4) trata erros de forma explicita para facilitar diagnostico e operacao.
   * Retorno/Efeitos: Retorna dados tratados e prontos para uso, reduzindo retrabalho e interpretacoes ambiguas nas etapas seguintes.
   */
  const handleRecuperarSenha = async () => {
    setErro(null);
    setInfo(null);

    const emailNormalizado = email.trim();
    if (!emailNormalizado) {
      setErro("Informe seu e-mail para recuperar a senha.");
      return;
    }

    setRecuperando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailNormalizado, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setErro(error.message || "Não foi possível solicitar a recuperação de senha.");
        return;
      }

      setInfo("Se o e-mail estiver cadastrado, enviaremos o link de recuperação.");
    } catch {
      setErro("Falha de conexão ao solicitar recuperação de senha.");
    } finally {
      setRecuperando(false);
    }
  };

  return (
    <div className="ui-login-page">
      <div className="ui-login-layout">
        <section className="ui-login-hero">
          <div className="ui-login-hero-grid" />
          <div className="ui-login-hero-logo">
            <Image
              src="/brand/ntech-white.png"
              alt="NTECH"
              width={320}
              height={51}
              className="ui-login-logo"
              priority
            />
          </div>
          <p className="ui-login-hero-eyebrow">Plataforma SaaS de inventário e ativos</p>
          <h2 className="ui-login-hero-title">Dados protegidos, operação rápida e visão completa do parque.</h2>
          <ul className="ui-login-hero-list">
            <li>Controle de inventário por setor, piso e localização.</li>
            <li>Histórico de movimentações e rastreabilidade operacional.</li>
            <li>Monitoramento de impressoras e suprimentos em tempo real.</li>
          </ul>
        </section>

        <section className="ui-login-card">
          <div className="ui-login-card-brand">
            <Image src="/brand/ntech-n.png" alt="NTECH" width={42} height={42} />
            <h1 className="ui-login-title">Acesso Seguro</h1>
          </div>

          <p className="ui-login-subtitle">
            Entre com seu e-mail corporativo para acessar inventário, dashboards e rotinas operacionais.
          </p>

          <form onSubmit={onSubmit} className="ui-login-form">
            <label className={`ui-login-float ${email ? "filled" : ""}`}>
              <input
                className="ui-field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="nome@empresa.com"
                required
              />
              <span>E-mail</span>
            </label>

            <label className={`ui-login-float ${senha ? "filled" : ""}`}>
              <input
                className="ui-field ui-login-field-password"
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                autoComplete="current-password"
                placeholder="Sua senha"
                required
              />
              <span>Senha</span>
              <button
                type="button"
                className="ui-login-toggle-pass"
                onClick={() => setMostrarSenha((prev) => !prev)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                <i className={`fi ${mostrarSenha ? "fi-rr-eye-crossed" : "fi-rr-eye"}`} aria-hidden />
              </button>
            </label>

            <div className="ui-login-row">
              <label className="ui-login-remember">
                <input
                  type="checkbox"
                  checked={lembrarMe}
                  onChange={(event) => setLembrarMe(event.target.checked)}
                />
                <span>Lembrar-me</span>
              </label>

              <button
                type="button"
                className="ui-login-link"
                onClick={() => void handleRecuperarSenha()}
                disabled={recuperando}
              >
                {recuperando ? "Enviando..." : "Recuperar senha"}
              </button>
            </div>

            {erro ? <p className="ui-login-error">{erro}</p> : null}
            {info ? <p className="ui-login-info">{info}</p> : null}

            <button className="ui-btn ui-btn-primary ui-login-submit" type="submit" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

