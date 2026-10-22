  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id || null);

    const { data, error } = await supabase
      .from('trainings')
      .select('id,title,description,location,starts_at,max_participants,image_url,published')
      .eq('published', true)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true });
    if (error) {
      setMessage('Trainings konnten nicht geladen werden: ' + error.message);
      return;
    }
    const rows = (data || []) as Training[];
    setTrainings(rows);

    const nextCounts: Record<string, number> = {};
    const nextMine: Record<string, Registration> = {};
    for (const training of rows) {
      const { data: countData } = await supabase.rpc('get_training_registration_count', {
        p_training_id: training.id,
      });
      nextCounts[training.id] = Number(countData || 0);

      if (auth.user) {
        const { data: mine } = await supabase
          .from('training_registrations')
          .select('id,training_id,status')
          .eq('training_id', training.id)
          .eq('user_id', auth.user.id)
          .in('status', ['registered', 'waitlist'])
          .maybeSingle();
        if (mine) nextMine[training.id] = mine as Registration;
      }
    }
    setCounts(nextCounts);
    setMyRegistrations(nextMine);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function register(trainingId: string) {
    if (!supabase) return;
    if (!userId) {
      window.location.href = '/login';
      return;
    }
    setBusyId(trainingId);
    setMessage('');
    const { data, error } = await supabase.rpc('register_for_training', {
      p_training_id: trainingId,
    });
    setBusyId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(data === 'waitlist' ? 'Du bist auf der Warteliste eingetragen.' : 'Du bist für das Training angemeldet.');
    await load();
  }

  async function cancel(trainingId: string) {
    if (!supabase) return;
    setBusyId(trainingId);
    setMessage('');
    const { error } = await supabase.rpc('cancel_training_registration', {
      p_training_id: trainingId,
    });
    setBusyId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Deine Anmeldung wurde storniert. Ein Wartelistenplatz kann automatisch nachrücken.');
    await load();
  }

  const dateLabel = (value: string) =>
    new Date(value).toLocaleString('de-AT', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div>
      {message && <p className="success" role="status">{message}</p>}
      {trainings.length === 0 ? (
        <div className="empty">Aktuell sind keine Trainings veröffentlicht. Schaut bald wieder vorbei.</div>
      ) : (
        <div className="grid">
          {trainings.map(training => {
            const count = counts[training.id] || 0;
            const mine = myRegistrations[training.id];
            const full = count >= training.max_participants;
            return (
              <article className="card" key={training.id}>
                {training.image_url && <img src={training.image_url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />}
                <span className="tag">Training</span>
                <h3>{training.title}</h3>
                <p className="muted">{training.description || 'Weitere Informationen folgen.'}</p>
                <p className="small"><CalendarDays size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {dateLabel(training.starts_at)}</p>
                <p className="small"><MapPin size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {training.location}</p>
                <p className="small"><Users size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {count}/{training.max_participants} Plätze belegt{full ? ' · ausgebucht' : ` · ${training.max_participants - count} frei`}</p>
                {mine ? (
                  <div>
                    <p className="tag">{mine.status === 'waitlist' ? 'Auf der Warteliste' : 'Du bist angemeldet'}</p>
                    <button className="btn" disabled={busyId === training.id} onClick={() => void cancel(training.id)}>
                      {busyId === training.id ? 'Bitte warten …' : 'Anmeldung stornieren'}
                    </button>
                  </div>
                ) : (
                  <button className="btn primary" disabled={busyId === training.id} onClick={() => void register(training.id)}>
                    {busyId === training.id ? 'Anmeldung läuft …' : full ? 'Auf Warteliste anmelden' : 'Jetzt anmelden'}
                  </button>
                )}
                {!userId && <p className="small">Für die Anmeldung bitte <Link href="/login">einloggen</Link>.</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
