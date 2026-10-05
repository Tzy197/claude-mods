import { expect, test } from 'claude-code/testing'

import { GOAL_FORMAT, istLeer, istOffen, leseGoal, promptEndziel, promptGoalAnlegen, promptStrangZiel } from '../hooks/plan/goal'
import { endzielAuftrag, goalAuftrag, ohneZiel, strangAuftrag, strangFrage } from '../hooks/plan/lesen'

import { GOAL, antwort, gelungen, umfeld } from './shop'

// GOAL.md: der Anker des Plans. Wie der Mod sie liest und welche Aufträge er dazu ins
// Eingabefeld legt. Alle Testdaten sind erfunden.

test('GOAL.md, vollständig: Endziel, Zwischenziele und Stränge stehen wörtlich da', () => {
  const goal = leseGoal(GOAL)

  expect(goal).toEqual({
    vorhanden: true,
    endziel: 'Der Shop ist im Betrieb und nimmt Bestellungen an.',
    zwischenziele: [
      { id: 'grundstock-steht', titel: 'Grundstock steht', erreicht: true },
      { id: 'grosser-umbau', titel: 'Großer Umbau', erreicht: false },
      { id: 'lasttest-bestanden', titel: 'Lasttest bestanden', erreicht: false },
    ],
    straenge: [
      { id: 'katalog', name: 'Katalog', ziel: 'Alle Produkte mit Text und Bild im Shop', gehoertZu: 'grosser-umbau', gehoertZuText: 'Großer Umbau' },
      { id: 'kasse', name: 'Kasse', ziel: '', gehoertZu: 'grosser-umbau', gehoertZuText: 'Großer Umbau' },
      { id: 'suche', name: 'Suche', ziel: 'Jedes Produkt in zwei Klicks finden', gehoertZu: '', gehoertZuText: '' },
      { id: 'betrieb', name: 'Betrieb', ziel: '', gehoertZu: '', gehoertZuText: '' },
    ],
    hinweise: [],
  })
  expect(istLeer(goal)).toBe(false)
  // Zeilenenden von Windows und ein BOM ändern nichts.
  expect(leseGoal(`\ufeff${GOAL.replace(/\n/g, '\r\n')}`)).toEqual(goal)
  // Das Format, das der Chat beim Anlegen bekommt, liest der Mod selbst ohne Hinweis.
  // Das Format selbst, mit seinen Platzhaltern, legt nichts fest: Es liest sich wie eine leere Datei.
  expect(leseGoal(GOAL_FORMAT)).toEqual({ vorhanden: true, endziel: '', zwischenziele: [], straenge: [], hinweise: [] })
})

test('GOAL.md, nur zum Teil: Was fehlt oder „noch offen“ ist, bleibt leer', () => {
  const nurStraenge = leseGoal('## Stränge\n### Katalog\n### Kasse\nZiel: noch offen\n')

  expect(nurStraenge).toMatchObject({ vorhanden: true, endziel: '', zwischenziele: [] })
  expect(nurStraenge.straenge.map(one => `${one.id}:${one.ziel}`)).toEqual(['katalog:', 'kasse:'])
  expect(istLeer(nurStraenge)).toBe(false)

  const nurEndziel = leseGoal('# Ziel\n\n## Endziel\n\nDer Shop im Betrieb.\n\nMehr dazu später.\n')

  expect(nurEndziel).toMatchObject({ endziel: 'Der Shop im Betrieb.', zwischenziele: [], straenge: [] })

  const offen = leseGoal('## Endziel\nnoch offen\n\n## Zwischenziele\n- noch offen\n\n## Stränge\n### Katalog\nZiel: ?\n')

  expect(offen).toMatchObject({ endziel: '', zwischenziele: [] })
  expect(offen.straenge).toEqual([{ id: 'katalog', name: 'Katalog', ziel: '', gehoertZu: '', gehoertZuText: '' }])

  for (const wert of ['', ' ', 'noch offen', 'Noch offen.', 'offen', 'unklar', '?', '-', '–', '…', 'tbd', '(noch unklar, klären wir im Herbst)']) {
    expect(istOffen(wert)).toBe(true)
  }

  for (const wert of ['Der Shop im Betrieb', 'Offene Bestellungen sehen', 'Kasse ohne Umweg']) {
    expect(istOffen(wert)).toBe(false)
  }
})

test('GOAL.md, leer oder fehlend: Die leere Datei ist da, legt aber nichts fest', () => {
  for (const leer of ['', '  \n\n', '# Ziel\n', '# Ziel\n\n## Endziel\n\n## Zwischenziele\n\n## Stränge\n', '<!-- kommt noch -->']) {
    const goal = leseGoal(leer)

    expect(goal).toEqual({ vorhanden: true, endziel: '', zwischenziele: [], straenge: [], hinweise: [] })
    expect(istLeer(goal)).toBe(true)
  }

  const fehlt = leseGoal(null)

  expect(fehlt).toEqual({ vorhanden: false, endziel: '', zwischenziele: [], straenge: [], hinweise: [] })
  expect(istLeer(fehlt)).toBe(false)
})

test('GOAL.md, eigenwillig geschrieben: andere Überschriften, Listen, Fettdruck, Kommentare', () => {
  const goal = leseGoal(`Ziel des Projekts
=================

## ENDZIEL:  **Der Shop läuft**

Dieser Absatz zählt nicht mehr.

### Meilensteine
1. Grundstock steht
   - eingerückt: nur eine Erläuterung
2) [X] Katalog abgenommen
* noch offen

\`\`\`
## Stränge
### Im Zaun steht kein Strang
\`\`\`

## Straenge:
- **Katalog** — alle Produkte mit Bild
  - Gehört zu: grundstock
- Kasse:
- Suche
  Ziel: schnell finden,
  auch mit Tippfehlern
- Katalog: doppelt

## Notizen
### Kein Strang
- Auch keiner
`)

  expect(goal.endziel).toBe('Der Shop läuft')
  expect(goal.zwischenziele).toEqual([
    { id: 'grundstock-steht', titel: 'Grundstock steht', erreicht: false },
    { id: 'katalog-abgenommen', titel: 'Katalog abgenommen', erreicht: true },
  ])
  expect(goal.straenge).toEqual([
    { id: 'katalog', name: 'Katalog', ziel: 'alle Produkte mit Bild', gehoertZu: 'grundstock-steht', gehoertZuText: 'grundstock' },
    { id: 'kasse', name: 'Kasse', ziel: '', gehoertZu: '', gehoertZuText: '' },
    { id: 'suche', name: 'Suche', ziel: 'schnell finden, auch mit Tippfehlern', gehoertZu: '', gehoertZuText: '' },
  ])
  expect(goal.hinweise).toEqual(['GOAL.md nennt den Strang „Katalog“ zweimal: Der zweite fällt weg.'])

  // Felder als Listenpunkte unter einer Überschrift, das Ziel erst in der nächsten Zeile,
  // ein „Gehört zu“, das auf nichts zeigt, und Namen, die im Plan schon etwas bedeuten.
  const zweite = leseGoal(`## Endziel
- Der Shop im Betrieb
- und noch viel mehr

## Zwischenziele
Großer Umbau
Lasttest

## Bahnen
#### Kasse
- **Ziel:** Bestellen ohne Umweg
- Gehoert zu: Mondlandung
#### Suche
Ziel:
Jedes Produkt finden
#### Endziel
#### Stamm
`)

  expect(zweite.endziel).toBe('Der Shop im Betrieb')
  expect(zweite.zwischenziele.map(one => one.id)).toEqual(['grosser-umbau', 'lasttest'])
  expect(zweite.straenge).toEqual([
    { id: 'kasse', name: 'Kasse', ziel: 'Bestellen ohne Umweg', gehoertZu: '', gehoertZuText: 'Mondlandung' },
    { id: 'suche', name: 'Suche', ziel: 'Jedes Produkt finden', gehoertZu: '', gehoertZuText: '' },
    { id: 'endziel-2', name: 'Endziel', ziel: '', gehoertZu: '', gehoertZuText: '' },
    { id: 'stamm-2', name: 'Stamm', ziel: '', gehoertZu: '', gehoertZuText: '' },
  ])
  expect(zweite.hinweise).toEqual([
    'GOAL.md, Strang „Kasse“: „Gehört zu: Mondlandung“ nennt kein Zwischenziel aus der Liste.',
  ])
})

test('die Aufträge zu GOAL.md: anlegen, das Ziel eines Strangs und das Endziel festlegen', () => {
  const { plan } = gelungen(antwort())

  expect(promptGoalAnlegen()).toContain('Lass uns für dieses Repo die Datei GOAL.md in der Wurzel anlegen.')
  expect(promptGoalAnlegen()).toContain(GOAL_FORMAT)
  expect(promptGoalAnlegen()).toContain('Schreib die Datei erst, wenn ich zugestimmt habe.')
  expect(strangFrage(plan, 'kasse')).toEqual({
    name: 'Kasse',
    inGoal: true,
    mitGoal: true,
    vermutung: 'Bestellen ohne Umweg',
    buendel: ['Zahlarten geklärt und 5 Entwürfe', 'Entwurf Warenkorb-Regeln', 'Entwurf Gutschein-Einlösung', 'Block Rechnungen'],
  })
  expect(strangFrage(plan, 'gibt-es-nicht')).toBe(null)
  expect(promptStrangZiel({ name: 'Lager', inGoal: false, mitGoal: true, vermutung: '', buendel: [] })).toContain(
    'Der Strang steht noch nicht in GOAL.md',
  )
  expect(promptStrangZiel({ name: 'Lager', inGoal: false, mitGoal: false, vermutung: '', buendel: [] })).toContain(GOAL_FORMAT)
  expect(promptEndziel(true, 'der Shop im Betrieb')).toBe(
    [
      'In GOAL.md ist noch kein Endziel festgelegt. Klär mit mir, was am Ende erreicht sein soll, und trag es dann als einen Satz unter „## Endziel“ ein.',
      'Der Plan vermutet als Endziel: der Shop im Betrieb',
      'Frag mich, wo etwas unklar ist, eine Frage auf einmal und mit einer Empfehlung. Was noch nicht klar ist, bleibt offen. Schreib die Datei erst, wenn ich zugestimmt habe.',
    ].join('\n\n'),
  )
  expect(promptEndziel(false, '')).toContain(GOAL_FORMAT)

  // Beide Ansichten legen dieselben Aufträge ins Eingabefeld: Text und wie der Hinweis ihn nennt.
  expect(goalAuftrag()).toEqual({ text: promptGoalAnlegen(), was: 'Der Auftrag für GOAL.md' })
  expect(endzielAuftrag(plan)).toEqual({ text: promptEndziel(true, ''), was: 'Der Auftrag „Endziel festlegen“' })
  expect(endzielAuftrag(gelungen(antwort(), umfeld(null)).plan)).toEqual({
    text: promptEndziel(false, 'der Shop im Betrieb'),
    was: 'Der Auftrag „Endziel festlegen“',
  })
  expect(strangAuftrag(plan, 'kasse').was).toBe('Der Auftrag „Ziel festlegen“')
  expect(strangAuftrag(plan, 'kasse').text).toContain('Es fehlt die Zeile „Ziel: …“ unter „### Kasse“.')
  expect(strangAuftrag(plan, 'gibt-es-nicht').text).toBe(null)
  expect(ohneZiel(plan).map(one => one.id)).toEqual(['kasse', 'betrieb'])
})
