import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { StudioDashboard } from "../app/studio-dashboard";
import { supabase, supabaseConfigured } from "../lib/supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) return <SetupNotice />;
  if (loading) return <div className="auth-shell"><Loader2 className="auth-spinner" aria-label="Carregando" /></div>;
  if (!session) return <Login />;

  return <StudioDashboard userEmail={session.user.email ?? "Conta do studio"} onSignOut={() => void supabase.auth.signOut()} />;
}

function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setSaving(true); setError(""); setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Conta criada. Confirme o e-mail para entrar.");
    setSaving(false);
  };

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="auth-mark">SD</span><div><strong>Studio em Dia</strong><span>Gestão financeira para maquiadoras</span></div></div>
    <div className="auth-heading"><span><LockKeyhole /> Acesso protegido</span><h1>{mode === "login" ? "Entrar no studio" : "Criar primeiro acesso"}</h1><p>Use a mesma conta no celular e no computador.</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="auth-email">E-mail</label><input id="auth-email" name="email" type="email" autoComplete="email" required placeholder="studio@email.com" />
      <label htmlFor="auth-password">Senha</label><input id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required placeholder="Mínimo de 6 caracteres" />
      {error ? <p className="auth-error" role="alert">{error}</p> : null}{message ? <p className="auth-success" role="status">{message}</p> : null}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Sparkles />}{mode === "login" ? "Entrar" : "Criar conta"}</button>
    </form>
    <button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Ainda não tem acesso? Criar conta" : "Já tem uma conta? Entrar"}</button>
  </section></main>;
}

function SetupNotice() {
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="auth-mark">SD</span><div><strong>Studio em Dia</strong><span>Gestão financeira para maquiadoras</span></div></div><div className="auth-heading"><h1>Banco ainda não conectado</h1><p>Configure o projeto do Supabase para liberar o acesso.</p></div></section></main>;
}
