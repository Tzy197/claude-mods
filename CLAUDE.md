# claude-mods

Eigene Mods für Claude Code (Plugins aus Function Hooks). Das Repo ist öffentlich und zugleich ein Marketplace: `.claude-plugin/marketplace.json` listet die Mods unter `plugins/`.

## Befehle

```bash
claude plugin validate .                    # Marketplace-Manifest
claude plugin validate plugins/<mod>        # ein Mod, so wie die Engine ihn liest
claude plugin test plugins/<mod>            # die Tests eines Mods
```

## Wo was steht

- `docs/ziel-graph-spec.md`: Entscheidungen, Begriffe, Bauschritte und Lehren zum Ziel-Graphen.
- `docs/entscheidungskarten-stand.md`: Stand des Grillings zu den Entscheidungskarten.
- `docs/offen.md`: Fahrplan, offene Tests, offene Grilling-Themen.

Eine Entscheidung gilt erst, wenn sie in einer dieser Dateien steht. Trag neue Entscheidungen und Testergebnisse dort ein, nicht nur in den Chat.

## Regeln für dieses Repo

- **Keine Inhalte aus Arbeitsprojekten.** Keine echten Ticketnummern oder Ticket-Titel, keine Personen- oder Firmennamen, keine Fachbegriffe eines bestimmten Projekts. Beispieldaten sind erfunden.
- **System- und repo-übergreifend.** Ein Mod darf kein bestimmtes Repo und kein bestimmtes Ticket-System voraussetzen. Er muss mit GitLab, mit GitHub, mit Tickets als Markdown-Dateien und ganz ohne Tickets laufen.
- **Jeder Modell-Aufruf läuft mit Sonnet 5.5** (`claude-sonnet-5-5`).
- **Sichtbare Texte auf Deutsch** mit echten Umlauten.
- **`$` nur an Funktionen auf Dateiebene reichen,** sonst lehnt `validate` das Modul ab.
- **Hochladen und Zusammenführen nur auf Zuruf des Nutzers.**

## So arbeitet der Nutzer

- Antworten kurz und in einfachen Worten. Eine Frage auf einmal, mit Empfehlung.
- Bei jeder Entscheidung, die etwas verändert, ein kleines Bild als Artefakt-Seite: ein echtes Beispiel, vorher und nachher, die Möglichkeiten nebeneinander, die Empfehlung hervorgehoben. Konkret statt technisch.
- Größere Bauarbeiten über Subagenten, der Haupt-Chat steuert und prüft das Ergebnis selbst nach.
- Er arbeitet an zwei Rechnern. Eine lokale Datei erreicht ihn nicht immer; eine veröffentlichte Seite mit Link schon.
