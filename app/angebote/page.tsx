'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, Gift, LogOut, RefreshCw, Tag } from 'lucide-react';
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
  const [allowed, setAllowed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setMessage('Supabase ist nicht verbunden.'); setChecking(false); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace('/login'); return; }
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('role,status').eq('id', auth.user.id).maybeSingle();
    if (profileError || !profile || profile.status !== 'approved' || !['member', 'admin'].includes(profile.role)) {
      setMessage('Diese Seite ist nur für freigeschaltete Mitglieder zugänglich.');
      setChecking(false); return;
    }
    setAllowed(true);
    setIsAdmin(profile.role === 'admin');
    const { data, error } = await supabase.from('member_offers').select('*').eq('published', true).order('created_at', { ascending: false });
    if (error) setMessage('Angebote konnten nicht geladen werden: ' + error.message);
    else setOffers((data || []) as Offer[]);
    setChecking(false);
  }, [router]);

  useEffect(() => { if (supabaseReady) void load(); else { setMessage('Supabase ist nicht verbunden.'); setChecking(false); } }, [load]);

  async function copyCode(offer: Offer) {
    if (!offer.coupon_code) return;
    try {
      await navigator.clipboard.writeText(offer.coupon_code);
      setCopiedId(offer.id);
      window.setTimeout(() => setCopiedId((current) => current === offer.id ? null : current), 1800);
    } catch {
      setMessage('Kopieren nicht möglich. Bitte den Rabattcode markieren und manuell kopieren.');
    }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  if (checking) return <main className="container section"><p>Mitgliedszugang wird geprüft …</p></main>;
  if (!allowed) return <main className="container section"><h1>Member Benefits</h1><p>{message}</p><Link className="btn primary" href="/login">Zum Mitglieder-Login</Link></main>;

  return (
    <main className="container section">
      <nav className="nav">
        <Link className="brand" href="/"><img src="/padelclubbing-logo.jpg" alt="Padelclubbing Logo" /><span>PADELCLUBBING</span></Link>
        <div className="navlinks"><Link href="/">Startseite</Link>{isAdmin && <Link href="/admin/angebote">Angebote verwalten</Link>}<button className="btn" onClick={logout}><LogOut size={15} /> Abmelden</button></div>
      </nav>

      <section className="hero" style={{ paddingTop: 28, paddingBottom: 28 }}>
        <p className="eyebrow"><Gift size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> EXKLUSIV FÜR MITGLIEDER</p>
        <h1>Member <span className="gradient">Benefits.</span></h1>
        <p className="lead">Deine Mitgliedschaft zahlt sich aus. Entdecke exklusive Rabatte und Vorteile unserer Sponsoren und Partner.</p>
      </section>

      {message && <p role="status" className="success">{message}</p>}
      <div className="sectionhead"><div><p className="eyebrow">Unsere Partner</p><h2>Exklusive Angebote</h2></div><button className="btn" onClick={() => void load()}><RefreshCw size={15} /> Aktualisieren</button></div>

      {offers.length ? <div className="grid">
        {offers.map((offer) => (
          <article className="card" key={offer.id}>
            {offer.image_url ? <img src={offer.image_url} alt={offer.partner_name} loading="lazy" style={{ width: '100%', height: 190, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} /> : <div style={{ height: 110, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'rgba(127,127,127,.12)', marginBottom: 14 }}><Gift size={36} /></div>}
            <p className="eyebrow">{offer.partner_name}</p>
            {offer.discount_label && <span className="tag"><Tag size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> {offer.discount_label}</span>}
            <h3>{offer.title}</h3>
            {offer.description && <p className="muted">{offer.description}</p>}
            {offer.valid_until && <p className="small">Gültig bis {new Date(offer.valid_until + 'T12:00:00').toLocaleDateString('de-AT')}</p>}
            {offer.coupon_code && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}><code style={{ padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--cyan)', fontSize: 16, fontWeight: 700 }}>{offer.coupon_code}</code><button className="btn primary" onClick={() => void copyCode(offer)}><Copy size={15} /> {copiedId === offer.id ? 'Kopiert!' : 'Code kopieren'}</button></div>}
            {offer.website_url && <a className="btn" href={offer.website_url} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}><ExternalLink size={15} /> Zum Partner</a>}
          </article>
        ))}
      </div> : <div className="empty"><strong>Neue Partnerangebote folgen bald.</strong><p>Sobald exklusive Rabatte verfügbar sind, findest du sie hier.</p></div>}
      <p className="small" style={{ marginTop: 28 }}>Bitte prüfe die jeweiligen Angebotsbedingungen und das angegebene Ablaufdatum. Rabatte können nur gemäß den Bedingungen des jeweiligen Partners genutzt werden.</p>
    </main>
  );
}

