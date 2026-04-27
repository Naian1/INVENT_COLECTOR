"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ login, senha })
      });

      const payload = (await response.json()) as {
        sucesso: boolean;
        erro?: string;
      };

      if (!response.ok || !payload.sucesso) {
        setErro(payload.erro ?? "Nao foi possivel entrar.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErro("Falha de conexao ao autenticar.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="ui-login-page">
      <section className="ui-login-card">
        <p className="ui-login-badge">Inventario TI</p>
        <h1 className="ui-login-title">Acesso ao Sistema</h1>
        <p className="ui-login-subtitle">
          Entre com seu usuario para acessar painel, inventario e operacoes.
        </p>

        <form onSubmit={onSubmit} className="ui-login-form">
          <label>
            <span>Login ou Email</span>
            <input
              className="ui-field"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Senha</span>
            <input
              className="ui-field"
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {erro ? <p className="ui-login-error">{erro}</p> : null}

          <button className="ui-btn ui-btn-primary" type="submit" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
