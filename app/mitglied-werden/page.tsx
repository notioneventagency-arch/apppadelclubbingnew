'use client';

import { useState } from 'react';

export default function MitgliedWerden() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <main className="container">
        <h1>Vielen Dank!</h1>
        <p>
          Deine Mitgliedsanfrage wurde erfolgreich übermittelt.
          Wir melden uns in Kürze bei dir.
        </p>
      </main>
    );
  }

  return (
    <main className="container" style={{ maxWidth: 800 }}>
      <section className="section">
        <h1>Mitglied werden</h1>

        <p>
          Fülle das Formular aus und wir melden uns bei dir.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Vorname</label>
            <input type="text" required />
          </div>

          <div className="field">
            <label>Nachname</label>
            <input type="text" required />
          </div>

          <div className="field">
            <label>E-Mail</label>
            <input type="email" required />
          </div>

          <div className="field">
            <label>Telefon</label>
            <input type="text" />
          </div>

          <div className="field">
            <label>Spielstärke</label>
            <select>
              <option>Anfänger</option>
              <option>Fortgeschritten</option>
              <option>Turnierspieler</option>
            </select>
          </div>

          <div className="field">
            <label>Nachricht</label>
            <textarea rows={5}></textarea>
          </div>

          <button className="btn primary" type="submit">
            Mitgliedschaft beantragen
          </button>
        </form>
      </section>
    </main>
  );
}
