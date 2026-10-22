'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseReady } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase || !supabaseReady) {
      setMessage(
        'Die Datenbank ist noch nicht verbunden. Bitte überprüfe die Supabase-Einrichtung.'
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setMessage(
          error?.message || 'Die Anmeldung war nicht erfolgreich.'
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        setMessage(
          'Dein Profil konnte nicht geladen werden. Bitte versuche es später erneut.'
        );
        await supabase.auth.signOut();
        return;
      }

      if (!profile) {
        setMessage(
          'Für dein Konto wurde noch kein Mitgliederprofil angelegt. Bitte kontaktiere den Verein.'
        );
        await supabase.auth.signOut();
        return;
      }

      if (profile.status !== 'approved') {
        await supabase.auth.signOut();
        setMessage(
          'Deine Registrierung ist eingegangen. Dein Zugang wird vom Verein geprüft und freigeschaltet.'
        );
        return;
      }

      if (profile.role === 'admin') {
        router.replace('/admin');
      } else if (profile.role === 'member') {
        router.replace('/');
      } else {
        await supabase.auth.signOut();
        setMessage(
          'Dein Konto hat keine gültige Rolle. Bitte kontaktiere den Verein.'
        );
        return;
      }

      router.refresh();
    } catch {
      setMessage(
        'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es erneut.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="container"
      style={{ maxWidth: 560, paddingTop: 36 }}
    >
      <Link className="brand" href="/">
        <img src="/padelclubbing-logo.jpg" alt="PADELCLUBBING Logo" />
        <span>PADELCLUBBING</span>
      </Link>

      <section className="section">
        <p className="eyebrow">Mitgliederbereich</p>
        <h1>Willkommen zurück.</h1>

        <p className="muted">
          Melde dich an, um auf deinen persönlichen Mitgliederbereich
          zuzugreifen.
        </p>

        {!supabaseReady && (
          <div className="notice" role="alert">
            Die App ist noch nicht mit Supabase verbunden.
            Bitte überprüfe die Einrichtung.
          </div>
        )}

        <form
          className="form"
          onSubmit={submit}
          style={{ marginTop: 20 }}
        >
          <div className="field">
            <label htmlFor="email">E-Mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.at"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
            />
          </div>

          <button
            className="btn primary"
            type="submit"
            disabled={busy || !supabaseReady}
          >
            {busy ? 'Anmeldung …' : 'Anmelden'}
          </button>

          {message && (
            <div className="notice" role="status" aria-live="polite">
              {message}
            </div>
          )}
        </form>

        <p className="small" style={{ marginTop: 20 }}>
          Noch kein Zugang? Registriere dich und warte auf die
          Freigabe durch den Verein.
        </p>

        <Link className="btn" href="/mitglied-werden">
          Mitglied werden
        </Link>
      </section>
    </main>
  );
}
