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
import { supabase } from '@/lib/supabase';
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

function dateLabel(value: string | null) {
  if (!value) return 'Termin folgt';

  return new Date(value).toLocaleDateString('de-AT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function getEntries(
  table: 'events' | 'news'
): Promise<Entry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('published', true)
    .order(table === 'events' ? 'starts_at' : 'created_at', {
      ascending: table === 'events',
      nullsFirst: false,
    })
    .limit(6);

  if (error) {
    console.error(`Fehler beim Laden von ${table}:`, error.message);
    return [];
  }

  return (data || []) as Entry[];
}

export default async function Home() {
  let isApprovedMember = false;
  let isAdmin = false;
  let signedIn = false;
  let profileError = false;

  if (supabase) {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (!authError && authData.user) {
      signedIn = true;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role,status')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (error) {
        profileError = true;
      } else if (profile?.status === 'approved') {
        isAdmin = profile.role === 'admin';
        isApprovedMember =
          profile.role === 'member' || isAdmin;
      }
    }
  }

  // Die Clubinhalte werden erst für freigeschaltete Konten geladen.
  const [events, news] = isApprovedMember
    ? await Promise.all([
        getEntries('events'),
        getEntries('news'),
      ])
    : [[], []];

  return (
    <>
      <header className="container">
        <nav className="nav">
          <Link className="brand" href="/">
            <img
              src="/padelclubbing-logo.jpg"
              alt="Padelclubbing Logo"
            />
            <span>PADELCLUBBING</span>
          </Link>

          <div className="navlinks">
            {isApprovedMember ? (
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
                <Link href="/logout">
                  <LogOut size={16} /> Abmelden
                </Link>
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
            {isApprovedMember ? (
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

        {!isApprovedMember ? (
          <section className="container section">
            <div className="card">
              <Users size={30} color="var(--cyan)" />
              <h2>Dein Mitgliederbereich</h2>

              {profileError ? (
                <p className="muted">
                  Dein Mitgliederstatus konnte gerade nicht geprüft
                  werden. Bitte lade die Seite erneut oder melde dich
                  noch einmal an.
                </p>
              ) : signedIn ? (
                <>
                  <p className="muted">
                    Dein Konto ist noch nicht für den Mitgliederbereich
                    freigeschaltet. Nach der Prüfung durch den Verein
                    erhältst du Zugriff auf Termine, Trainings und News.
                  </p>
                  <Link className="btn" href="/login">
                    Status prüfen
                  </Link>
                </>
              ) : (
                <>
                  <p className="muted">
                    Melde dich mit deinem freigeschalteten Mitgliedskonto
                    an, um Vereinstermine, Trainings, News und
                    Mitgliederangebote zu sehen.
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
                      <p className="date">
                        {dateLabel(event.starts_at)}
                      </p>
                      <h3>{event.title}</h3>
                      <p className="muted">
                        {event.description ||
                          'Weitere Informationen folgen.'}
                      </p>
                      {event.location && (
                        <p className="small">📍 {event.location}</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  Aktuell sind keine veröffentlichten Vereinstermine
                  vorhanden.
                </div>
              )}
            </section>

            <section
              id="training-anmeldung"
              className="container section"
            >
              <div className="sectionhead">
                <div>
                  <p className="eyebrow">Gemeinsam am Court</p>
                  <h2>Trainingsanmeldung</h2>
                  <p className="muted">
                    Entdecke die nächsten Trainings und sichere dir
                    deinen Platz. Bei ausgebuchten Trainings ist eine
                    Warteliste möglich.
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
                        {item.description ||
                          'Weitere Informationen folgen.'}
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
                    Spiele mit, sammle Erfahrung und vertrete unseren
                    Verein.
                  </p>
                </article>

                <article className="card">
                  <Images color="#b78aff" size={28} />
                  <h3>Erinnerungen teilen</h3>
                  <p className="muted">
                    Fotos und Highlights unserer Trainings und Events
                    an einem Ort.
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
                    Exklusive Angebote, Sponsorvorteile und Rabattcodes
                    für unsere Mitglieder.
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
                <a
                  className="btn"
                  href="mailto:thepadelclubbing@gmail.com"
                >
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
          <a href="https://www.padelclubbing.at/">
            padelclubbing.at
          </a>
          <p>
            Hinweis: Impressum und Datenschutzerklärung sollten über
            separate Seiten erreichbar sein.
          </p>
        </div>
      </footer>
    </>
  );
}
