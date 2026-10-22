    setMessage(error ? 'Löschen fehlgeschlagen: ' + error.message : 'Training gelöscht.');
    await load();
  }

  async function setPublishedState(training: Training, nextPublished: boolean) {
    if (!supabase) return;
    const { error } = await supabase.from('trainings')
      .update({ published: nextPublished })
      .eq('id', training.id);
    setMessage(error ? 'Status konnte nicht geändert werden: ' + error.message : (nextPublished ? 'Training veröffentlicht.' : 'Training als Entwurf gespeichert.'));
    await load();
  }

  const dateLabel = (value: string) =>
    new Date(value).toLocaleString('de-AT', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <section className="section" id="training-management">
      <div className="sectionhead">
        <div>
          <p className="eyebrow">Trainingsverwaltung</p>
          <h2>Trainings erstellen</h2>
          <p className="muted">Lege die konkreten Termine alle 14 Tage nach Bedarf an.</p>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          <RefreshCw size={15} /> Aktualisieren
        </button>
      </div>

      {message && <p className="success" role="status">{message}</p>}

      <form className="form card" onSubmit={save}>
        <div className="field">
          <label htmlFor="training-title">Titel</label>
          <input id="training-title" required value={title} onChange={e => setTitle(e.target.value)} placeholder="z. B. Padelclubbing Training" />
        </div>
        <div className="field">
          <label htmlFor="training-description">Beschreibung</label>
          <textarea id="training-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Niveau, Ablauf, Treffpunkt …" />
        </div>
        <div className="field">
          <label htmlFor="training-location">Ort</label>
          <input id="training-location" required value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="training-starts">Datum und Uhrzeit</label>
          <input id="training-starts" required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="training-capacity">Maximale Teilnehmerzahl</label>
          <input id="training-capacity" required type="number" min="1" max="200" value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="training-image">Titelbild (optional)</label>
          <input id="training-image" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
          <span className="small">Bild wird im Supabase-Bucket „training-images“ gespeichert.</span>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
          Direkt auf der Website veröffentlichen
        </label>
        <button className="btn primary" disabled={busy}>
          <CalendarPlus size={17} /> {busy ? 'Speichert …' : 'Training speichern'}
        </button>
      </form>

      <div className="sectionhead" style={{ marginTop: 28 }}>
        <div><h2>Alle Trainings</h2></div>
      </div>
      <div className="adminlist">
        {trainings.length === 0 ? (
          <div className="empty">Noch keine Trainings angelegt.</div>
        ) : trainings.map(training => {
          const regs = registrations[training.id] || [];
          const confirmed = regs.filter(r => r.status === 'registered');
          const waiting = regs.filter(r => r.status === 'waitlist');
          return (
            <article className="adminitem" key={training.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{training.title}</strong>
                <p>{dateLabel(training.starts_at)} · {training.location}</p>
                <p>{confirmed.length}/{training.max_participants} Plätze belegt · {waiting.length} auf Warteliste · {training.published ? 'Veröffentlicht' : 'Entwurf'}</p>
                {training.image_url && <img src={training.image_url} alt="" style={{ width: 180, maxHeight: 110, objectFit: 'cover', borderRadius: 8 }} />}
                <div className="actions" style={{ marginTop: 8 }}>
                  <button type="button" className="btn" onClick={() => void setPublishedState(training, !training.published)}>
                    {training.published ? 'Als Entwurf setzen' : 'Veröffentlichen'}
                  </button>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary><Users size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> Teilnehmerliste ({regs.length})</summary>
                  {regs.length === 0 ? <p className="muted">Noch keine Anmeldungen.</p> : (
                    <ul>
                      {regs.map(reg => (
                        <li key={reg.id}>
                          {reg.user_id.slice(0, 8)}… — {reg.status === 'registered' ? 'Angemeldet' : reg.status === 'waitlist' ? 'Warteliste' : 'Storniert'}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </div>
              <button type="button" className="btn" aria-label="Training löschen" onClick={() => void remove(training.id)}>
                <Trash2 size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
