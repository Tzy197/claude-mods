# Entscheidungskarten: Stand des Grillings

Stand: 2026-10-04. Das Grilling ist nicht fertig, gebaut ist nichts.
Diese Datei hält fest, was entschieden ist und was noch gefragt werden muss.

## Zweck

Ein Chat soll zu jeder echten Entscheidung von selbst ein Bild liefern, das immer gleich aufgebaut ist: Frage, echtes Beispiel, Vorher, Nachher, Möglichkeiten, Empfehlung. Der Nutzer soll schneller entscheiden können, ohne jedes Mal um eine Visualisierung zu bitten.

Das ist ein eigener Mod, getrennt vom Ziel-Graphen. Der Graph zeigt, wo das Projekt steht. Die Karte hilft bei einer einzelnen Entscheidung. Berührungspunkt: Eine offene Karte erscheint im Ziel-Graphen beim Chat als „wartet auf dich“.

## Entschieden

1. **Wer baut das Bild.** Der Chat selbst, über ein festes Werkzeug „Entscheidung zeigen“. Er füllt immer dieselben Felder: Frage, echtes Beispiel, Vorher, Nachher, Möglichkeiten, Empfehlung. Der Mod zeichnet daraus die Karte. Grund: Der Chat kennt das echte Beispiel, weil er die Daten gerade angesehen hat. Ein zweiter Agent danach sähe nur den Antworttext.
2. **Wo sie erscheint.** Mitten im Chat, an der Stelle der Frage. Der Nutzer antwortet per Knopf, die Karte bleibt im Verlauf stehen.
3. **Wann sie kommt.** Bei Entscheidungen mit Möglichkeiten und bei Freigaben, die etwas ändern. Einfache Rückfragen („Soll ich das Ticket anlegen?“) bleiben Text. Das gilt in jedem Chat, nicht nur im Grilling.
4. **Was sie zeigt.** Konkret und ohne Technik, was sich wirklich ändert: vorher, nachher, die Möglichkeiten und die Empfehlung.

## Zurückgestellt

5. **Zugeschaltetes Gerät.** Erscheint die Karte auch auf einem Gerät, das der Session nur zugeschaltet ist? Zur Wahl standen: nur die Karte im Chat; Karte im Chat und zusätzlich eine Seite mit festem Link je Chat; nur die Seite. Zurückgestellt, bis der Mod auf beiden Rechnern installiert ist und sich zeigt, was dort gezeichnet wird.

## Noch zu fragen

- **Feste Formen.** Reicht eine Form (Vorher/Nachher mit Möglichkeiten), oder braucht es mehrere, zum Beispiel einen Ablauf in Schritten oder eine Gegenüberstellung in einer Tabelle?
- **Reichere Bilder.** Markierte Bildausschnitte passen nicht in eine feste Karte. Verlinkt die Karte dafür auf eine eigene Seite?
- **Antwort per Knopf.** Was schickt ein Knopf in den Chat: nur den Buchstaben, oder den Buchstaben mit dem Text der Möglichkeit? Gibt es ein Feld für eine freie Antwort?
- **Verhältnis zur eingebauten Rückfrage.** Die App hat ein eigenes Frage-Werkzeug mit Möglichkeiten. Ersetzt die Karte es, oder zeichnet der Mod dessen Dialog nur reicher?
- **Durchsetzen.** Wie bringt der Mod jeden Chat verlässlich dazu, das Werkzeug zu benutzen: nur über die Werkzeug-Beschreibung, über einen Abschnitt im System-Prompt, oder zusätzlich mit einer Prüfung am Ende der Antwort?
- **Mehrere Fragen.** Eine Karte je Frage und eine Frage nach der anderen, oder mehrere Karten auf einmal?

## Technische Anhaltspunkte

- Ein Mod kann ein Werkzeug anmelden (`$.tool.register`) und seine Zeile im Chat selbst zeichnen (`ui.render` auf `ToolUse` oder `ToolResult`).
- Knöpfe in einem gezeichneten Baum lösen `ui.press` aus; `$.prompt.submit` schickt eine Antwort als Prompt in den Chat.
- Ob das auf einem zugeschalteten Gerät gezeichnet wird, ist ungeprüft.
