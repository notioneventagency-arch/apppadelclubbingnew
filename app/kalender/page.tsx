'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseReady } from '@/lib/supabase';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
} from 'lucide-react';

type CalendarEntry = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  category: 'Training' | 'Event' | 'News';
  image_url: string | null;
};

type Profile = {
  role: string;
  status: string;
};

type AccessState = 'checking' | 'allowed' | 'denied';

const monthNames = [
  'Jänner',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

function localDateKey(value: string) {
  const date = new Date(value);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateOnlyKey(value: string) {
  return value.slice(0, 10);
}

function displayDate(value: string, dateOnly = false) {
  const date = dateOnly
    ? new Date(`${dateOnlyKey(value)}T12:00:00`)
    : new Date(value);

  if (dateOnly) {
    return date.toLocaleDateString('de-AT', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  return date.toLocaleString('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function entryDateKey(entry: CalendarEntry) {
  return entry.category === 'News'
    ? dateOnlyKey(entry.date)
    : localDateKey(entry.date);
}

function entryMonthDate(entry: CalendarEntry) {
  return entry.category === 'News'
    ? new Date(`${dateOnlyKey(entry.date)}T12:00:00`)
    : new Date(entry.date);
}

export default function KalenderPage() {
  const router = useRouter();
  const today = new Date();

  const [access, setAccess] = useState<AccessState>('checking');
  const [isAdmin, setIsAdmin] = useState(false);

  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [selectedDay, setSelectedDay] = useState<string | null>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  );

  const [highlighted, setHighlighted] = useState<string | null>(null);

  // Prüft die Anmeldung UND den Freigabestatus des Profils.
  useEffect(() => {
    if (!supabase || !supabaseReady) {
      setAccess('denied');
      router.replace('/#mitgliederzugang');
      return;
    }

    let active = true;
    let redirecting = false;

    async function checkAccess(userId: string | null) {
      if (!active) return;

      if (!userId) {
        setIsAdmin(false);
        setAccess('denied');

        if (!redirecting) {
          redirecting = true;
          router.replace('/#mitgliederzugang');
        }

        return;
      }

      const { data: profile, error } = await supabase!
        .from('profiles')
        .select('role,status')
        .eq('id', userId)
        .maybeSingle();

      if (!active) return;

      const memberProfile = profile as Profile | null;

      if (
        error ||
        !memberProfile ||
        memberProfile.status !== 'approved' ||
        !['member', 'admin'].includes(memberProfile.role)
      ) {
        setIsAdmin(false);
        setAccess('denied');

        if (!redirecting) {
          redirecting = true;
          router.replace('/#mitgliederzugang');
        }

        return;
      }

      redirecting = false;
      setIsAdmin(memberProfile.role === 'admin');
      setAccess('allowed');
    }

    async function checkCurrentUser() {
      const { data, error } = await supabase!.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        await checkAccess(null);
      } else {
        await checkAccess(data.user.id);
      }
    }

    void checkCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setAccess('checking');
      setIsAdmin(false);

      const userId = session?.user?.id ?? null;

      // Verzögert die Profilabfrage aus dem Auth-Callback.
      setTimeout(() => {
        if (active) void checkAccess(userId);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Kalenderdaten werden erst nach erfolgreicher Freigabe geladen.
  const load = useCallback(async () => {
    if (access !== 'allowed') return;

    if (!supabase || !supabaseReady) {
      setMessage('Die Verbindung zur Datenbank ist nicht verfügbar.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage('');

    const [trainingResult, eventResult, newsResult] = await Promise.all([
      supabase
        .from('trainings')
        .select('id,title,description,location,starts_at,image_url,published')
        .eq('published', true)
        .order('starts_at', { ascending: true }),

      supabase
        .from('events')
        .select(
          'id,title,description,location,starts_at,category,image_url,published',
        )
        .eq('published', true)
        .order('starts_at', { ascending: true }),

      supabase
        .from('news')
        .select('id,title,description,event_date,image_url,published')
        .eq('published', true)
        .not('event_date', 'is', null)
        .order('event_date', { ascending: true }),
    ]);

    if (trainingResult.error || eventResult.error || newsResult.error) {
      console.error('Kalender-Ladefehler:', {
        trainings: trainingResult.error,
        events: eventResult.error,
        news: newsResult.error,
      });

      setMessage(
        'Termine konnten nicht vollständig geladen werden. Bitte Datenbankspalten und Leseberechtigungen prüfen.',
      );
      setEntries([]);
      setLoading(false);
      return;
    }

    const trainings: CalendarEntry[] = (trainingResult.data || [])
      .filter((x) => x.starts_at)
      .map((x) => ({
        id: String(x.id),
        title: x.title,
        description: x.description,
        date: x.starts_at!,
        location: x.location,
        category: 'Training',
        image_url: x.image_url,
      }));

    const events: CalendarEntry[] = (eventResult.data || [])
      .filter((x) => x.starts_at)
      .map((x) => ({
        id: String(x.id),
        title: x.title,
        description: x.description,
        date: x.starts_at!,
        location: x.location,
        category: 'Event',
        image_url: x.image_url,
      }));

    const news: CalendarEntry[] = (newsResult.data || [])
      .filter((x) => x.event_date)
      .map((x) => ({
        id: String(x.id),
        title: x.title,
        description: x.description,
        date: dateOnlyKey(x.event_date!),
        location: null,
        category: 'News',
        image_url: x.image_url,
      }));

    const merged = [...trainings, ...events, ...news].sort(
      (a, b) =>
        entryMonthDate(a).getTime() - entryMonthDate(b).getTime(),
    );

    setEntries(merged);

    // Push-Direktlinks beibehalten:
    // /kalender?type=training&id=123
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type')?.toLowerCase();
    const id = params.get('id');

    if (type && id) {
      const expectedCategory =
        type === 'training'
          ? 'Training'
          : type === 'event'
            ? 'Event'
            : type === 'news'
              ? 'News'
              : null;

      const found = merged.find(
        (entry) =>
          entry.id === id &&
          entry.category === expectedCategory,
      );

      if (found) {
        setHighlighted(`${type}:${id}`);

        const targetDate = entryMonthDate(found);

        setMonth(
          new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            1,
          ),
        );

        setSelectedDay(entryDateKey(found));
      } else {
        setHighlighted(null);
        setMessage(
          'Der verlinkte Termin wurde nicht gefunden. Möglicherweise wurde er gelöscht oder ist nicht veröffentlicht.',
        );
      }
    } else {
      setHighlighted(null);
    }

    setLoading(false);
  }, [access]);

  useEffect(() => {
    if (access === 'allowed') {
      void load();
    }
  }, [access, load]);

  const monthEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const date = entryMonthDate(entry);

        return (
          date.getFullYear() === month.getFullYear() &&
          date.getMonth() === month.getMonth()
        );
      }),
    [entries, month],
  );

  const dayEntries = useMemo(
    () =>
      monthEntries.filter(
        (entry) => entryDateKey(entry) === selectedDay,
      ),
    [monthEntries, selectedDay],
  );

  const firstWeekday =
    (new Date(
      month.getFullYear(),
      month.getMonth(),
      1,
    ).getDay() + 6) % 7;

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function moveMonth(amount: number) {
    const nextMonth = new Date(
      month.getFullYear(),
      month.getMonth() + amount,
      1,
    );

    setMonth(nextMonth);
    setSelectedDay(null);
    setHighlighted(null);
  }

  function dayKey(day: number) {
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function categoryClass(category: CalendarEntry['category']) {
    if (category === 'Training') return 'training';
    if (category === 'Event') return 'event';
    return 'news';
  }

  // Bis zur bestätigten Zugriffsentscheidung keine Kalenderdaten anzeigen.
  if (access !== 'allowed') {
    return (
      <main className="container section">
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <CalendarDays
            size={32}
            style={{ margin: '0 auto 12px', display: 'block' }}
          />
          <h1>Mitgliederkalender</h1>
          <p className="muted">
            {access === 'checking'
              ? 'Dein Mitgliederzugang wird überprüft …'
              : 'Du wirst zum Mitgliederzugang weitergeleitet.'}
          </p>
          <Link className="btn" href="/#mitgliederzugang">
            Zum Mitgliederzugang
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container section calendar-page">
      <nav className="nav calendar-nav">
        <Link className="brand" href="/">
          <img src="/padelclubbing-logo.jpg" alt="PADELCLUBBING" />
          <span>PADELCLUBBING</span>
        </Link>

        <div className="navlinks">
          <Link href="/">Startseite</Link>
          {isAdmin && <Link href="/admin">Adminbereich</Link>}
        </div>
      </nav>

      <header className="calendar-header" style={{ margin: '28px 0' }}>
        <p className="eyebrow">Alle Vereinstermine auf einen Blick</p>

        <h1 style={{ fontSize: 'clamp(32px, 6vw, 48px)', margin: '8px 0' }}>
          Live-Kalender
        </h1>

        <p className="muted">
          Trainings, Turniere und datierte Vereinsnews – direkt aus unserem
          Vereinssystem.
        </p>
      </header>

      <section className="card calendar-card" style={{ padding: 16 }}>
        <div className="sectionhead calendar-toolbar">
          <button
            className="btn"
            type="button"
            aria-label="Vorheriger Monat"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={18} />
          </button>

          <h2 style={{ margin: 0 }}>
            {monthNames[month.getMonth()]} {month.getFullYear()}
          </h2>

          <button
            className="btn"
            type="button"
            aria-label="Nächster Monat"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-grid">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}

          {cells.map((day, index) => {
            if (!day) {
              return (
                <div className="calendar-empty" key={`empty-${index}`} />
              );
            }

            const key = dayKey(day);
            const dayItems = monthEntries.filter(
              (entry) => entryDateKey(entry) === key,
            );

            return (
              <button
                type="button"
                key={key}
                className={
                  'calendar-day' +
                  (selectedDay === key ? ' selected' : '') +
                  (dayItems.length ? ' has-events' : '')
                }
                onClick={() => {
                  setSelectedDay(key);
                  setHighlighted(null);
                }}
              >
                <span>{day}</span>

                {dayItems.length > 0 && (
                  <span className="calendar-dots">
                    {dayItems.slice(0, 3).map((entry) => (
                      <i
                        key={`${entry.category}-${entry.id}`}
                        className={categoryClass(entry.category)}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span><i className="training" /> Training</span>
          <span><i className="event" /> Turnier / Event</span>
          <span><i className="news" /> News-Termin</span>
        </div>
      </section>

      <section className="section calendar-details">
        <div className="sectionhead details-toolbar">
          <div>
            <p className="eyebrow">
              {selectedDay ? 'Ausgewählter Tag' : 'Monatsübersicht'}
            </p>

            <h2>
              {selectedDay
                ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(
                    'de-AT',
                    {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    },
                  )
                : 'Alle Termine im Monat'}
            </h2>
          </div>

          <button
            className="btn"
            type="button"
            onClick={() => void load()}
            disabled={loading}
          >
            <CalendarDays size={16} />
            {loading ? 'Lädt …' : 'Aktualisieren'}
          </button>
        </div>

        {loading ? (
          <p>Kalender wird geladen …</p>
        ) : message ? (
          <p role="status">{message}</p>
        ) : (selectedDay ? dayEntries : monthEntries).length === 0 ? (
          <div className="empty">
            Für diesen Zeitraum sind keine Termine eingetragen.
          </div>
        ) : (
          <div className="adminlist">
            {(selectedDay ? dayEntries : monthEntries).map((entry) => {
              const key = `${entry.category.toLowerCase()}:${entry.id}`;
              const isHighlighted = highlighted === key;

              return (
                <article
                  className="adminitem calendar-entry"
                  key={`${entry.category}-${entry.id}`}
                  id={`entry-${entry.id}`}
                  style={{
                    display: 'block',
                    border: isHighlighted
                      ? '2px solid currentColor'
                      : undefined,
                    scrollMarginTop: 20,
                  }}
                >
                  <div
                    className="entry-layout"
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    {entry.image_url && (
                      <img
                        src={entry.image_url}
                        alt=""
                        className="entry-image"
                        style={{
                          width: 96,
                          height: 84,
                          objectFit: 'cover',
                          borderRadius: 8,
                        }}
                      />
                    )}

                    <div className="entry-content" style={{ flex: 1, minWidth: 0 }}>
                      <span className={`tag ${categoryClass(entry.category)}`}>
                        {entry.category === 'Event'
                          ? 'Turnier / Event'
                          : entry.category === 'Training'
                            ? 'Training'
                            : 'News-Termin'}
                      </span>

                      <h3 style={{ margin: '8px 0' }}>{entry.title}</h3>

                      <p>
                        {displayDate(
                          entry.date,
                          entry.category === 'News',
                        )}
                      </p>

                      {entry.location && (
                        <p>
                          <MapPin
                            size={14}
                            style={{ display: 'inline' }}
                          />{' '}
                          {entry.location}
                        </p>
                      )}

                      {entry.description && <p>{entry.description}</p>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <style jsx>{`
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 5px;
          margin-top: 18px;
        }

        .calendar-weekday {
          text-align: center;
          color: var(--muted, #888);
          padding: 8px 0;
          font-size: 13px;
        }

        .calendar-empty {
          min-height: 48px;
        }

        .calendar-day {
          min-height: 54px;
          border: 1px solid var(--border, #333);
          background: transparent;
          color: inherit;
          border-radius: 9px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
        }

        .calendar-day.selected {
          outline: 2px solid currentColor;
          outline-offset: -2px;
          font-weight: 700;
        }

        .calendar-day.has-events {
          font-weight: 700;
        }

        .calendar-dots {
          display: flex;
          gap: 3px;
          min-height: 5px;
        }

        .calendar-dots i,
        .calendar-legend i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .training {
          background: #22c55e;
        }

        .event {
          background: #f59e0b;
        }

        .news {
          background: #60a5fa;
        }

        .calendar-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 18px;
          font-size: 12px;
        }

        .calendar-legend span {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .calendar-page {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow-wrap: anywhere;
        }

        .calendar-nav {
          gap: 16px;
          align-items: center;
        }

        .calendar-header h1 {
          line-height: 1.08;
          overflow-wrap: anywhere;
        }

        .calendar-card {
          min-width: 0;
          box-sizing: border-box;
        }

        .calendar-toolbar {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 44px;
          align-items: center;
          gap: 10px;
        }

        .calendar-toolbar h2 {
          text-align: center;
          font-size: clamp(18px, 4vw, 26px);
          overflow-wrap: anywhere;
        }

        .calendar-toolbar .btn {
          min-width: 44px;
          min-height: 44px;
          justify-content: center;
          padding: 8px;
        }

        .details-toolbar {
          gap: 12px;
          align-items: center;
        }

        .calendar-entry {
          min-width: 0;
          overflow: hidden;
        }

        .entry-layout {
          min-width: 0;
        }

        .entry-image {
          flex: 0 0 96px;
          max-width: 96px;
        }

        .entry-content {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .entry-content h3 {
          overflow-wrap: anywhere;
        }

        .calendar-grid {
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        .calendar-day {
          min-width: 0;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        @media (max-width: 700px) {
          .calendar-page {
            padding-left: max(14px, env(safe-area-inset-left));
            padding-right: max(14px, env(safe-area-inset-right));
            padding-top: max(16px, env(safe-area-inset-top));
          }

          .calendar-nav {
            align-items: flex-start;
            flex-direction: column;
          }

          .calendar-nav .navlinks {
            width: 100%;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .calendar-header {
            margin: 22px 0 !important;
          }

          .calendar-header p {
            line-height: 1.5;
          }

          .calendar-card {
            padding: 12px !important;
            border-radius: 16px;
          }

          .calendar-grid {
            gap: 3px;
            margin-top: 12px;
          }

          .calendar-weekday {
            padding: 6px 0;
            font-size: 11px;
          }

          .calendar-day {
            min-height: 46px;
            padding: 4px 0;
            border-radius: 7px;
            font-size: 13px;
          }

          .calendar-empty {
            min-height: 46px;
          }

          .calendar-legend {
            gap: 9px 12px;
            font-size: 11px;
          }

          .details-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .details-toolbar > button {
            width: 100%;
            justify-content: center;
          }

          .calendar-entry {
            padding: 14px !important;
          }
        }

        @media (max-width: 420px) {
          .calendar-day {
            min-height: 40px;
            font-size: 12px;
          }

          .calendar-empty {
            min-height: 40px;
          }

          .calendar-dots {
            gap: 2px;
          }

          .calendar-dots i {
            width: 5px;
            height: 5px;
          }

          .entry-layout {
            flex-direction: column;
          }

          .entry-image {
            width: 100% !important;
            max-width: none;
            height: 160px !important;
            flex-basis: auto;
          }

          .calendar-entry .tag {
            max-width: 100%;
            white-space: normal;
          }
        }

        @media (max-width: 480px) {
          .calendar-grid {
            gap: 3px;
          }

          .calendar-day {
            min-height: 44px;
            border-radius: 6px;
            font-size: 13px;
          }

          .calendar-empty {
            min-height: 44px;
          }
        }
      `}</style>
    </main>
  );
}
