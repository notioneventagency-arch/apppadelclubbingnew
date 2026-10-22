'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { supabase, supabaseReady } from '@/lib/supabase';

type Offer = {
  id: string;
  title: string;
  partner_name: string;
  description: string | null;
  discount_label: string | null;
  coupon_code: string | null;
  image_url: string | null;
  website_url: string | null;
  valid_until: string | null;
  published: boolean;
};

const BUCKET_NAME = 'Benefits';

const emptyForm = {
  title: '',
  partner_name: '',
  description: '',
  discount_label: '',
  coupon_code: '',
  image_url: '',
  website_url: '',
  valid_until: '',
  published: true,
};

export default function AdminOffersPage() {
  const router = useRouter();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage('Supabase ist nicht verbunden.');
      setChecking(false);
      return;
    }

    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      router.replace('/login');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role,status')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== 'admin' ||
      profile.status !== 'approved'
    ) {
      setMessage('Nur freigeschaltete Admins dürfen Angebote verwalten.');
      setChecking(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from('member_offers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage('Angebote konnten nicht geladen werden: ' + error.message);
    } else {
      setOffers((data || []) as Offer[]);
    }

    setChecking(false);
  }, [router]);

  useEffect(() => {
    if (supabaseReady) {
      void load();
    } else {
      setMessage('Supabase ist nicht verbunden.');
      setChecking(false);
    }
  }, [load]);

  function startEdit(offer: Offer) {
    setEditingId(offer.id);

    setForm({
      title: offer.title || '',
      partner_name: offer.partner_name || '',
      description: offer.description || '',
      discount_label: offer.discount_label || '',
      coupon_code: offer.coupon_code || '',
      image_url: offer.image_url || '',
      website_url: offer.website_url || '',
      valid_until: offer.valid_until || '',
      published: offer.published,
    });

    setImageFile(null);

    const input = document.getElementById(
      'offer-image',
    ) as HTMLInputElement | null;

    if (input) input.value = '';

    document
      .getElementById('offer-form')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);

    const input = document.getElementById(
      'offer-image',
    ) as HTMLInputElement | null;

    if (input) input.value = '';
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase || !isAdmin) return;

    setBusy(true);
    setMessage('');

    let imageUrl = form.image_url.trim() || null;

    // Neues Bild in den Supabase-Bucket "Benefits" hochladen
    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `member-offers/${Date.now()}-${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, imageFile, {
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        setBusy(false);
        setMessage(
          'Bild-Upload fehlgeschlagen: ' +
            uploadError.message +
            '. Bitte prüfe, ob der Bucket "Benefits" existiert und ob die Upload-Berechtigungen gesetzt sind.',
        );
        return;
      }

      const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadData.path);

      imageUrl = publicData.publicUrl;
    }

    const row = {
      title: form.title.trim(),
      partner_name: form.partner_name.trim(),
      description: form.description.trim() || null,
      discount_label: form.discount_label.trim() || null,
      coupon_code: form.coupon_code.trim() || null,
      image_url: imageUrl,
      website_url: form.website_url.trim() || null,
      valid_until: form.valid_until || null,
      published: form.published,
    };

    const result = editingId
      ? await supabase
          .from('member_offers')
          .update(row)
          .eq('id', editingId)
      : await supabase.from('member_offers').insert(row);

    setBusy(false);

    if (result.error) {
      setMessage('Speichern fehlgeschlagen: ' + result.error.message);
      return;
    }

    setMessage(editingId ? 'Angebot aktualisiert.' : 'Angebot erstellt.');

    reset();
    await load();
  }

  async function remove(id: string) {
    if (
      !supabase ||
      !confirm('Dieses Partnerangebot wirklich löschen?')
    ) {
      return;
    }

    const { error } = await supabase
      .from('member_offers')
      .delete()
      .eq('id', id);

    setMessage(
      error
        ? 'Löschen fehlgeschlagen: ' + error.message
        : 'Angebot gelöscht.',
    );

    await load();
  }

  if (checking) {
    return (
      <main className="container section">
        <p>Adminzugang wird geprüft …</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="container section">
        <h1>Angebote verwalten</h1>
        <p>{message || 'Kein Adminzugriff.'}</p>
        <Link className="btn" href="/login">
          Zum Login
        </Link>
      </main>
    );
  }

  return (
    <main className="container section">
      <nav className="nav">
        <Link className="brand" href="/">
          <img src="/padelclubbing-logo.jpg" alt="Logo" />
          <span>PADELCLUBBING ADMIN</span>
        </Link>

        <div className="navlinks">
          <Link href="/angebote">Member Benefits ansehen</Link>
          <Link href="/admin">
            <ArrowLeft
              size={15}
              style={{ display: 'inline', verticalAlign: 'middle' }}
            />{' '}
            Admin-Dashboard
          </Link>
        </div>
      </nav>

      <p className="eyebrow">Partner &amp; Sponsoren</p>
      <h1>Member Benefits verwalten</h1>
      <p className="muted">
        Lege Sponsorenangebote an, lade Partnerfotos und Logos hoch und
        hinterlege Rabattcodes. Nur veröffentlichte Angebote sehen Mitglieder.
      </p>

      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}

      <section
        id="offer-form"
        className="card"
        style={{ marginTop: 20 }}
      >
        <h2>{editingId ? 'Angebot bearbeiten' : 'Neues Partnerangebot'}</h2>

        <form className="form" onSubmit={save}>
          <div className="field">
            <label htmlFor="offer-title">Angebotstitel *</label>
            <input
              id="offer-title"
              required
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              placeholder="z. B. Rabatt auf Padel-Schläger"
            />
          </div>

          <div className="field">
            <label htmlFor="partner-name">Sponsor / Partner *</label>
            <input
              id="partner-name"
              required
              value={form.partner_name}
              onChange={(e) =>
                setForm({ ...form, partner_name: e.target.value })
              }
              placeholder="Name des Unternehmens"
            />
          </div>

          <div className="field">
            <label htmlFor="offer-description">Beschreibung</label>
            <textarea
              id="offer-description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Was ist im Angebot enthalten? Gibt es Bedingungen?"
            />
          </div>

          <div className="field">
            <label htmlFor="discount-label">Rabatt / Vorteil</label>
            <input
              id="discount-label"
              value={form.discount_label}
              onChange={(e) =>
                setForm({ ...form, discount_label: e.target.value })
              }
              placeholder="z. B. -15 %, 2 für 1 oder Gratis-Test"
            />
          </div>

          <div className="field">
            <label htmlFor="coupon-code">Rabattcode (optional)</label>
            <input
              id="coupon-code"
              value={form.coupon_code}
              onChange={(e) =>
                setForm({ ...form, coupon_code: e.target.value })
              }
              placeholder="z. B. PADELCLUBBING15"
            />
          </div>

          <div className="field">
            <label htmlFor="offer-image">Sponsorbild / Logo hochladen</label>
            <input
              id="offer-image"
              type="file"
              accept="image/*"
              onChange={(e) =>
                setImageFile(e.target.files?.[0] || null)
              }
            />
            <span className="small">
              <Upload
                size={13}
                style={{ display: 'inline', verticalAlign: 'middle' }}
              />{' '}
              Das Bild wird im Supabase-Bucket „Benefits“ gespeichert.
            </span>
          </div>

          <div className="field">
            <label htmlFor="offer-image-url">Bild-URL (optional)</label>
            <input
              id="offer-image-url"
              type="url"
              value={form.image_url}
              onChange={(e) =>
                setForm({ ...form, image_url: e.target.value })
              }
              placeholder="https://…"
            />
            <span className="small">
              Wenn du ein neues Bild hochlädst, wird diese URL überschrieben.
            </span>
          </div>

          <div className="field">
            <label htmlFor="offer-website">Partner-Website (optional)</label>
            <input
              id="offer-website"
              type="url"
              value={form.website_url}
              onChange={(e) =>
                setForm({ ...form, website_url: e.target.value })
              }
              placeholder="https://…"
            />
          </div>

          <div className="field">
            <label htmlFor="offer-valid">Gültig bis (optional)</label>
            <input
              id="offer-valid"
              type="date"
              value={form.valid_until}
              onChange={(e) =>
                setForm({ ...form, valid_until: e.target.value })
              }
            />
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) =>
                setForm({ ...form, published: e.target.checked })
              }
            />
            Für Mitglieder veröffentlichen
          </label>

          <div className="actions">
            <button className="btn primary" disabled={busy}>
              <Plus size={16} />
              {busy
                ? 'Speichert …'
                : editingId
                  ? 'Änderungen speichern'
                  : 'Angebot speichern'}
            </button>

            {editingId && (
              <button
                type="button"
                className="btn"
                onClick={reset}
                disabled={busy}
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="section">
        <div className="sectionhead">
          <div>
            <p className="eyebrow">Übersicht</p>
            <h2>Gespeicherte Angebote</h2>
          </div>
        </div>

        {offers.length ? (
          <div className="adminlist">
            {offers.map((offer) => (
              <article className="adminitem" key={offer.id}>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    minWidth: 0,
                  }}
                >
                  {offer.image_url && (
                    <img
                      src={offer.image_url}
                      alt=""
                      style={{
                        width: 76,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 8,
                      }}
                    />
                  )}

                  <div>
                    <strong>{offer.title}</strong>
                    <p>
                      {offer.partner_name} ·{' '}
                      {offer.discount_label || 'Kein Rabattlabel'} ·{' '}
                      {offer.published ? 'Veröffentlicht' : 'Entwurf'}
                    </p>

                    {offer.coupon_code && (
                      <p className="small">Code: {offer.coupon_code}</p>
                    )}
                  </div>
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => startEdit(offer)}
                  >
                    <Pencil size={15} /> Bearbeiten
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => void remove(offer.id)}
                    aria-label="Angebot löschen"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">Noch keine Angebote angelegt.</div>
        )}
      </section>
    </main>
  );
}
