'use client';

import { useEffect, useMemo, useState } from 'react';
import { BasicPageShell } from '@/components/BasicPageShell';
import { StatusFeedback } from '@/components/StatusFeedback';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';

type Perfil = {
  cd_perfil: number;
  nm_perfil: string;
  ds_perfil?: string | null;
  ie_situacao?: 'A' | 'I';
};

type Usuario = {
  cd_usuario: number;
  nm_usuario: string;
  ds_email: string;
  ds_login: string;
  cd_perfil: number;
  ie_situacao: 'A' | 'I';
  dt_ultimo_login?: string | null;
  dt_cadastro?: string | null;
  perfil?: Perfil | null;
};

type UsuarioRow = Omit<Usuario, 'perfil'> & {
  perfil: { cd_perfil: number; nm_perfil: string } | null;
};

type UsuarioPerfil = {
  cd_usuario: number;
  cd_perfil: number;
  ie_situacao?: 'A' | 'I';
  perfil?: Perfil | null;
};

type UsuarioFormState = {
  nm_usuario: string;
  ds_email: string;
  ds_login: string;
  cd_perfil: string;
  senha: string;
  ie_situacao: 'A' | 'I';
  perfis: number[];
};

const INITIAL_FORM: UsuarioFormState = {
  nm_usuario: '',
  ds_email: '',
  ds_login: '',
  cd_perfil: '',
  senha: '',
  ie_situacao: 'A',
  perfis: [],
};

function formatarDataHora(value: string | null | undefined): string {
  if (!value) return '-';
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data);
}

async function requestUsuariosApi<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  token: string | null,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!token) {
    throw new Error('Sessão inválida. Recarregue a página.');
  }

  const response = await fetch('/api/usuarios', {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.sucesso) {
    const message = payload?.erro || `Falha ao executar /api/usuarios (${response.status}).`;
    throw new Error(message);
  }

  return payload.dados as T;
}

export default function UsuariosPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState<UsuarioFormState>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [usuarioPerfis, setUsuarioPerfis] = useState<Record<number, Perfil[]>>({});
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || null;
        if (active) setAccessToken(token);
        if (!token) {
          setIsAdmin(false);
          setAuthChecked(true);
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.sucesso || !active) {
          setIsAdmin(false);
          setAuthChecked(true);
          return;
        }

        const perfilNome = String(payload?.dados?.perfil?.nm_perfil || '').trim().toUpperCase();
        setIsAdmin(perfilNome === 'ADMIN');
      } catch {
        setIsAdmin(false);
      } finally {
        if (active) setAuthChecked(true);
      }
    };

    void loadAuth();
    return () => {
      active = false;
    };
  }, []);

  const carregarUsuarios = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const dados = await requestUsuariosApi<{
        usuarios: UsuarioRow[];
        perfis: Perfil[];
        usuarioPerfis: UsuarioPerfil[];
      }>('GET', accessToken);

      const usuariosNormalizados: Usuario[] = (dados.usuarios || []).map((row) => ({
        ...row,
        perfil: row.perfil ?? null,
      }));

      setUsuarios(usuariosNormalizados);
      setPerfis(dados.perfis || []);

      const perfisByUsuario: Record<number, Perfil[]> = {};
      (dados.usuarioPerfis || []).forEach((row) => {
        if (!row.perfil) return;
        const atual = perfisByUsuario[row.cd_usuario] || [];
        atual.push(row.perfil);
        perfisByUsuario[row.cd_usuario] = atual;
      });
      setUsuarioPerfis(perfisByUsuario);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar usuários.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked || !isAdmin || !accessToken) return;
    void carregarUsuarios();
  }, [authChecked, isAdmin, accessToken]);

  const usuariosFiltrados = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter((usuario) => {
      const perfisUsuario = usuarioPerfis[usuario.cd_usuario] || [];
      const conteudo = [
        usuario.nm_usuario,
        usuario.ds_email,
        usuario.ds_login,
        usuario.perfil?.nm_perfil || '',
        ...perfisUsuario.map((perfil) => perfil.nm_perfil || '')
      ]
        .join(' ')
        .toLowerCase();
      return conteudo.includes(termo);
    });
  }, [searchTerm, usuarios, usuarioPerfis]);

  if (!authChecked) {
    return (
      <BasicPageShell
        title="Gerenciar usuários"
        subtitle="Controle de acesso, perfis e status dos usuários cadastrados."
      >
        <div className="ui-card">Validando permissão...</div>
      </BasicPageShell>
    );
  }

  if (!isAdmin) {
    return (
      <BasicPageShell
        title="Gerenciar usuários"
        subtitle="Controle de acesso, perfis e status dos usuários cadastrados."
      >
        <div className="ui-card">Acesso restrito. Esta tela exige perfil ADMIN.</div>
      </BasicPageShell>
    );
  }

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditingUsuario(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (usuario: Usuario) => {
    const perfisSelecionados = usuarioPerfis[usuario.cd_usuario] || [];
    setEditingUsuario(usuario);
    setFormData({
      nm_usuario: usuario.nm_usuario || '',
      ds_email: usuario.ds_email || '',
      ds_login: usuario.ds_login || '',
      cd_perfil: String(usuario.cd_perfil || ''),
      senha: '',
      ie_situacao: usuario.ie_situacao || 'A',
      perfis: perfisSelecionados.map((perfil) => perfil.cd_perfil),
    });
    setModalOpen(true);
  };

  const handleChangeForm = (campo: keyof UsuarioFormState, valor: string) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
  };

  const togglePerfilSelecionado = (perfilId: number) => {
    setFormData((prev) => {
      const atual = new Set(prev.perfis);
      if (atual.has(perfilId)) {
        atual.delete(perfilId);
      } else {
        atual.add(perfilId);
      }
      return { ...prev, perfis: Array.from(atual) };
    });
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!formData.nm_usuario.trim() || !formData.ds_email.trim() || !formData.ds_login.trim()) {
      setErrorMessage('Preencha nome, email e login.');
      return;
    }

    if (!formData.cd_perfil) {
      setErrorMessage('Selecione um perfil.');
      return;
    }

    if (!editingUsuario && !formData.senha.trim()) {
      setErrorMessage('Informe uma senha para o novo usuário.');
      return;
    }

    setLoading(true);
    try {
      const perfilPrincipal = Number(formData.cd_perfil);
      const perfisSelecionados = Array.from(new Set([perfilPrincipal, ...formData.perfis]))
        .filter((id) => Number.isFinite(id));

      const payload: Record<string, unknown> = {
        nm_usuario: formData.nm_usuario.trim(),
        ds_email: formData.ds_email.trim(),
        ds_login: formData.ds_login.trim(),
        cd_perfil: perfilPrincipal,
        ie_situacao: formData.ie_situacao,
        perfis: perfisSelecionados,
      };

      if (formData.senha.trim()) {
        payload.senha = formData.senha.trim();
      }

      if (editingUsuario) {
        await requestUsuariosApi('PUT', accessToken, {
          ...payload,
          cd_usuario: editingUsuario.cd_usuario,
        });
        setSuccessMessage('Usuário atualizado com sucesso.');
      } else {
        await requestUsuariosApi('POST', accessToken, payload);
        setSuccessMessage('Usuário criado com sucesso.');
      }

      setModalOpen(false);
      resetForm();
      await carregarUsuarios();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar usuário.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (usuario: Usuario) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextStatus: 'A' | 'I' = usuario.ie_situacao === 'A' ? 'I' : 'A';
    setLoading(true);
    try {
      await requestUsuariosApi('PATCH', accessToken, {
        cd_usuario: usuario.cd_usuario,
        ie_situacao: nextStatus,
      });
      setSuccessMessage(`Usuário ${nextStatus === 'A' ? 'ativado' : 'inativado'} com sucesso.`);
      await carregarUsuarios();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar status do usuário.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BasicPageShell
      title="Gerenciar usuários"
      subtitle="Controle de acesso, perfis e status dos usuários cadastrados."
      actions={
        <button type="button" onClick={openCreateModal} className="ui-btn ui-btn-primary">
          Novo usuário
        </button>
      }
    >
      <StatusFeedback loading={loading} error={errorMessage} success={successMessage} />

      <div className="ui-card space-y-3">
        <div className="ui-row">
          <label className="flex flex-col gap-1 text-sm" style={{ minWidth: 240 }}>
            <span className="font-medium text-slate-700">Buscar</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="ui-field"
              placeholder="Nome, email, login ou perfil..."
            />
          </label>
        </div>

        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Email</th>
                <th>Perfis</th>
                <th>Status</th>
                <th>Último login</th>
                <th>Cadastro</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-sm text-slate-500" style={{ padding: 16 }}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.cd_usuario}>
                    <td>{usuario.nm_usuario}</td>
                    <td>{usuario.ds_login}</td>
                    <td>{usuario.ds_email}</td>
                    <td>
                      <div className="ui-row">
                        {(usuarioPerfis[usuario.cd_usuario] || []).length > 0
                          ? (usuarioPerfis[usuario.cd_usuario] || []).map((perfil) => (
                              <span key={`${usuario.cd_usuario}-${perfil.cd_perfil}`} className="ui-pill ok">
                                {perfil.nm_perfil}
                              </span>
                            ))
                          : (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                      </div>
                    </td>
                    <td>
                      <span className={`ui-pill ${usuario.ie_situacao === 'A' ? 'ok' : 'danger'}`}>
                        {usuario.ie_situacao === 'A' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>{formatarDataHora(usuario.dt_ultimo_login)}</td>
                    <td>{formatarDataHora(usuario.dt_cadastro)}</td>
                    <td>
                      <div className="ui-row">
                        <button type="button" className="ui-btn ui-btn-sm" onClick={() => openEditModal(usuario)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`ui-btn ui-btn-sm ${usuario.ie_situacao === 'A' ? 'ui-btn-warning' : 'ui-btn-primary'}`}
                          onClick={() => handleToggleStatus(usuario)}
                        >
                          {usuario.ie_situacao === 'A' ? 'Inativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUsuario ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogDescription>
              {editingUsuario
                ? 'Atualize os dados do usuário selecionado.'
                : 'Cadastre um novo usuário com perfil e senha inicial.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
            className="inv-modal-form"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Nome</span>
              <input
                value={formData.nm_usuario}
                onChange={(event) => handleChangeForm('nm_usuario', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={formData.ds_email}
                onChange={(event) => handleChangeForm('ds_email', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Login</span>
              <input
                value={formData.ds_login}
                onChange={(event) => handleChangeForm('ds_login', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Perfil</span>
              <select
                value={formData.cd_perfil}
                onChange={(event) => handleChangeForm('cd_perfil', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                required
              >
                <option value="">Selecione</option>
                {perfis.map((perfil) => (
                  <option key={perfil.cd_perfil} value={perfil.cd_perfil}>
                    {perfil.nm_perfil}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-700">Perfis adicionais</p>
              <p className="text-xs text-slate-500">O perfil principal sempre fica ativo.</p>
              <div className="mt-2 grid gap-2">
                {perfis.map((perfil) => {
                  const principal = Number(formData.cd_perfil) === perfil.cd_perfil;
                  const checked = principal || formData.perfis.includes(perfil.cd_perfil);
                  return (
                    <label key={perfil.cd_perfil} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={principal}
                        onChange={() => togglePerfilSelecionado(perfil.cd_perfil)}
                      />
                      {perfil.nm_perfil}
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                {editingUsuario ? 'Nova senha (opcional)' : 'Senha inicial'}
              </span>
              <input
                type="password"
                value={formData.senha}
                onChange={(event) => handleChangeForm('senha', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder={editingUsuario ? 'Deixe em branco para manter' : 'Defina uma senha'}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                value={formData.ie_situacao}
                onChange={(event) => handleChangeForm('ie_situacao', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="A">Ativo</option>
                <option value="I">Inativo</option>
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="ui-btn ui-btn-primary" disabled={loading}>
                {loading ? 'Salvando...' : editingUsuario ? 'Salvar alterações' : 'Salvar usuário'}
              </button>
              <button
                type="button"
                className="ui-btn"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </BasicPageShell>
  );
}
