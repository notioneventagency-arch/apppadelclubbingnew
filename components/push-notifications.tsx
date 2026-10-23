'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell } from 'lucide-react';

function base64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);

  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export default function PushNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function check() {
      if (!('serviceWorker' in navigator)) return;

      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();

      setEnabled(Boolean(subscription));
    }

    void check();
  }, []);

  async function toggle() {
    if (!supabase) return;

    setBusy(true);
    setMessage('');

    try {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setMessage('Bitte zuerst einloggen.');
        return;
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!key || !('serviceWorker' in navigator)) {
        setMessage('Push ist nicht verfügbar.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        await existing.unsubscribe();

        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', existing.endpoint);

        setEnabled(false);
        setMessage('Push deaktiviert.');
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setMessage('Bitte Benachrichtigungen erlauben.');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(key),
      });

      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: data.user.id,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
      }, { onConflict: 'endpoint' });

      if (error) {
        await subscription.unsubscribe();
        setMessage(error.message);
        return;
      }

      setEnabled(true);
      setMessage('Push aktiviert!');
    } catch {
      setMessage('Push konnte nicht aktiviert werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3><Bell size={18} /> Push-Benachrichtigungen</h3>
      <p className="muted">
        Neue Trainings und Events direkt am Gerät erhalten.
      </p>

      <button className="btn primary" disabled={busy} onClick={() => void toggle()}>
        {busy ? 'Bitte warten …' : enabled ? 'Push deaktivieren' : 'Push aktivieren'}
      </button>

      {message && <p className="small">{message}</p>}
    </section>
  );
}
