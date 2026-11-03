          </span>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Direkt auf der Website veröffentlichen
        </label>

        <button className="btn primary" disabled={busy}>
          <CalendarPlus size={17} />{' '}
          {busy ? 'Speichert …' : 'Training speichern'}
        </button>
      </form>

      <div className="sectionhead" style={{ marginTop: 28 }}>
        <div>
          <h2>Alle Trainings</h2>
        </div>
      </div>

      <div className="adminlist">
        {trainings.length === 0 ? (
          <div className="empty">Noch keine Trainings angelegt.</div>
        ) : (
          trainings.map((training) => {
            const regs = registrations[training.id] || [];
            const confirmed = regs.filter(
              (r) => r.status === 'registered'
            );
            const waiting = regs.filter(
              (r) => r.status === 'waitlist'
            );

            return (
              <article className="adminitem" key={training.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{training.title}</strong>

                  <p>
                    {formatTrainingDate(training.starts_at)} ·{' '}
                    {training.location}
                  </p>

                  <p>
                    {confirmed.length}/{training.max_participants} Plätze
                    belegt · {waiting.length} auf Warteliste ·{' '}
                    {training.published ? 'Veröffentlicht' : 'Entwurf'}
                  </p>

                  {training.image_url && (
                    <img
                      src={training.image_url}
                      alt=""
                      style={{
                        width: 180,
                        maxHeight: 110,
                        objectFit: 'cover',
                        borderRadius: 8,
                      }}
                    />
                  )}

                  <div className="actions" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        void setPublishedState(
                          training,
                          !training.published
                        )
                      }
                    >
                      {training.published
                        ? 'Als Entwurf setzen'
                        : 'Veröffentlichen'}
                    </button>
                  </div>

                  <details style={{ marginTop: 10 }}>
                    <summary>
                      <Users
                        size={15}
                        style={{
                          display: 'inline',
                          verticalAlign: 'middle',
                        }}
                      />{' '}
                      Teilnehmerliste ({regs.length})
                    </summary>

                    {regs.length === 0 ? (
                      <p className="muted">Noch keine Anmeldungen.</p>
                    ) : (
                      <ul>
                        {regs.map((reg) => (
                          <li key={reg.id}>
                            <strong>
                              {[reg.first_name, reg.last_name]
                                .filter(Boolean)
                                .join(' ') || 'Name noch nicht hinterlegt'}
                            </strong>
                            {' — '}
                            {reg.status === 'registered'
                              ? 'Angemeldet'
                              : reg.status === 'waitlist'
                                ? 'Warteliste'
                                : 'Storniert'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </div>

                <button
                  type="button"
                  className="btn"
                  aria-label="Training löschen"
                  onClick={() => void remove(training.id)}
                >
                  <Trash2 size={16} />
                </button>
              </article>
