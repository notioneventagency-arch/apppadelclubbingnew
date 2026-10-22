'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function MitgliedWerden() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!supabase) {
      setError(
        'Die Verbindung zu Supabase fehlt. Bitte versuche es später erneut.'
      );
      return;
    }

    const form = new FormData(e.currentTarget);

    const firstName = String(form.get('first_name') || '').trim();
    const lastName = String(form.get('last_name') || '').trim();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const phone = String(form.get('phone') || '').trim();
    const skillLevel = String(form.get('skill_level') || 'Anfänger');
    const message = String(form.get('message') || '').trim();
    const password = String(form.get('password') || '');

    if (password.length < 8) {
      setError('Bitte verwende ein Passwort mit mindestens 8 Zeichen.');
      return;
    }

    setLoading(true);

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            first_name: firstName,
            last_name: lastName,
            phone,
            skill_level: skillLevel,
            message,
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Die Registrierung ist fehlgeschlagen. Bitte versuche es erneut.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="container" style={{ maxWidth: 800 }}>
        <section className="section">
          <h1>Antrag erfolgreich übermittelt!</h1>
          <p>
            Vielen Dank für deine Registrierung bei Padelclubbing.
          </p>
          <p>
            Bitte bestätige gegebenenfalls deine E-Mail-Adresse.
            Dein Mitgliedsantrag wartet auf die Freigabe durch den Vorstand.
          </p>
          <p>
            Nach der Freigabe erhältst du Zugang zum geschützten
            Mitgliederbereich.
          </p>
          <Link className="btn primary" href="/login">
            Zum Mitglieder-Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container" style={{ maxWidth: 800 }}>
      <section className="section">
        <p className="eyebrow">Your club. Your community.</p>
        <h1>Mitglied werden</h1>
        <p>
          Erstelle deinen persönlichen Zugang und beantrage deine
          Mitgliedschaft bei Padelclubbing.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="first_name">Vorname</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              maxLength={100}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="last_name">Nachname</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              maxLength={100}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">E-Mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="phone">Telefon</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
            />
          </div>

          <div className="field">
            <label htmlFor="skill_level">Spielstärke</label>
            <select
              id="skill_level"
              name="skill_level"
              defaultValue="Anfänger"
            >
              <option value="Anfänger">Anfänger</option>
              <option value="Fortgeschritten">Fortgeschritten</option>
              <option value="Turnierspieler">Turnierspieler</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="message">Nachricht (optional)</label>
            <textarea
              id="message"
              name="message"
              rows={5}
              maxLength={2000}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Passwort für deinen App-Zugang</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <small>Mindestens 8 Zeichen.</small>
          </div>

          {error && (
            <p role="alert" style={{ color: '#ff6b8a' }}>
              {error}
            </p>
          )}

          <button
            className="btn primary"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Registrierung läuft ...'
              : 'Mitgliedschaft beantragen'}
          </button>
        </form>
      </section>
    </main>
  );
}
