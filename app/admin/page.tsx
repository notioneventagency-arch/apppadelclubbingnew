                    >
                      <option>Training</option>
                      <option>Turnier</option>
                      <option>Meisterschaft</option>
                      <option>Vereinsevent</option>
                      <option>Clubbing</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="field">
                  <label htmlFor="imageUrl">Bild-URL (optional)</label>
                  <input
                    id="imageUrl"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://…"
                  />
                  <span className="small">
                    Öffentlich erreichbarer Bildlink; Foto-Upload kann später
                    ergänzt werden.
                  </span>
                </div>
              )}

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                Sofort öffentlich anzeigen
              </label>

              <button className="btn primary" disabled={busy}>
                <Plus size={17} />
                {busy ? 'Speichert …' : 'Eintrag speichern'}
              </button>
            </form>
          </section>

          <TrainingManagement />

          <section id="events" className="section">
            <div className="sectionhead">
              <div>
                <p className="eyebrow">Termine</p>
                <h2>Trainings & Turniere</h2>
              </div>
              <button className="btn" onClick={() => void load()}>
                <RefreshCw size={15} /> Aktualisieren
              </button>
            </div>

            <div className="adminlist">
              {events.length ? (
                events.map((x) => (
                  <div className="adminitem" key={x.id}>
                    <div>
                      <strong>{x.title}</strong>
                      <p>
                        {x.starts_at
                          ? new Date(x.starts_at).toLocaleString('de-AT')
                          : 'Termin folgt'}
                        {x.location ? ' · ' + x.location : ''} ·{' '}
                        {x.published ? 'Veröffentlicht' : 'Entwurf'}
                      </p>
                    </div>
                    <button
                      className="btn"
                      aria-label="Löschen"
                      onClick={() => void remove('events', x.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">Noch keine Termine angelegt.</div>
              )}
            </div>
          </section>

          <section id="news" className="section">
            <div className="sectionhead">
              <div>
                <p className="eyebrow">Updates</p>
                <h2>Vereinsnews</h2>
              </div>
            </div>

            <div className="adminlist">
              {news.length ? (
                news.map((x) => (
                  <div className="adminitem" key={x.id}>
                    <div>
                      <strong>{x.title}</strong>
                      <p>{x.published ? 'Veröffentlicht' : 'Entwurf'}</p>
                    </div>
                    <button
                      className="btn"
                      aria-label="Löschen"
                      onClick={() => void remove('news', x.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">Noch keine News angelegt.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
