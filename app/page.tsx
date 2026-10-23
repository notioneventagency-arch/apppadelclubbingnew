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
import PushNotifications from '@/components/push-notifications';

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

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

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
      console.error(
        'Profil konnte nicht geladen werden:',
        profileQueryError.message,
      );
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
      console.error(
        'Events konnten nicht geladen werden:',
        eventsResult.error.message,
      );
    } else {
      setEvents((eventsResult.data || []) as Entry[]);
    }

    if (newsResult.error) {
      console.error(
        'News konnten nicht geladen werden:',
        newsResult.error.message,
      );
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

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase || !supabaseReady) {
      setLoginMessage(
        'Die Verbindung zum Mitgliederportal ist momentan nicht verfügbar.',
      );
      return;
    }

    setLoginBusy(true);
    setLoginMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error || !data.user) {
        setLoginMessage(
          'Anmeldung nicht möglich. Bitte überprüfe deine E-Mail-Adresse und dein Passwort.',
        );
        return;
      }

      setLoading(true);

      const { data: profile, error: profileQueryError } = await supabase
        .from('profiles')
        .select('role,status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileQueryError) {
        setLoginMessage(
          'Du bist angemeldet, aber dein Mitgliederstatus konnte nicht geprüft werden. Bitte versuche es erneut.',
        );
        return;
      }

      const memberProfile = profile as Profile | null;

      if (
        !memberProfile ||
        memberProfile.status !== 'approved' ||
        !['member', 'admin'].includes(memberProfile.role)
      ) {
        setLoginMessage(
          'Dein Konto ist noch nicht freigeschaltet. Der Verein muss deine Registrierung zuerst prüfen.',
        );
        await loadUser(data.user.id);
        setLoginPassword('');
        return;
      }

      setLoginPassword('');
      await loadUser(data.user.id);
    } catch {
      setLoginMessage(
        'Die Anmeldung ist fehlgeschlagen. Bitte versuche es später erneut.',
      );
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;

    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Abmeldung fehlgeschlagen:', error.message);
      setLoggingOut(false);
      return;
    }

    setLoginMessage('');
    setLoginPassword('');
    setAuthMode('login');
    setLoading(true);

    router.replace('/');
    router.refresh();
  }

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
                <Link href="/kalender">
                  <CalendarDays size={16} /> Kalender
                </Link>

                <a href="#training">
                  <Trophy size={16} /> Events
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
                <Link href="/kalender">
                  <CalendarDays size={16} /> Kalender
                </Link>
                <a href="#mitgliederzugang">Mitgliederzugang</a>
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

          {isApprovedMember && (
            <div className="actions">
              <Link className="btn primary" href="/kalender">
                <CalendarDays size={17} />
                Kalender öffnen
                <ArrowUpRight size={17} />
              </Link>

              <a className="btn" href="#training">
                Termine entdecken <ArrowUpRight size={17} />
              </a>

              <a className="btn" href="#training-anmeldung">
                Trainingsanmeldung
              </a>

              <Link className="btn" href="/angebote">
                <Gift size={17} /> Member Benefits
              </Link>
            </div>
          )}

          {!isApprovedMember && (
            <div className="actions">
              <Link className="btn primary" href="/kalender">
                <CalendarDays size={17} />
                Kalender ansehen
                <ArrowUpRight size={17} />
              </Link>
              <a className="btn" href="#mitgliederzugang">
                Mitgliederzugang
              </a>
            </div>
          )}
        </section>

        {loading ? (
          <section className="container section">
            <div className="empty">Dein Mitgliederbereich wird geladen …</div>
          </section>
        ) : !isApprovedMember ? (
          <section id="mitgliederzugang" className="container section">
            <div
              className="card"
              style={{
                maxWidth: 460,
                margin: '0 auto',
                padding: 28,
                borderRadius: 22,
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 18,
                    margin: '0 auto 16px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(34,211,238,0.12)',
                    color: 'var(--cyan)',
                  }}
                >
                  <Users size={28} />
                </div>

                <p className="eyebrow">PADELCLUBBING MEMBER AREA</p>

                <h2>
                  {signedIn
                    ? 'Dein Zugang'
                    : authMode === 'login'
                      ? 'Willkommen zurück'
                      : 'Mitglied werden'}
                </h2>

                <p className="muted">
                  {signedIn
                    ? 'Deine Registrierung wird vom Verein geprüft.'
                    : authMode === 'login'
                      ? 'Melde dich an und entdecke deinen Club.'
                      : 'Beantrage deinen persönlichen Zugang zum Mitgliederportal.'}
                </p>
              </div>

              {signedIn ? (
                <>
                  <div className="empty" style={{ marginBottom: 18 }}>
                    {profileError
                      ? 'Dein Mitgliederstatus konnte nicht geladen werden. Bitte versuche es erneut.'
                      : 'Dein Konto ist noch nicht für den Mitgliederbereich freigeschaltet. Nach der Freigabe erhältst du Zugang zu Events, Trainings, News und Member Benefits.'}
                  </div>

                  <button
                    className="btn"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <LogOut size={17} />
                    {loggingOut ? 'Abmelden …' : 'Abmelden'}
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="actions"
                    style={{ marginBottom: 22, justifyContent: 'center' }}
                  >
                    <button
                      type="button"
                      className={authMode === 'login' ? 'btn primary' : 'btn'}
                      onClick={() => {
                        setAuthMode('login');
                        setLoginMessage('');
                      }}
                    >
                      Benutzer-Login
                    </button>

                    <button
                      type="button"
                      className={
                        authMode === 'register' ? 'btn primary' : 'btn'
                      }
                      onClick={() => {
                        setAuthMode('register');
                        setLoginMessage('');
                      }}
                    >
                      Mitglied werden
                    </button>
                  </div>

                  {authMode === 'login' ? (
                    <form onSubmit={handleLogin}>
                      <div style={{ marginBottom: 16 }}>
                        <label
                          htmlFor="home-email"
                          style={{
                            display: 'block',
                            marginBottom: 8,
                          }}
                        >
                          E-Mail-Adresse
                        </label>

                        <input
                          id="home-email"
                          type="email"
                          autoComplete="username"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="name@beispiel.at"
                          style={{
                            width: '100%',
                            padding: '14px 16px',
                            borderRadius: 12,
                            border: '1px solid var(--border, #333)',
                            background: 'var(--input-bg, #111)',
                            color: 'inherit',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: 18 }}>
                        <label
                          htmlFor="home-password"
                          style={{
                            display: 'block',
                            marginBottom: 8,
                          }}
                        >
                          Passwort
                        </label>

                        <input
                          id="home-password"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Dein Passwort"
                          style={{
                            width: '100%',
                            padding: '14px 16px',
                            borderRadius: 12,
                            border: '1px solid var(--border, #333)',
                            background: 'var(--input-bg, #111)',
                            color: 'inherit',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {loginMessage && (
                        <p
                          role="alert"
                          className="muted"
                          style={{
                            color: 'var(--pink, #fb7185)',
                            marginBottom: 16,
                          }}
                        >
                          {loginMessage}
                        </p>
                      )}

                      <button
                        className="btn primary"
                        type="submit"
                        disabled={loginBusy}
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          padding: 15,
                        }}
                      >
                        {loginBusy ? 'Anmeldung läuft …' : 'Jetzt anmelden'}
                        {!loginBusy && <ArrowUpRight size={18} />}
                      </button>

                      <p
                        style={{
                          textAlign: 'center',
                          marginTop: 18,
                        }}
                      >
                        <Link href="/login" className="muted">
                          Passwort vergessen?
                        </Link>
                      </p>
                    </form>
                  ) : (
                    <div>
                      <p className="muted">
                        Nach deiner Registrierung prüft der Verein deine
                        Angaben. Dein Zugang zu den geschützten Inhalten wird
                        erst nach der Freigabe aktiviert.
                      </p>

                      <Link
                        href="/mitglied-werden"
                        className="btn primary"
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          marginTop: 18,
                        }}
                      >
                        Registrierung öffnen <ArrowUpRight size={18} />
                      </Link>
                    </div>
                  )}
                </>
              )}

              <p
                className="muted"
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  marginTop: 22,
                  marginBottom: 0,
                }}
              >
                Geschützter Mitgliederbereich · Freischaltung durch den Verein
              </p>
            </div>
          </section>
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

                <Link className="btn" href="/kalender">
                  <CalendarDays size={17} />
                  Alle Termine
                  <ArrowUpRight size={17} />
                </Link>
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
                    Platz. Bei ausgebuchten Trainings ist eine Warteliste
                    möglich.
                  </p>
                </div>
              </div>

              <PushNotifications />
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
                    Gemeinsam besser werden, neue Leute kennenlernen und Padel
                    erleben.
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
                    Fotos und Highlights unserer Trainings und Events an einem
                    Ort.
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
