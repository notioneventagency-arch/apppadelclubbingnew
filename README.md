# Padelclubbing Vereins-App – Starterprojekt

Eine mobile-first Vereins-Web-App im Look eures hochgeladenen Padelclubbing-Logos (schwarz, Pink, Türkis und Violett). Sie kann als PWA weiterentwickelt und über einen Link auf iPhone/Android geöffnet werden.

## Was ist bereits vorbereitet?
- Öffentliche Startseite mit Logo, Verein, Training/Turnieren und News
- Admin-Login-Seite
- Admin-Dashboard zum Anlegen und Löschen von Terminen und News
- Supabase-Anbindung für dauerhaft gespeicherte Einträge
- SQL-Schema und Einrichtungshinweise

**Wichtig:** Das Projekt ist ein Startpaket, noch keine online veröffentlichte, fertig verbundene App. Für Login und Speicherung muss ein Supabase-Projekt verbunden werden. Foto-Upload, Mitgliederverwaltung, Anmeldung zu Trainings, DSGVO/Impressum und PWA-Installationsdetails sind weitere Umsetzungsschritte.

## 1. Was du benötigst
- GitHub-Konto
- Vercel-Konto zum Veröffentlichen
- Supabase-Konto für Datenbank und Login
- Node.js 20 oder neuer, falls du es lokal starten willst

## 2. Supabase einrichten
1. Neues Projekt auf https://supabase.com erstellen.
2. Im Projekt den Bereich **SQL Editor** öffnen.
3. Inhalt von `supabase-schema.sql` einfügen und ausführen.
4. Unter **Authentication → Users** einen Benutzer für den Admin anlegen.
5. Unter **Project Settings → API** die Project URL und den `anon`/publishable key kopieren.

### Admin-Rechte – Sicherheits-Hinweis
Das mitgelieferte Schema erlaubt aktuell allen authentifizierten Benutzern, Inhalte zu verwalten. Für einen echten Produktivbetrieb muss die Rechtevergabe auf explizit freigegebene Admins beschränkt werden, bevor Mitgliederkonten angelegt werden. Teile niemals den `service_role`-Schlüssel im Frontend.

## 3. Umgebungsvariablen
1. `.env.example` nach `.env.local` kopieren.
2. Eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/publishable key

## 4. Lokal starten
```bash
npm install
npm run dev
```
Dann http://localhost:3000 öffnen.

## 5. Online stellen
1. Projekt in ein neues GitHub-Repository hochladen.
2. Auf https://vercel.com ein neues Projekt importieren.
3. In Vercel unter **Settings → Environment Variables** dieselben zwei Variablen setzen.
4. Deploy starten.

## Nächste empfohlene Schritte
1. Admin-Rechte absichern (nur freigegebene Admins).
2. Direkten Foto-Upload mit Supabase Storage und passenden Zugriffsregeln ergänzen.
3. Trainings-Anmeldungen mit Teilnehmerlimit und Abmeldung ergänzen.
4. Mitgliederbereich und Dokumente ergänzen.
5. Impressum, Datenschutzerklärung, Bild-/Videoeinwilligung und Vereinsinhalte prüfen.
6. PWA-Manifest, App-Icons und Installation am Startbildschirm ergänzen.

## Branding
Logo-Datei: `public/padelclubbing-logo.jpg`. Farben und Gestaltung liegen in `app/globals.css` und können dort angepasst werden.
