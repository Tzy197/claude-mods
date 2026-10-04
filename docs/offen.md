# Offen: Entscheidungen, Fahrplan, Tests, Grilling

Stand: 2026-10-04. Gilt für alle Mods in diesem Repo. Das Pfad-Board geht im Ziel-Graph auf.

## Entschieden am 2026-10-04

- **Der Graph braucht keine Tickets.** Er nimmt, was ein Repo hat. Ein Ticket-System bleibt die Empfehlung, weil der Stand dann genauer ist.
- **Jedes Ticket-System zählt:** GitLab, GitHub oder Tickets als Markdown-Dateien, so wie die mattpocock-Skills es halten.
- **Ohne Plan** zeigt der Graph nur die laufenden Chats.
- **Karten kommen immer, wenn eine Entscheidung ansteht, die etwas verändert,** nicht nur im Grilling. Sie zeigen konkret und ohne Technik, was sich wirklich ändert: vorher, nachher, Empfehlung.
- **Jeder Modell-Aufruf läuft mit Sonnet 5.5.**
- **Lizenz: MIT.** Der Text steht in `LICENSE`.
- **Commits tragen die GitHub-Adresse ohne Postfach,** nicht die private Adresse. Das ist je Rechner im Repo einzustellen (`git config user.email`), bevor dort committet wird.

## Woher der Graph seine Schritte nimmt

| Das Repo hat | Der Graph liest | Wie genau ist der Stand |
| --- | --- | --- |
| GitLab | Tickets, Labels, Verknüpfungen über `glab` | genau: bereit, blockiert und erledigt kommen live |
| GitHub | Tickets und Labels über `gh` | genau; was GitHub für „wartet auf“ bietet, ist nachzulesen |
| Tickets als Markdown | Dateien unter `.scratch/<vorhaben>/issues/`, Karte in `.scratch/<vorhaben>/map.md` | genau, soweit die Dateien gepflegt sind |
| keine Tickets | die laufenden Chats und die Doku im Repo | grob: das Modell leitet die Schritte ab und markiert sie als vermutet |

Welches System ein Repo nutzt, steht bei den mattpocock-Skills in `docs/agents/issue-tracker.md` (erste Zeile: `# Issue tracker: GitLab`, `GitHub` oder `Local Markdown`). Der Mod liest diese Datei. Fehlt sie, schaut er auf den Git-Remote; passt nichts, gilt „keine Tickets“.

Dazu je Repo eine kleine Einstellung mit Vorgabe: Welches Label heißt bereit, blockiert, wartet auf Auskunft, Ziel-Karte? Die Daten eines Repos brauchen einen eindeutigen Schlüssel, nicht nur den Ordnernamen.

## Fahrplan

| Schritt | Wer, wo | Was wir danach wissen |
| --- | --- | --- |
| 1 · Repo auf GitHub | Nutzer, privater Rechner | ZIP entpacken, Repo anlegen, hochladen. |
| 2 · Am privaten Rechner installieren | Nutzer | Lädt ein Mod aus dem Marketplace? Erscheint nach `/graph` die Leiste bei einer Session auf diesem Rechner? |
| 3 · Am zweiten Rechner installieren | Nutzer | Dasselbe dort: Breite, Scrollen, Knöpfe, Farben. |
| 4 · Über Kreuz schauen | Nutzer, beide | Zeichnet ein Rechner die Leiste einer Session, die auf dem anderen läuft? |
| 5 · Rest grillen | gemeinsam | Zwei Rechner und die Daten; bei den Karten: feste Formen, Antworten per Knopf, Verhältnis zur eingebauten Rückfrage. |
| 6 · Chats in den Graphen | bauen, dann testen | Der Graph zeigt echte Chats. Test in einem Repo mit Tracker und in einem ohne Tickets. |
| 7 · Drei Versuche | Wegwerf-Mods | Karte mitten im Chat; Werkzeug durchsetzen; Ableiten mit dem Modell. |
| 8 · Fertig bauen | bauen, dann testen | Graph mit Zielliste, Festlegungen, Ableiten und allen vier Quellen; die Karten; danach wird `plugins/pfad-board` entfernt. |

Gebaut wird in einer Session auf dem privaten Rechner, direkt in diesem Repo. Ein zweiter Rechner holt nur ab und testet.

## Noch zu testen

1. **Graph in der echten Leiste.** Erscheint er nach `/graph`, passt die Breite, scrollt er, gehen Knöpfe und Farbwahl?
2. **Sonnet 5.5 für den Chat-Stand.** Wird die Modell-Kennung `claude-sonnet-5-5` angenommen?
3. **Installation aus dem Repo.** Laden Mods mit Function Hooks über den Marketplace genauso wie aus einem lokalen Ordner?
4. **Zugeschaltetes Gerät.** Beobachtet: Slash-Befehle laufen, die Leiste erscheint nicht. Ursache ungeklärt.
5. **Repo ohne GitLab.** Läuft der Graph dort, ohne zu stören?
6. **Karte mitten im Chat.** Erscheint eine gezeichnete Karte im Verlauf, und schickt ein Knopf die Antwort ab?
7. **Werkzeug durchsetzen.** Benutzt ein Chat das Werkzeug „Entscheidung zeigen“ verlässlich, wenn der Mod es vorgibt?
8. **Ableiten.** Wie gut trifft das Modell Bündel und Bahnen in einem echten Repo, und wie lange dauert ein Lauf?

## Noch zu grillen

- **B · Zwei Rechner.** Wo liegen Chat-Stände und Plan, damit beide Rechner dasselbe sehen?
- **C · Zugeschaltetes Gerät bei Karten.** Zurückgestellt; beantwortet sich nach Fahrplan-Schritt 4 und Test 6 weitgehend.
- **D · Feste Formen der Karte.** Reicht Vorher/Nachher, oder braucht es auch Ablauf und Tabelle? Wohin mit markierten Bildausschnitten?
- **E · Antworten per Knopf.** Was schickt der Knopf, gibt es eine freie Antwort, eine Frage auf einmal oder mehrere?
- **F · Karte und eingebaute Rückfrage.** Ersetzt die Karte die Rückfrage der App, oder zeichnet der Mod sie nur reicher?
