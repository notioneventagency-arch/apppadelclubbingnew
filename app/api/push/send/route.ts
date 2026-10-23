
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
  } catch {
    return NextResponse.json(
      { error: 'Push-Versand fehlgeschlagen.' },
      { status: 500 }
    );
  }
}
