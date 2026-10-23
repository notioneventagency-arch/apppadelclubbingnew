'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  ExternalLink,
  Gift,
  LogOut,
  RefreshCw,
  Tag,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
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
};

export default function MemberOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !supabaseReady) {
      setMessage('Die Verbindung zum Mitgliederportal ist momentan nicht verfügbar.');
      setChecking(false);
      setRefreshing(false);
      return;
    }

    setMessage('');

    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      router.replace('/login');
      setChecking(false);
      setRefreshing(false);
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
      profile.status !== 'approved' ||
      !['member', 'admin'].includes(profile.role)
    ) {
      setAllowed(false);
      setIsAdmin(false);
      setMessage('Diese Seite ist nur für freigeschaltete Mitglieder zugänglich.');
      setChecking(false);
      setRefreshing(false);
      return;
    }

    setAllowed(true);
    setIsAdmin(profile.role === 'admin');

    const { data, error } = await supabase
      .from('member_offers')
      .select('id,title,partner_name,description,discount_label,coupon_code,image_url,website_url,valid_until')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      setMessage('Angebote konnten nicht geladen werden. Bitte versuche es erneut.');
    } else {
      setOffers((data || []) as Offer[]);
    }

    setChecking(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshOffers() {
    setRefreshing(true);
    await load();
  }

  async function copyCode(offer: Offer) {
    if (!offer.coupon_code) return;

    try {
      await navigator.clipboard.writeText(offer.coupon_code);
      setCopiedId(offer.id);
      setMessage(`Rabattcode für ${offer.partner_name} wurde kopiert.`);
      window.setTimeout(() => {
        setCopiedId((current) => (current === offer.id ? null : current));
        setMessage((current) =>
          current === `Rabattcode für ${offer.partner_name} wurde kopiert.` ? '' : current,
        );
      }, 1800);
    } catch {
      setMessage('Kopieren ist nicht möglich. Bitte markiere den Rabattcode und kopiere ihn manuell.');
    }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  if (checking) {
    return (
      <main className="container section offers-page">
        <div className="card offers-state">
          <Gift size={30} />
          <h1>Member Benefits</h1>
          <p className="muted">Mitgliedszugang wird geprüft …</p>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="container section offers-page">
        <div className="card offers-state">
          <ShieldCheck size={32} />
          <h1>Member Benefits</h1>
          <p role="status">{message || 'Bitte melde dich mit einem freigeschalteten Mitgliedskonto an.'}</p>
          <Link className="btn primary" href="/login">Zum Mitglieder-Login</Link>
          <Link className="offers-back-link" href="/">Zur Startseite</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container section offers-page">
      <nav className="nav offers-nav" aria-label="Hauptnavigation">
        <Link className="brand" href="/">
          <img src="/padelclubbing-logo.jpg" alt="PADELCLUBBING Logo" />
          <span>PADELCLUBBING</span>
        </Link>
        <div className="navlinks">
          <Link href="/">Startseite</Link>
          {isAdmin && <Link href="/admin/angebote">Angebote verwalten</Link>}
          <button className="btn" type="button" onClick={logout}>
            <LogOut size={15} /> Abmelden
          </button>
        </div>
      </nav>

      <section className="offers-hero">
        <div className="offers-hero-icon"><Gift size={23} /></div>
        <p className="eyebrow">EXKLUSIV FÜR MITGLIEDER</p>
        <h1>Member <span className="gradient">Benefits.</span></h1>
        <p className="lead">
          Deine Mitgliedschaft zahlt sich aus. Entdecke exklusive Rabatte und Vorteile unserer Sponsoren und Partner.
        </p>
        <div className="offers-trust"><ShieldCheck size={15} /> Exklusive Vorteile für freigeschaltete Mitglieder</div>
      </section>

      <section className="offers-content">
        <div className="sectionhead offers-sectionhead">
          <div>
            <p className="eyebrow">UNSERE PARTNER</p>
            <h2>Exklusive Angebote</h2>
            <p className="muted">Finde deinen Vorteil und kopiere den Rabattcode direkt.</p>
          </div>
          <button className="btn offers-refresh" type="button" onClick={() => void refreshOffers()} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'offers-spinning' : ''} />
            {refreshing ? 'Aktualisiere …' : 'Aktualisieren'}
          </button>
        </div>

        {message && <p role="status" className="offers-message">{message}</p>}

        {offers.length ? (
          <div className="grid offers-grid">
            {offers.map((offer) => (
              <article className="card offer-card" key={offer.id}>
                <div className="offer-image-wrap">
                  {offer.image_url ? (
                    <img className="offer-image" src={offer.image_url} alt={offer.partner_name} loading="lazy" />
                  ) : (
                    <div className="offer-image-placeholder"><Gift size={36} /></div>
                  )}
                  {offer.discount_label && (
                    <span className="offer-discount"><Tag size={13} /> {offer.discount_label}</span>
                  )}
                </div>

                <div className="offer-card-body">
                  <p className="eyebrow offer-partner">{offer.partner_name}</p>
                  <h3>{offer.title}</h3>
                  {offer.description && <p className="muted offer-description">{offer.description}</p>}

                  {offer.valid_until && (
                    <p className="offer-validity">
                      <CalendarDays size={14} />
                      Gültig bis {new Date(`${offer.valid_until.slice(0, 10)}T12:00:00`).toLocaleDateString('de-AT')}
                    </p>
                  )}

                  {offer.coupon_code && (
                    <div className="offer-code-area">
                      <div className="offer-code-label">DEIN RABATTCODE</div>
                      <div className="offer-code-row">
                        <code className="offer-code">{offer.coupon_code}</code>
                        <button
                          className="btn primary offer-copy"
                          type="button"
                          onClick={() => void copyCode(offer)}
                          aria-label={`Rabattcode ${offer.coupon_code} kopieren`}
                        >
                          <Copy size={16} />
                          {copiedId === offer.id ? 'Kopiert!' : 'Kopieren'}
                        </button>
                      </div>
                    </div>
                  )}

                  {offer.website_url && (
                    <a className="btn offer-partner-link" href={offer.website_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} /> Zum Partner
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty offers-empty">
            <Gift size={30} />
            <strong>Neue Partnerangebote folgen bald.</strong>
            <p>Sobald exklusive Rabatte verfügbar sind, findest du sie hier.</p>
          </div>
        )}
      </section>

      <p className="small offers-footnote">
        Bitte prüfe die jeweiligen Angebotsbedingungen und das angegebene Ablaufdatum. Rabatte können nur gemäß den Bedingungen des jeweiligen Partners genutzt werden.
      </p>

      <style jsx>{`
        .offers-page {
          padding-top: max(20px, env(safe-area-inset-top));
          padding-bottom: max(32px, env(safe-area-inset-bottom));
          overflow-wrap: anywhere;
        }

        .offers-nav {
          gap: 18px;
          align-items: center;
        }

        .offers-hero {
          position: relative;
          overflow: hidden;
          margin: 28px 0 34px;
          padding: clamp(24px, 5vw, 48px);
          border: 1px solid var(--border, #302238);
          border-radius: 24px;
          background:
            radial-gradient(ellipse at 10% 0%, rgba(34, 211, 238, .13), transparent 44%),
            radial-gradient(ellipse at 95% 20%, rgba(236, 72, 153, .16), transparent 40%),
            rgba(255, 255, 255, .015);
        }

        .offers-hero-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin-bottom: 18px;
          border-radius: 15px;
          color: var(--cyan, #22d3ee);
          background: rgba(34, 211, 238, .1);
          border: 1px solid rgba(34, 211, 238, .24);
        }

        .offers-hero h1 {
          margin: 8px 0 12px;
          font-size: clamp(38px, 7vw, 64px);
          line-height: 1.03;
          letter-spacing: -.045em;
        }

        .offers-hero .lead {
          max-width: 680px;
          margin-bottom: 18px;
        }

        .offers-trust {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted, #aaa);
          font-size: 13px;
        }

        .offers-content {
          min-width: 0;
        }

        .offers-sectionhead {
          align-items: end;
          gap: 16px;
          margin-bottom: 20px;
        }

        .offers-sectionhead h2 {
          margin: 4px 0 8px;
        }

        .offers-refresh {
          flex-shrink: 0;
        }

        .offers-grid {
          align-items: stretch;
        }

        .offer-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
          padding: 0;
        }

        .offer-image-wrap {
          position: relative;
          min-height: 120px;
          background: rgba(127, 127, 127, .1);
        }

        .offer-image {
          display: block;
          width: 100%;
          height: 210px;
          object-fit: cover;
        }

        .offer-image-placeholder {
          display: grid;
          place-items: center;
          min-height: 150px;
          color: var(--cyan, #22d3ee);
          background:
            radial-gradient(circle at 25% 15%, rgba(34, 211, 238, .12), transparent 55%),
            radial-gradient(circle at 85% 80%, rgba(236, 72, 153, .15), transparent 55%);
        }

        .offer-discount {
          position: absolute;
          left: 12px;
          bottom: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: calc(100% - 24px);
          padding: 8px 11px;
          border: 1px solid rgba(255, 255, 255, .18);
          border-radius: 999px;
          color: #fff;
          background: rgba(10, 8, 16, .86);
          font-size: 13px;
          font-weight: 700;
          backdrop-filter: blur(10px);
        }

        .offer-card-body {
          display: flex;
          flex: 1;
          flex-direction: column;
          align-items: flex-start;
          padding: 18px;
          min-width: 0;
        }

        .offer-partner {
          margin: 0 0 8px;
          color: var(--cyan, #22d3ee);
          font-size: 11px;
          letter-spacing: .12em;
        }

        .offer-card h3 {
          margin: 0 0 10px;
          overflow-wrap: anywhere;
        }

        .offer-description {
          white-space: pre-line;
          overflow-wrap: anywhere;
        }

        .offer-validity {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 4px 0 14px;
          font-size: 13px;
          color: var(--muted, #aaa);
        }

        .offer-code-area {
          width: 100%;
          margin-top: auto;
          padding: 14px;
          border: 1px solid rgba(34, 211, 238, .22);
          border-radius: 14px;
          background: rgba(34, 211, 238, .045);
          box-sizing: border-box;
        }

        .offer-code-label {
          margin-bottom: 8px;
          color: var(--muted, #aaa);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
        }

        .offer-code-row {
          display: flex;
          align-items: stretch;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }

        .offer-code {
          display: flex;
          align-items: center;
          flex: 1 1 110px;
          min-width: 0;
          max-width: 100%;
          padding: 11px 12px;
          border: 1px dashed rgba(34, 211, 238, .6);
          border-radius: 10px;
          color: inherit;
          background: rgba(0, 0, 0, .18);
          font-size: 15px;
          font-weight: 800;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .offer-copy {
          flex: 1 1 auto;
          min-height: 44px;
          justify-content: center;
          white-space: nowrap;
        }

        .offer-partner-link {
          justify-content: center;
          width: 100%;
          margin-top: 12px;
          box-sizing: border-box;
        }

        .offers-message {
          margin: 0 0 18px;
          padding: 12px 14px;
          border: 1px solid var(--border, #333);
          border-radius: 12px;
          background: rgba(127, 127, 127, .08);
          overflow-wrap: anywhere;
        }

        .offers-empty,
        .offers-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        .offers-state {
          max-width: 520px;
          margin: 20px auto;
          padding: 28px;
        }

        .offers-back-link {
          color: var(--muted, #aaa);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .offers-footnote {
          max-width: 850px;
          margin: 28px auto 0;
          line-height: 1.6;
        }

        .offers-spinning {
          animation: offers-spin 1s linear infinite;
        }

        @keyframes offers-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .offers-page {
            padding-left: max(16px, env(safe-area-inset-left));
            padding-right: max(16px, env(safe-area-inset-right));
          }

          .offers-nav {
            align-items: flex-start;
          }

          .offers-nav .brand {
            min-width: 0;
          }

          .offers-nav .brand span {
            font-size: 14px;
          }

          .offers-nav .navlinks {
            gap: 8px;
          }

          .offers-nav .navlinks > a {
            display: none;
          }

          .offers-nav .navlinks .btn {
            min-height: 42px;
            padding: 10px 12px;
            white-space: nowrap;
          }

          .offers-hero {
            margin-top: 20px;
            margin-bottom: 28px;
            padding: 24px 20px;
            border-radius: 20px;
          }

          .offers-hero h1 {
            font-size: clamp(36px, 10vw, 48px);
            line-height: 1.05;
          }

          .offers-hero .lead {
            font-size: 15px;
            line-height: 1.6;
          }

          .offers-sectionhead {
            align-items: stretch;
            flex-direction: column;
          }

          .offers-refresh {
            width: 100%;
            min-height: 44px;
            justify-content: center;
          }

          .offer-image {
            height: 185px;
          }

          .offer-card-body {
            padding: 16px;
          }

          .offer-code-area {
            padding: 12px;
          }

          .offer-code-row {
            flex-direction: column;
          }

          .offer-code {
            flex: 1 1 auto;
            width: 100%;
            box-sizing: border-box;
            min-height: 44px;
          }

          .offer-copy {
            width: 100%;
            min-height: 46px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .offers-spinning {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
