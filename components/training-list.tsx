'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CalendarDays, MapPin, Users, Clock3 } from 'lucide-react';

type Training = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  max_participants: number;
  image_url: string | null;
  published: boolean;
};

type Registration = {
  id: string;
  training_id: string;
  status: 'registered' | 'waitlist' | 'cancelled';
};

export default function TrainingList() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Record<string, Registration>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage('Die Verbindung zum Mitgliederportal ist momentan nicht verfügbar.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const currentUserId = auth.user?.id ?? null;
    setUserId(currentUserId);

    const { data, error } = await supabase
      .from('trainings')
      .select('id,title,description,location,starts_at,max_participants,image_url,published')
      .eq('published', true)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true });

    if (error) {
      setMessage('Trainings konnten nicht geladen werden. Bitte versuche es später erneut.');
      setLoading(false);
      return;
    }

    const rows = (data || []) as Training[];
    setTrainings(rows);

    const results = await Promise.all(rows.map(async (training) => {
      const [countResult, mineResult] = await Promise.all([
        supabase.rpc('get_training_registration_count', { p_training_id: training.id }),
        currentUserId
          ? supabase
              .from('training_registrations')
              .select('id,training_id,status')
              .eq('training_id', training.id)
              .eq('user_id', currentUserId)
              .in('status', ['registered', 'waitlist'])
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      return {
        trainingId: training.id,
        count: Number(countResult.data || 0),
        mine: mineResult.data as Registration | null,
      };
    }));

    const nextCounts: Record<string, number> = {};
    const nextMine: Record<string, Registration> = {};
    for (const result of results) {
      nextCounts[result.trainingId] = result.count;
      if (result.mine) nextMine[result.trainingId] = result.mine;
    }
    setCounts(nextCounts);
    setMyRegistrations(nextMine);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      setMessage(error.message || 'Die Anmeldung ist leider fehlgeschlagen. Bitte versuche es erneut.');
      return;
    }

    setMessage(
      data === 'waitlist'
        ? 'Du bist auf der Warteliste eingetragen.'
        : 'Du bist für das Training angemeldet.',
    );
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
      setMessage(error.message || 'Die Stornierung ist leider fehlgeschlagen. Bitte versuche es erneut.');
      return;
    }

    setMessage('Deine Anmeldung wurde storniert. Ein Wartelistenplatz kann automatisch nachrücken.');
    await load();
  }

  const dateLabel = (value: string) =>
    new Date(value).toLocaleString('de-AT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="training-list-mobile">
      {message && (
        <p className="training-message" role="status" aria-live="polite">
          {message}
        </p>
      )}

      {loading ? (
        <div className="empty" aria-live="polite">Trainings werden geladen …</div>
      ) : trainings.length === 0 ? (
        <div className="empty">Aktuell sind keine Trainings veröffentlicht. Schaut bald wieder vorbei.</div>
      ) : (
        <div className="training-grid">
          {trainings.map((training) => {
            const count = counts[training.id] || 0;
            const mine = myRegistrations[training.id];
            const max = Math.max(0, Number(training.max_participants) || 0);
            const full = max > 0 && count >= max;
            const remaining = Math.max(0, max - count);

            return (
              <article className="card training-card" key={training.id}>
                {training.image_url && (
                  <img className="training-image" src={training.image_url} alt={`Bild: ${training.title}`} loading="lazy" />
                )}

                <div className="training-card-body">
                  <div className="training-card-topline">
                    <span className="tag">Training</span>
                    {full && !mine && <span className="training-full-label">Ausgebucht</span>}
                  </div>

                  <h3 className="training-title">{training.title}</h3>
                  <p className="muted training-description">{training.description || 'Weitere Informationen folgen.'}</p>

                  <div className="training-details">
                    <p className="training-detail">
                      <CalendarDays size={17} aria-hidden="true" />
                      <span>{dateLabel(training.starts_at)}</span>
                    </p>
                    {training.location && (
                      <p className="training-detail">
                        <MapPin size={17} aria-hidden="true" />
                        <span>{training.location}</span>
                      </p>
                    )}
                    <p className="training-detail">
                      <Users size={17} aria-hidden="true" />
                      <span>{count}/{max} Plätze belegt</span>
                    </p>
                  </div>

                  <div className="training-availability" aria-label={full ? 'Training ausgebucht' : `${remaining} Plätze frei`}>
                    <span className={`availability-dot ${full ? 'is-full' : ''}`} />
                    {full ? 'Ausgebucht · Warteliste möglich' : `${remaining} ${remaining === 1 ? 'Platz' : 'Plätze'} frei`}
                  </div>

                  <div className="training-action">
                    {mine ? (
                      <>
                        <p className={`registration-status ${mine.status === 'waitlist' ? 'is-waitlist' : ''}`}>
                          {mine.status === 'waitlist' ? 'Du stehst auf der Warteliste' : 'Du bist angemeldet'}
                        </p>
                        <button
                          className="btn training-button"
                          disabled={busyId === training.id}
                          onClick={() => void cancel(training.id)}
                        >
                          {busyId === training.id ? 'Bitte warten …' : 'Anmeldung stornieren'}
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn primary training-button"
                        disabled={busyId === training.id}
                        onClick={() => void register(training.id)}
                      >
                        {busyId === training.id ? 'Anmeldung läuft …' : full ? 'Auf Warteliste anmelden' : 'Jetzt anmelden'}
                      </button>
                    )}
                    {!userId && (
                      <p className="training-login-hint">
                        Für die Anmeldung bitte <Link href="/login">einloggen</Link>.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .training-list-mobile {
          width: 100%;
          min-width: 0;
        }

        .training-message {
          padding: 14px 16px;
          border: 1px solid var(--border, #333);
          border-radius: 14px;
          overflow-wrap: anywhere;
        }

        .training-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          width: 100%;
        }

        .training-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
          padding: 0;
        }

        .training-image {
          display: block;
          width: 100%;
          height: 210px;
          object-fit: cover;
        }

        .training-card-body {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-width: 0;
          padding: 20px;
        }

        .training-card-topline {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .training-full-label {
          font-size: 12px;
          color: var(--pink, #f472b6);
          font-weight: 700;
        }

        .training-title {
          overflow-wrap: anywhere;
          margin: 12px 0 8px;
        }

        .training-description {
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .training-details {
          display: grid;
          gap: 10px;
          margin-top: 8px;
        }

        .training-detail {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr);
          align-items: start;
          gap: 9px;
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .training-detail :global(svg) {
          margin-top: 2px;
          color: var(--cyan, #22d3ee);
        }

        .training-availability {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          font-size: 13px;
          color: var(--muted, #aaa);
        }

        .availability-dot {
          flex: 0 0 auto;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
        }

        .availability-dot.is-full {
          background: var(--pink, #f472b6);
        }

        .training-action {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          margin-top: auto;
          padding-top: 18px;
        }

        .training-button {
          width: 100%;
          min-height: 48px;
          justify-content: center;
          text-align: center;
          white-space: normal;
          line-height: 1.35;
          padding: 12px 16px;
          touch-action: manipulation;
        }

        .registration-status {
          margin: 0;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(34, 197, 94, 0.1);
          font-size: 13px;
          font-weight: 700;
          text-align: center;
        }

        .registration-status.is-waitlist {
          background: rgba(245, 158, 11, 0.12);
        }

        .training-login-hint {
          margin: 0;
          text-align: center;
          font-size: 13px;
        }

        .training-login-hint a {
          color: var(--cyan, #22d3ee);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 700px) {
          .training-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
          }

          .training-card {
            border-radius: 16px;
          }

          .training-image {
            height: clamp(160px, 52vw, 230px);
          }

          .training-card-body {
            padding: 17px;
          }

          .training-title {
            font-size: 21px;
            line-height: 1.2;
          }

          .training-detail {
            font-size: 14px;
          }

          .training-button {
            min-height: 52px;
            font-size: 15px;
          }
        }

        @media (max-width: 360px) {
          .training-card-body {
            padding: 14px;
          }

          .training-image {
            height: 155px;
          }
        }
      `}</style>
    </div>
  );
}
