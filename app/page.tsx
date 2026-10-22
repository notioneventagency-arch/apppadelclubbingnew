'use client';

import Link from 'next/link';
import {
  Trophy,
  Images,
  Users,
  ArrowUpRight,
  Instagram,
  Gift,
  LogOut,
  CalendarDays,
  Newspaper,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseReady } from '@/lib/supabase';
import TrainingList from '@/components/training-list';

type Entry = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  location: string | null;
  category: string | null;
  image_url?: string | null;
  published?: boolean;
  created_at?: string;
};

type Profile = {
  role: string;
  status: string;
};

function dateLabel(value: string | null) {
  if (!value) return 'Termin folgt';

  return new Date(value).toLocaleDateString('de-AT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Home() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [isApprovedMember, setIsApprovedMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [events, setEvents] = useState<Entry[]>([]);
  const [news, setNews] = useState<Entry[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadUser = useCallback(async (userId: string | null) => {
    setProfileError(false);
    setEvents([]);
    setNews([]);
    setIsApprovedMember(false);
    setIsAdmin(false);
    setSignedIn(Boolean(userId));

    if (!userId || !supabase) {
      setLoading(false);
      return;
    }

    const { data: profile, error: profileQueryError } = await supabase
      .from('profiles')
      .select('role,status')
      .eq('id', userId)
      .maybeSingle();

    if (profileQueryError) {
      console.error('Profil konnte nicht geladen werden:', profileQueryError.message);
      setProfileError(true);
      setLoading(false);
      return;
    }

    const memberProfile = profile as Profile | null;

    if (
      !memberProfile ||
      memberProfile.status !== 'approved' ||
      !['member', 'admin'].includes(memberProfile.role)
    ) {
      setLoading(false);
      return;
    }

    const admin = memberProfile.role === 'admin';
    setIsAdmin(admin);
    setIsApprovedMember(true);

    const [eventsResult, newsResult] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('published', true)
        .order('starts_at', {
          ascending: true,
          nullsFirst: false,
        })
        .limit(6),

      supabase
        .from('news')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    if (eventsResult.error) {
      console.error('Events konnten nicht geladen werden:', eventsResult.error.message);
    } else {
      setEvents((eventsResult.data || []) as Entry[]);
    }

    if (newsResult.error) {
      console.error('News konnten nicht geladen werden:', newsResult.error.message);
    } else {
      setNews((newsResult.data || []) as Entry[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase || !supabaseReady) {
      setLoading(false);
      return;
    }

    let active = true;

    async function checkCurrentUser() {
      const { data, error } = await supabase!.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        await loadUser(null);
      } else {
        await loadUser(data.user.id);
      }
    }

    void checkCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      // Supabase empfiehlt, im Auth-Callback keine weiteren
      // Supabase-Abfragen direkt auszuführen.
      const userId = session?.user?.id ?? null;
      setLoading(true);

      setTimeout(() => {
        if (active) void loadUser(userId);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  async function handleLogout() {
    if (!supabase) return;

    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Abmeldung fehlgeschlagen:', error.message);
      setLoggingOut(false);
      return;
    }

    router.replace('/');
    router.refresh();
  }

  const memberArea = (
    <section className="container section">
      <div className="card">
        <Users size={30} color="var(--cyan)" />
        <h2>Dein Mitgliederbereich</h2>

        {profileError ? (
          <>
            <p className="muted">
              Dein Mitgliederstatus konnte nicht geladen werden.
              Bitte versuche es erneut.
            </p>
            <button
              className="btn"
              onClick={() => window.location.reload()}
            >
              Erneut versuchen
            </button>
          </>
        ) : signedIn ? (
          <>
            <p className="muted">
              Dein Konto ist noch nicht für den Mitgliederbereich
              freigeschaltet. Nach der Prüfung durch den Verein
              erhältst du Zugriff auf Termine, Trainings und News.
            </p>
            <button className="btn" onClick={handleLogout}>
              Abmelden
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Melde dich mit deinem freigeschalteten Mitgliedskonto an,
              um Vereinstermine, Trainings, News und Mitgliederangebote
              zu sehen.
            </p>
            <div className="actions">
              <Link className="btn primary" href="/login">
                Jetzt anmelden
              </Link>
              <Link className="btn" href="/mitglied-werden">
                Mitglied werden
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );

  return (
    <>
      <header className="container">
        <nav className="nav">
          <Link className="brand" href="/">
            <img src="/padelclubbing-logo.jpg" alt="Padelclubbing Logo" />
            <span>PADELCLUBBING</span>
          </Link>

          <div className="navlinks">
            {loading ? (
              <span className="muted">Lade Mitgliederbereich …</span>
            ) : isApprovedMember ? (
              <>
                <a href="#training">
                  <CalendarDays size={16} /> Events
                </a>
                <a href="#training-anmeldung">Trainings</a>
                <a href="#news">
                  <Newspaper size={16} /> News
                </a>
                <Link href="/angebote">
                  <Gift size={16} /> Member Benefits
                </Link>
                {isAdmin && <Link href="/admin">Adminbereich</Link>}
                <button
                  className="btn"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut size={16} />
                  {loggingOut ? 'Abmelden …' : 'Abmelden'}
                </button>
              </>
            ) : (
              <>
                <Link href="/login">Mitglieder-Login</Link>
                <Link href="/mitglied-werden">Mitglied werden</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <section className="container hero">
          <img
            className="heroimg"
            src="/padelclubbing-logo.jpg"
            alt="Padelclubbing – Padel Tennis Clubbing"
          />

          <p className="eyebrow">
            {isApprovedMember
              ? 'Welcome back to your club.'
              : 'Your club. Your community.'}
          </p>

          <h1>
            {isApprovedMember ? (
              <>
                Dein Verein.
                <br />
                <span className="gradient">Deine Community.</span>
              </>
            ) : (
              <>
                Mehr als Padel.
                <br />
                <span className="gradient">Wir sind Community.</span>
              </>
            )}
          </h1>

          <p className="lead">
            {isApprovedMember
              ? 'Hier findest du die nächsten Vereinstermine, Trainings, News und exklusiven Vorteile.'
              : 'Gemeinsam trainieren, stärker werden, Turniere spielen und besondere Momente erleben. Willkommen bei Padelclubbing – deinem Padelverein.'}
          </p>

          <div className="actions">
            {loading ? (
              <span className="muted">Prüfe deinen Zugang …</span>
            ) : isApprovedMember ? (
              <>
                <a className="btn primary" href="#training">
                  Termine entdecken <ArrowUpRight size={17} />
                </a>
                <a className="btn" href="#training-anmeldung">
                  Trainingsanmeldung
                </a>
                <Link className="btn" href="/angebote">
                  <Gift size={17} /> Member Benefits
                </Link>
              </>
            ) : (
              <>
                <Link className="btn primary" href="/login">
                  Mitglieder-Login <ArrowUpRight size={17} />
                </Link>
                <Link className="btn" href="/mitglied-werden">
                  Mitglied werden
                </Link>
              </>
            )}
          </div>
        </section>

        {loading ? (
          <section className="container section">
            <div className="empty">Dein Mitgliederbereich wird geladen …</div>
          </section>
        ) : !isApprovedMember ? (
          memberArea
        ) : (
          <>
            <section id="training" className="container section">
              <div className="sectionhead">
                <div>
                  <p className="eyebrow">Auf dem Court</p>
                  <h2>Training &amp; Turniere</h2>
                  <p className="muted">
                    Die nächsten Vereinstermine an einem Ort.
                  </p>
                </div>
              </div>

              {events.length > 0 ? (
                <div className="grid">
                  {events.map((event) => (
                    <article className="card" key={event.id}>
                      {event.image_url && (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          loading="lazy"
                          style={{
                            display: 'block',
                            width: '100%',
                            height: 200,
                            objectFit: 'cover',
                            borderRadius: 10,
                            marginBottom: 14,
                          }}
                        />
                      )}
                      <span className="tag">
                        {event.category || 'Vereinstermin'}
                      </span>
                      <p className="date">{dateLabel(event.starts_at)}</p>
                      <h3>{event.title}</h3>
                      <p className="muted">
                        {event.description || 'Weitere Informationen folgen.'}
                      </p>
                      {event.location && (
                        <p className="small">📍 {event.location}</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  Aktuell sind keine veröffentlichten Vereinstermine vorhanden.
                  Falls Termine angelegt sind, prüfe bitte deren
                  Veröffentlichungsstatus und die Supabase-RLS-Regeln.
                </div>
              )}
            </section>

            <section id="training-anmeldung" className="container section">
              <div className="sectionhead">
                <div>
                  <p className="eyebrow">Gemeinsam am Court</p>
                  <h2>Trainingsanmeldung</h2>
                  <p className="muted">
                    Entdecke die nächsten Trainings und sichere dir deinen
                    Platz. Bei ausgebuchten Trainings ist eine Warteliste möglich.
                  </p>
                </div>
              </div>
              <TrainingList />
            </section>

            <section id="news" className="container section">
              <div className="sectionhead">
                <div>
                  <p className="eyebrow">Was sich tut</p>
                  <h2>Vereinsnews</h2>
                </div>
              </div>

              {news.length > 0 ? (
                <div className="grid">
                  {news.map((item) => (
                    <article className="card" key={item.id}>
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          loading="lazy"
                          style={{
                            display: 'block',
                            width: '100%',
                            height: 200,
                            objectFit: 'cover',
                            borderRadius: 10,
                            marginBottom: 14,
                          }}
                        />
                      )}
                      <span className="tag">News</span>
                      <h3>{item.title}</h3>
                      <p className="muted">
                        {item.description || 'Weitere Informationen folgen.'}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  Aktuell gibt es keine veröffentlichten Vereinsnews.
                </div>
              )}
            </section>

            <section id="verein" className="container section">
              <div className="grid">
                <article className="card">
                  <Users color="var(--cyan)" size={28} />
                  <h3>Verein &amp; Community</h3>
                  <p className="muted">
                    Gemeinsam besser werden, neue Leute kennenlernen und
                    Padel erleben.
                  </p>
                </article>

                <article className="card">
                  <Trophy color="var(--pink)" size={28} />
                  <h3>Turniere &amp; Meisterschaften</h3>
                  <p className="muted">
                    Spiele mit, sammle Erfahrung und vertrete unseren Verein.
                  </p>
                </article>

                <article className="card">
                  <Images color="#b78aff" size={28} />
                  <h3>Erinnerungen teilen</h3>
                  <p className="muted">
                    Fotos und Highlights unserer Trainings und Events an
                    einem Ort.
                  </p>
                </article>

                <Link
                  href="/angebote"
                  className="card"
                  style={{
                    display: 'block',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <Gift color="var(--cyan)" size={28} />
                  <h3>Member Benefits</h3>
                  <p className="muted">
                    Exklusive Angebote, Sponsorvorteile und Rabattcodes für
                    unsere Mitglieder.
                  </p>
                  <span className="btn">
                    Angebote entdecken <ArrowUpRight size={17} />
                  </span>
                </Link>
              </div>

              <div className="actions">
                <a
                  className="btn"
                  href="https://www.padelclubbing.at/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Bisherige Website ↗
                </a>
                <a
                  className="btn"
                  href="https://www.instagram.com/padelclubbing/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Instagram size={17} /> Instagram
                </a>
                <a className="btn" href="mailto:thepadelclubbing@gmail.com">
                  thepadelclubbing@gmail.com
                </a>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <div className="container">
          © {new Date().getFullYear()} Padelclubbing ·{' '}
          <a href="https://www.padelclubbing.at/">padelclubbing.at</a>
          <p>
            Hinweis: Impressum und Datenschutzerklärung sollten über separate
            Seiten erreichbar sein.
          </p>
        </div>
      </footer>
    </>
  );
}
