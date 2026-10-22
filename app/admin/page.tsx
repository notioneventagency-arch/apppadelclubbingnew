'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseReady } from '@/lib/supabase';
import TrainingManagement from '@/components/training-management';
import {
  Plus,
  Pencil,
  LogOut,
  Trash2,
  RefreshCw,
  Check,
  X,
  Users,
} from 'lucide-react';

type Entry = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  location: string | null;
  category: string | null;
  published: boolean;
  created_at?: string;
  image_url?: string | null;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  skill_level: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  role: 'member' | 'admin';
  created_at: string;
};

export default function Admin() {
  const router = useRouter();

  const [user, setUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<Entry[]>([]);
  const [news, setNews] = useState<Entry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [kind, setKind] = useState<'events' | 'news'>('events');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Training');
  const [published, setPublished] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;

    const {
      data: { user: currentUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      router.replace('/login');
      return;
    }

    setUser(currentUser.email || 'Admin');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== 'admin' ||
      profile.status !== 'approved'
    ) {
      setIsAdmin(false);
      setMessage('Kein Adminzugriff. Bitte mit einem Admin-Konto anmelden.');
      return;
    }

    setIsAdmin(true);

    const [e, n, m] = await Promise.all([
      supabase.from('events').select('*').order('starts_at', {
        ascending: true,
        nullsFirst: false,
      }),
      supabase.from('news').select('*').order('created_at', {
        ascending: false,
      }),
      supabase.from('profiles').select('*').order('created_at', {
        ascending: false,
      }),
    ]);

    if (e.error || n.error || m.error) {
      setMessage(
        'Fehler beim Laden. Bitte Tabellen und Supabase-Berechtigungen prüfen.'
      );
      return;
    }

    setEvents((e.data || []) as Entry[]);
    setNews((n.data || []) as Entry[]);
    setMembers((m.data || []) as Member[]);
  }, [router]);

  useEffect(() => {
    if (supabaseReady) {
      void load();
    }
  }, [load]);

  function startEdit(table: 'events' | 'news', entry: Entry) {
    setKind(table);
    setEditingId(entry.id);
    setTitle(entry.title || '');
    setDescription(entry.description || '');
    setStartsAt(entry.starts_at ? new Date(entry.starts_at).toISOString().slice(0, 16) : '');
    setLocation(entry.location || '');
    setCategory(entry.category || 'Training');
    setPublished(Boolean(entry.published));
    setImageUrl(entry.image_url || '');
    setImageFile(null);
    setMessage('Eintrag wird bearbeitet. Änderungen unten speichern.');
    document.getElementById('new')?.scrollIntoView({ behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setStartsAt('');
    setLocation('');
    setCategory('Training');
    setPublished(true);
    setImageUrl('');
    setImageFile(null);
    const fileInput = document.getElementById('entry-image') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !isAdmin) {
      setMessage('Du benötigst Adminrechte, um Inhalte zu speichern.');
      return;
    }
    setBusy(true);
    setMessage('');

    let finalImageUrl = imageUrl || null;
    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('training-images')
        .upload(path, imageFile, { upsert: false, contentType: imageFile.type });
      if (uploadError) {
        setBusy(false);
        setMessage('Bild-Upload fehlgeschlagen: ' + uploadError.message);
        return;
      }
      finalImageUrl = supabase.storage.from('training-images').getPublicUrl(path).data.publicUrl;
    }

    const row: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      published,
    };
    if (kind === 'events') {
      row.starts_at = startsAt ? new Date(startsAt).toISOString() : null;
      row.location = location.trim() || null;
      row.category = category || 'Vereinstermin';
    }
    row.image_url = finalImageUrl;

    const query = editingId
      ? supabase.from(kind).update(row).eq('id', editingId)
      : supabase.from(kind).insert(row);
    const { error } = await query;
    setBusy(false);
    if (error) {
      setMessage('Fehler: ' + error.message);
      return;
    }
    setMessage(editingId ? 'Änderungen erfolgreich gespeichert.' : 'Eintrag erfolgreich gespeichert.');
    resetForm();
    await load();
  }

  async function remove(table: 'events' | 'news', id: string) {
    if (!supabase || !isAdmin) return;
    if (!confirm('Diesen Eintrag wirklich löschen?')) return;

    const { error } = await supabase.from(table).delete().eq('id', id);

    setMessage(error ? 'Fehler: ' + error.message : 'Eintrag gelöscht.');
    await load();
  }

  async function updateMemberStatus(
    id: string,
    status: 'approved' | 'rejected'
  ) {
    if (!supabase || !isAdmin || busy) return;

    const member = members.find((m) => m.id === id);
    if (!member) return;

    const action = status === 'approved' ? 'freigeben' : 'ablehnen';

    if (
      !confirm(
        `Mitgliedsantrag von ${member.first_name} ${member.last_name} ${action}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');

    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', id)
      .eq('role', 'member');

    setBusy(false);

    if (error) {
      setMessage('Fehler bei der Freigabe: ' + error.message);
      return;
    }

    setMessage(
      status === 'approved'
        ? 'Mitglied erfolgreich freigegeben.'
        : 'Mitgliedsantrag abgelehnt.'
    );

    await load();
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  if (!supabaseReady) {
    return (
      <main className="container section">
        <h1>Supabase ist nicht verbunden</h1>
        <p>Bitte die Supabase-Umgebungsvariablen in Vercel überprüfen.</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="container section">
        <h1>Adminbereich</h1>
        <p>{message || 'Adminberechtigung wird überprüft …'}</p>
        <Link className="btn" href="/login">
          Zum Login
        </Link>
      </main>
    );
  }

  const pendingMembers = members.filter((m) => m.status === 'pending');
  const processedMembers = members.filter((m) => m.status !== 'pending');

  return (
    <main className="container">
      <nav className="nav">
        <Link className="brand" href="/">
          <img src="/padelclubbing-logo.jpg" alt="Logo" />
          <span>PADELCLUBBING ADMIN</span>
        </Link>
        <div className="navlinks">
          <Link href="/">Website ansehen ↗</Link>
          <span>{user}</span>
          <button className="btn" onClick={logout}>
            <LogOut size={15} /> Abmelden
          </button>
        </div>
      </nav>

      <div className="adminlayout">
        <aside className="side card">
          <p className="eyebrow">Verwaltung</p>
          <a href="#members">Mitglieder ({pendingMembers.length} offen)</a>
          <a href="#new">+ Neuer Eintrag</a>
          <a href="#training-management">Trainingsverwaltung & Anmeldungen</a>
          <a href="#events">Bisherige Termine & Turniere</a>
          <a href="#news">News verwalten</a>
          <a href="mailto:thepadelclubbing@gmail.com">Hilfe / Kontakt</a>
        </aside>

        <div>
          <p className="eyebrow">Dein Verein. Deine Inhalte.</p>
          <h1 style={{ fontSize: 38, margin: '8px 0 16px' }}>
            Admin-Dashboard
          </h1>

          {message && <p className="success" role="status">{message}</p>}

          <section id="members" className="section">
            <div className="sectionhead">
              <div>
                <p className="eyebrow">Mitgliederverwaltung</p>
                <h2>Mitgliedsanträge</h2>
                <p className="muted">
                  {pendingMembers.length} Antrag/Anträge warten auf Freigabe.
                </p>
              </div>
              <button className="btn" onClick={() => void load()}>
                <RefreshCw size={15} /> Aktualisieren
              </button>
            </div>

            <div className="adminlist">
              {pendingMembers.length === 0 ? (
                <div className="empty">
                  <Users size={24} />
                  <p>Keine offenen Mitgliedsanträge.</p>
                </div>
              ) : (
                pendingMembers.map((m) => (
                  <article className="adminitem" key={m.id}>
                    <div>
                      <strong>
                        {m.first_name} {m.last_name}
                      </strong>
                      <p>
                        {m.phone || 'Keine Telefonnummer'} ·{' '}
                        {m.skill_level || 'Keine Spielstärke'}
                      </p>
                      {m.message && <p>{m.message}</p>}
                      <p className="small">
                        Antrag vom{' '}
                        {new Date(m.created_at).toLocaleDateString('de-AT')}
                      </p>
                      <span className="tag">Wartet auf Freigabe</span>
                    </div>

                    <div className="actions">
                      <button
                        className="btn primary"
                        disabled={busy}
                        onClick={() =>
                          void updateMemberStatus(m.id, 'approved')
                        }
                      >
                        <Check size={16} /> Freigeben
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void updateMemberStatus(m.id, 'rejected')
                        }
                      >
                        <X size={16} /> Ablehnen
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <h3 style={{ marginTop: 24 }}>Bearbeitete Anträge</h3>
            <div className="adminlist">
              {processedMembers.length === 0 ? (
                <div className="empty">Noch keine bearbeiteten Anträge.</div>
              ) : (
                processedMembers.map((m) => (
                  <article className="adminitem" key={m.id}>
                    <div>
                      <strong>
                        {m.first_name} {m.last_name}
                      </strong>
                      <p>
                        {m.status === 'approved'
                          ? 'Freigegeben'
                          : 'Abgelehnt'}
                      </p>
                    </div>
                    <span className="tag">{m.status}</span>
                  </article>
                ))
              )}
            </div>
          </section>

          <section id="new" className="card" style={{ marginTop: 16 }}>
            <h2>{editingId ? 'Eintrag bearbeiten' : 'Neuen Inhalt erstellen'}</h2>

            <div className="actions">
              <button
                className={'btn ' + (kind === 'events' ? 'primary' : '')}
                onClick={() => { if (kind !== 'events') resetForm(); setKind('events'); }}
              >
                Training / Turnier
              </button>
              <button
                className={'btn ' + (kind === 'news' ? 'primary' : '')}
                onClick={() => { if (kind !== 'news') resetForm(); setKind('news'); }}
              >
                Vereinsnews
              </button>
            </div>

            <form className="form" onSubmit={save} style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor="title">Titel</label>
                <input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    kind === 'events'
                      ? 'z. B. Vereinstraining in Wildon'
                      : 'z. B. Rückblick auf unser Turnier'
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="description">Beschreibung</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Alle wichtigen Informationen …"
                />
              </div>

              {kind === 'events' ? (
                <>
                  <div className="field">
                    <label htmlFor="startsAt">Datum und Uhrzeit</label>
                    <input
                      id="startsAt"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="location">Ort</label>
                    <input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="z. B. Wildon"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="category">Art</label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option>Training</option>
                      <option>Turnier</option>
                      <option>Meisterschaft</option>
                      <option>Vereinsevent</option>
                      <option>Clubbing</option>
                    </select>
                  </div>
                </>
              )}

              <div className="field">
                <label htmlFor="entry-image">Bild hochladen (optional)</label>
                <input
                  id="entry-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                <span className="small">
                  Ein neues Foto ersetzt das bisherige Bild. {imageUrl && !imageFile ? 'Aktuell ist bereits ein Bild hinterlegt.' : 'Unterstützt JPG, PNG und WebP.'}
                </span>
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                Sofort öffentlich anzeigen
              </label>

              <div className="actions">
                <button className="btn primary" disabled={busy}>
                  {editingId ? <Pencil size={17} /> : <Plus size={17} />}
                  {busy ? 'Speichert …' : editingId ? 'Änderungen speichern' : 'Eintrag speichern'}
                </button>
                {editingId && <button type="button" className="btn" onClick={resetForm}>Bearbeitung abbrechen</button>}
              </div>
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
                    <div className="actions">
                      <button type="button" className="btn" onClick={() => startEdit('events', x)}>
                        <Pencil size={16} /> Bearbeiten
                      </button>
                      <button type="button" className="btn" aria-label="Löschen" onClick={() => void remove('events', x.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                    <div className="actions">
                      <button type="button" className="btn" onClick={() => startEdit('news', x)}>
                        <Pencil size={16} /> Bearbeiten
                      </button>
                      <button type="button" className="btn" aria-label="Löschen" onClick={() => void remove('news', x.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
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
