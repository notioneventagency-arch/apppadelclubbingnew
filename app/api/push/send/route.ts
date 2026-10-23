import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!url || !anonKey || !serviceKey || !publicKey || !privateKey || !subject) {
      return NextResponse.json(
        { error: 'Server-Konfiguration unvollständig.' },
        { status: 500 }
      );
    }

    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
    }

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userResult, error: userError } =
      await authClient.auth.getUser(authorization.slice(7));

    if (userError || !userResult.user) {
      return NextResponse.json({ error: 'Ungültige Anmeldung.' }, { status: 401 });
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role,status')
      .eq('id', userResult.user.id)
      .single();

    if (
      profileError ||
      profile?.role !== 'admin' ||
      profile?.status !== 'approved'
    ) {
      return NextResponse.json(
        { error: 'Nur freigegebene Admins dürfen Push-Nachrichten senden.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.slice(0, 100) : '';
    const message = typeof body.body === 'string' ? body.body.slice(0, 240) : '';
    const targetUrl =
      typeof body.url === 'string' && body.url.startsWith('/') ? body.url : '/';

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Titel und Nachricht sind erforderlich.' },
        { status: 400 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { data: subscriptions, error: subscriptionsError } =
      await adminClient.from('push_subscriptions').select('id,subscription');

    if (subscriptionsError) {
      return NextResponse.json(
        { error: 'Push-Abos konnten nicht geladen werden.' },
        { status: 500 }
      );
    }

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    for (const item of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          item.subscription,
          JSON.stringify({ title, body: message, url: targetUrl })
        );
        sent++;
      } catch (error: unknown) {
        failed++;

        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(item.id);
        }
      }
    }

    if (expiredIds.length > 0) {
      await adminClient
        .from('push_subscriptions')
        .delete()
        .in('id', expiredIds);
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      removedExpired: expiredIds.length,
    });
  } catch (error) {
    console.error('Push-Versand fehlgeschlagen:', error);

    return NextResponse.json(
      { error: 'Push-Versand fehlgeschlagen.' },
      { status: 500 }
    );
  }
}
