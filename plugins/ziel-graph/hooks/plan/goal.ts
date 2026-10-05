import { eindeutig, kennung } from '../worte'

// GOAL.md: der Anker des Plans. Die Datei liegt in der Wurzel des Repos und nennt das
// Endziel, die Zwischenziele auf dem Weg, je Strang das größere Ziel und die Festlegungen
// des Nutzers. Hier wird sie nur gelesen: Schreiben tut sie der Chat, auf Zuruf des Nutzers.
// Kein `$`, kein Zustand.

export type GoalZwischenziel = {
  // die feste Kennung, unter der auch das Modell das Zwischenziel nennt
  id: string
  // der Wortlaut aus GOAL.md
  titel: string
  // true: in GOAL.md abgehakt („- [x] …“)
  erreicht: boolean
}

export type GoalStrang = {
  // die feste Kennung, unter der auch das Modell den Strang nennt
  id: string
  // der Name aus GOAL.md, wörtlich
  name: string
  // wohin der Strang führt; '' wenn das Ziel fehlt oder offen ist
  ziel: string
  // id des Zwischenziels, zu dem der Strang gehört; '' ohne oder wenn keines passt
  gehoertZu: string
  // was hinter „Gehört zu:“ steht, wörtlich
  gehoertZuText: string
}

export type Goal = {
  // false: Es gibt keine GOAL.md
  vorhanden: boolean
  // der eine Satz, wörtlich; '' wenn das Endziel fehlt oder offen ist
  endziel: string
  zwischenziele: GoalZwischenziel[]
  // in der Reihenfolge der Datei: Das ist die Reihenfolge der Spalten
  straenge: GoalStrang[]
  // die Sätze unter „Festlegungen“, wörtlich: Sie gewinnen bei jedem Ableiten
  festlegungen: string[]
  // was beim Lesen aufgefallen ist
  hinweise: string[]
}

// Das Format, so wie es der Chat beim Anlegen bekommt und docs/orchestrator.md es zeigt.
export const GOAL_FORMAT = `# Ziel

## Endziel
<ein Satz, oder „noch offen“>

## Zwischenziele
- <ein Zwischenziel auf dem Weg zum Endziel>
- [x] <ein Zwischenziel, das schon erreicht ist>

## Stränge
### <Name des Strangs>
Ziel: <wohin dieser Strang führt, oder leer>
Gehört zu: <eines der Zwischenziele, wenn es passt>

## Festlegungen
- <ein Satz, der bei jedem Ableiten des Plans gewinnt>`

// Kennungen, die im Plan schon etwas anderes bedeuten.
const VERGEBEN = ['endziel', 'stamm', 'alle', 'treffpunkt']

type Teil = 'kein' | 'endziel' | 'zwischen' | 'straenge' | 'fest'

// Fett, Unterstrichen und Code-Zeichen fallen weg, Leerraum wird zu einem Leerzeichen.
const glatt = (wert: string): string =>
  wert
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const OFFEN_GENAU = /^(-+|–|—|\?+|…|\.{3}|offen|unklar|unbekannt|tbd|todo|keins|keines|leer)[.!]?$/i
const OFFEN_ANFANG = /^\(?noch (offen|unklar|nicht klar|nicht festgelegt|zu klären)\b/i

// Ein Platzhalter aus dem Format, den niemand ersetzt hat: „<ein Satz, oder …>“.
const PLATZHALTER = /^<[^<>]*>$/

// „noch offen“, „unklar“, „?“, „–“, ein stehen gebliebener Platzhalter und nichts: alles
// dasselbe, es ist noch nicht festgelegt.
export const istOffen = (wert: string): boolean => {
  const ganz = glatt(wert)
  const kern = ganz.replace(/^[„"“]+|[“"”]+$/g, '')

  return kern === '' || PLATZHALTER.test(ganz) || OFFEN_GENAU.test(kern) || OFFEN_ANFANG.test(kern)
}

// Woran zwei Sätze als dieselbe Festlegung gelten: Leerraum, Groß- und Kleinschreibung und
// der Punkt am Ende zählen nicht. So fällt die lokale Kopie eines Satzes weg, auch wenn der
// Chat ihn in GOAL.md eine Spur anders geschrieben hat.
export const satzSchluessel = (satz: string): string =>
  glatt(satz)
    .toLowerCase()
    .replace(/[\s.!]+$/, '')

// Welcher Abschnitt mit dieser Überschrift beginnt; null, wenn es keiner der vier ist.
const teilVon = (titel: string): Exclude<Teil, 'kein'> | null => {
  const name = kennung(titel.split(/[:：]/)[0] ?? '')

  if (/^endziel/.test(name)) {
    return 'endziel'
  }

  if (/^(zwischenziel|meilenstein|etappenziel)/.test(name)) {
    return 'zwischen'
  }

  if (/^festlegung/.test(name)) {
    return 'fest'
  }

  return /^(straenge|strang|bahnen|bahn)(-|$)/.test(name) ? 'straenge' : null
}

const LISTE = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/
const FELD = /^(ziel|geh(?:ö|oe)rt\s+zu|teil\s+von)\s*[:：]\s*(.*)$/i

type RohStrang = { name: string; ziel: string; gehoertZuText: string; ausListe: boolean }

// Liest GOAL.md. Die Datei darf unvollständig sein: Was fehlt oder „noch offen“ ist, bleibt
// leer. null heißt: Es gibt keine Datei.
export const leseGoal = (roh: string | null): Goal => {
  const hinweise: string[] = []

  if (roh === null) {
    return { vorhanden: false, endziel: '', zwischenziele: [], straenge: [], festlegungen: [], hinweise }
  }

  const zeilen = roh
    .replace(/^\ufeff/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r\n|\r|\n/)
  let teil: Teil = 'kein'
  // die Tiefe der Überschrift, mit der der Abschnitt begann
  let ebene = 0
  let istImZaun = false
  const endziel: string[] = []
  let istEndzielFertig = false
  const punkte: { titel: string; erreicht: boolean }[] = []
  const lose: string[] = []
  const straenge: RohStrang[] = []
  let strang: RohStrang | null = null
  // true: Die letzte Zeile war „Ziel: …“, die nächste darf sie fortsetzen
  let istZielOffen = false
  // die Sätze unter „Festlegungen“: als Liste, und Zeile für Zeile, falls dort keine Liste steht
  const saetze: string[] = []
  const loseSaetze: string[] = []
  // true: Die letzte Zeile gehörte zu einem Satz der Liste, die Zeile gleich darunter setzt ihn fort
  let istSatzOffen = false

  for (const zeile of zeilen) {
    if (/^\s*(```|~~~)/.test(zeile)) {
      istImZaun = !istImZaun
      continue
    }

    if (istImZaun) {
      continue
    }

    const kopf = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(zeile)

    if (kopf !== null) {
      const tiefe = (kopf[1] ?? '').length
      const titel = glatt(kopf[2] ?? '')

      istZielOffen = false
      istSatzOffen = false

      // Unter „Stränge“ ist jede tiefere Überschrift ein Strang, wie auch immer er heißt.
      if (teil === 'straenge' && tiefe > ebene) {
        const name = titel.replace(/[:：]\s*$/, '')

        strang = istOffen(name) ? null : { name, ziel: '', gehoertZuText: '', ausListe: false }

        if (strang !== null) {
          straenge.push(strang)
        }

        continue
      }

      teil = teilVon(titel) ?? 'kein'
      ebene = tiefe
      strang = null

      // „## Endziel: der Shop im Betrieb“: Der Satz steht schon in der Überschrift.
      const dahinter = glatt(titel.replace(/^[^:：]*[:：]?/, ''))

      if (teil === 'endziel' && dahinter !== '') {
        endziel.push(dahinter)
        istEndzielFertig = true
      }

      continue
    }

    const inListe = LISTE.exec(zeile)
    const inhalt = glatt((inListe?.[1] ?? zeile).replace(/^\s*>\s?/, ''))

    if (teil === 'endziel') {
      // Der erste Absatz zählt, von einer Liste nur der erste Punkt.
      if (inhalt === '' || (inListe !== null && endziel.length > 0)) {
        istEndzielFertig = istEndzielFertig || endziel.length > 0
      } else if (!istEndzielFertig) {
        endziel.push(inhalt)
      }

      continue
    }

    if (teil === 'zwischen') {
      const haken = /^\[([ xX])\]\s*(.*)$/.exec(inhalt)
      // Eingerückte Zeilen erläutern das Zwischenziel darüber und sind selbst keines.
      const istEingerueckt = /^(\s{2,}|\t)/.test(zeile)

      if (inListe !== null && !istEingerueckt) {
        punkte.push({ titel: glatt(haken?.[2] ?? inhalt), erreicht: /x/i.test(haken?.[1] ?? '') })
      } else if (inListe === null && inhalt !== '' && !istEingerueckt) {
        lose.push(inhalt)
      }

      continue
    }

    if (teil === 'fest') {
      const istEingerueckt = /^(\s{2,}|\t)/.test(zeile)

      if (inListe !== null && !istEingerueckt) {
        saetze.push(glatt(inhalt.replace(/^\[[ xX]\]\s*/, '')))
        istSatzOffen = true
      } else if (inListe === null && istSatzOffen && inhalt !== '') {
        // Ein langer Satz über mehrere Zeilen: Die Zeile gleich darunter gehört noch zu ihm.
        saetze[saetze.length - 1] = `${saetze[saetze.length - 1] ?? ''} ${inhalt}`.trim()
      } else {
        // Eine Leerzeile beendet den Satz. Ein eingerückter Listenpunkt auch: Er erläutert
        // den Satz darüber und ist selbst keiner.
        istSatzOffen = false

        if (inListe === null && inhalt !== '') {
          loseSaetze.push(inhalt)
        }
      }

      continue
    }

    if (teil !== 'straenge') {
      continue
    }

    const feld = FELD.exec(inhalt)

    if (feld !== null) {
      const wert = glatt(feld[2] ?? '')
      const istZiel = /^ziel$/i.test(feld[1] ?? '')

      if (strang !== null && istZiel) {
        strang.ziel = istOffen(wert) ? '' : wert
      } else if (strang !== null) {
        strang.gehoertZuText = istOffen(wert) ? '' : wert
      }

      istZielOffen = istZiel && strang !== null
      continue
    }

    // Stränge als Liste statt als Überschriften: „- Kasse: Bestellen ohne Umweg“.
    if (inListe !== null && (strang === null || strang.ausListe) && !/^\s/.test(zeile)) {
      const stuecke = /^(.*?)(?:\s*[:：]\s+|\s+[—–-]\s+)(.*)$/.exec(inhalt)
      const name = glatt(stuecke?.[1] ?? inhalt).replace(/[:：]$/, '')
      const ziel = glatt(stuecke?.[2] ?? '')

      istZielOffen = false
      strang = istOffen(name)
        ? null
        : { name, ziel: istOffen(ziel) ? '' : ziel, gehoertZuText: '', ausListe: true }

      if (strang !== null) {
        straenge.push(strang)
      }

      continue
    }

    // Ein Ziel über mehrere Zeilen: Die nächste Zeile ohne Punkt davor setzt es fort.
    if (istZielOffen && strang !== null && inhalt !== '' && inListe === null) {
      strang.ziel = istOffen(inhalt) ? strang.ziel : `${strang.ziel} ${inhalt}`.trim()
    } else {
      istZielOffen = false
    }
  }

  // ----- Zwischenziele -----

  const vergeben = new Set<string>(VERGEBEN)
  // Ohne Liste zählt jede Zeile des Abschnitts.
  const genannt = punkte.length > 0 ? punkte : lose.map(titel => ({ titel, erreicht: false }))
  const zwischenziele: GoalZwischenziel[] = []

  for (const einer of genannt.filter(one => !istOffen(one.titel))) {
    const schon = zwischenziele.some(one => kennung(one.titel) === kennung(einer.titel))

    if (schon) {
      hinweise.push(`GOAL.md nennt das Zwischenziel „${einer.titel}“ zweimal: Das zweite fällt weg.`)
      continue
    }

    zwischenziele.push({
      id: eindeutig(kennung(einer.titel) || 'zwischenziel', vergeben),
      titel: einer.titel,
      erreicht: einer.erreicht,
    })
  }

  // ----- Stränge -----

  // Das eine Zwischenziel, das der Text hinter „Gehört zu:“ meint; '' wenn keines passt.
  const zwischenzielVon = (wert: string): string => {
    const name = kennung(wert)
    const genau = zwischenziele.find(one => kennung(one.titel) === name)
    const aehnlich = zwischenziele.filter(one => {
      const titel = kennung(one.titel)

      return titel.includes(name) || name.includes(titel)
    })

    return name === '' ? '' : (genau?.id ?? (aehnlich.length === 1 ? (aehnlich[0]?.id ?? '') : ''))
  }

  const fertig: GoalStrang[] = []

  for (const einer of straenge) {
    if (fertig.some(one => kennung(one.name) === kennung(einer.name))) {
      hinweise.push(`GOAL.md nennt den Strang „${einer.name}“ zweimal: Der zweite fällt weg.`)
      continue
    }

    const gehoertZu = zwischenzielVon(einer.gehoertZuText)

    if (einer.gehoertZuText !== '' && gehoertZu === '') {
      hinweise.push(
        `GOAL.md, Strang „${einer.name}“: „Gehört zu: ${einer.gehoertZuText}“ nennt kein Zwischenziel aus der Liste.`,
      )
    }

    fertig.push({
      id: eindeutig(kennung(einer.name) || 'strang', vergeben),
      name: einer.name,
      ziel: einer.ziel,
      gehoertZu,
      gehoertZuText: einer.gehoertZuText,
    })
  }

  // ----- Festlegungen -----

  const festlegungen: string[] = []

  // Ohne Liste zählt jede Zeile des Abschnitts.
  for (const einer of (saetze.length > 0 ? saetze : loseSaetze).filter(one => !istOffen(one))) {
    if (festlegungen.some(one => satzSchluessel(one) === satzSchluessel(einer))) {
      hinweise.push(`GOAL.md nennt die Festlegung „${einer}“ zweimal: Die zweite fällt weg.`)
      continue
    }

    festlegungen.push(einer)
  }

  const satz = glatt(endziel.join(' '))

  return {
    vorhanden: true,
    endziel: istOffen(satz) ? '' : satz,
    zwischenziele,
    straenge: fertig,
    festlegungen,
    hinweise,
  }
}

// true: Die Datei ist da, sagt aber noch nichts über Ziele: kein Endziel, kein Zwischenziel,
// kein Strang. Festlegungen allein ändern daran nichts: Auch dann ist alles über Ziele nur
// vermutet, und beide Ansichten bieten weiter an, GOAL.md mit dem Chat zu entwerfen.
export const istLeer = (goal: Goal): boolean =>
  goal.vorhanden && goal.endziel === '' && goal.zwischenziele.length === 0 && goal.straenge.length === 0

// ---------- Die Aufträge an den Chat ----------

// Der Mod schreibt GOAL.md nie selbst. Diese Texte legt er ins Eingabefeld, aus jeder der
// zwei Ansichten dieselben; der Nutzer schickt sie ab, und der Chat schreibt die Datei mit
// ihm zusammen.

const REGELN =
  'Frag mich, wo etwas unklar ist, eine Frage auf einmal und mit einer Empfehlung. ' +
  'Was noch nicht klar ist, bleibt offen. Schreib die Datei erst, wenn ich zugestimmt habe.'

// Der Auftrag, GOAL.md für dieses Repo zu entwerfen.
export const promptGoalAnlegen = (): string =>
  [
    'Lass uns für dieses Repo die Datei GOAL.md in der Wurzel anlegen. Sie ist der Anker des Plans, den der Ziel-Graph zeigt: das Endziel, die Zwischenziele auf dem Weg dorthin und je Strang das größere Ziel, das er verfolgt.',
    `Lies dazu README.md, CLAUDE.md und die Doku unter docs/ und schlag mir einen Entwurf vor. ${REGELN}`,
    `Das Format:\n\n${GOAL_FORMAT}`,
    'Die Stränge sind später die Bahnen des Graphen und die Spalten der Karten: wenige, je ein bis zwei Worte, so wie das Projekt seine Arbeit selbst gliedert.',
    'Unter „Festlegungen“ stehen Sätze von mir, die bei jedem Ableiten des Plans gelten. Der Abschnitt bleibt leer, solange ich keine nenne: Schlag selbst keine vor.',
  ].join('\n\n')

export type StrangFrage = {
  name: string
  // true: Der Strang steht schon in GOAL.md, nur sein Ziel fehlt
  inGoal: boolean
  // true: GOAL.md gibt es
  mitGoal: boolean
  // was das Modell als Ziel vermutet; '' ohne
  vermutung: string
  // die Titel der Bündel des Strangs, damit der Chat weiß, worum es geht
  buendel: readonly string[]
}

// Der Auftrag, das Ziel eines Strangs mit dem Nutzer festzulegen.
export const promptStrangZiel = (frage: StrangFrage): string =>
  [
    `Für den Strang „${frage.name}“ ist in GOAL.md noch kein Ziel festgelegt. Klär mit mir, wohin dieser Strang führt, und trag es dann in GOAL.md ein.`,
    !frage.mitGoal
      ? `GOAL.md gibt es noch nicht. Leg sie in der Wurzel des Repos an, in diesem Format:\n\n${GOAL_FORMAT}`
      : frage.inGoal
        ? `Der Strang steht schon unter „## Stränge“. Es fehlt die Zeile „Ziel: …“ unter „### ${frage.name}“.`
        : `Der Strang steht noch nicht in GOAL.md: Der Plan hat ihn in den anderen Quellen gefunden. Klär zuerst mit mir, ob er ein eigener Strang bleibt. Wenn ja, leg ihn unter „## Stränge“ als „### ${frage.name}“ mit der Zeile „Ziel: …“ an.`,
    frage.vermutung === '' ? '' : `Der Plan vermutet als Ziel: ${frage.vermutung}`,
    frage.buendel.length === 0
      ? ''
      : `Was der Plan in diesem Strang sieht:\n${frage.buendel.map(one => `- ${one}`).join('\n')}`,
    REGELN,
  ]
    .filter(one => one !== '')
    .join('\n\n')

// Der Auftrag, das Endziel mit dem Nutzer festzulegen.
export const promptEndziel = (mitGoal: boolean, vermutung: string): string =>
  [
    'In GOAL.md ist noch kein Endziel festgelegt. Klär mit mir, was am Ende erreicht sein soll, und trag es dann als einen Satz unter „## Endziel“ ein.',
    mitGoal
      ? ''
      : `GOAL.md gibt es noch nicht. Leg sie in der Wurzel des Repos an, in diesem Format:\n\n${GOAL_FORMAT}`,
    vermutung === '' ? '' : `Der Plan vermutet als Endziel: ${vermutung}`,
    REGELN,
  ]
    .filter(one => one !== '')
    .join('\n\n')

// Der Auftrag, die Festlegungen, die erst lokal liegen, in GOAL.md einzutragen. Sobald ein
// Satz dort steht, lässt der Mod seine lokale Kopie fallen.
export const promptFestlegungen = (saetze: readonly string[], mitGoal: boolean): string =>
  [
    `Trag ${saetze.length === 1 ? 'diese Festlegung' : 'diese Festlegungen'} in GOAL.md ein, unter „## Festlegungen“, je Satz ein Listenpunkt und wörtlich:\n\n${saetze.map(one => `- ${one}`).join('\n')}`,
    mitGoal
      ? 'Gibt es den Abschnitt „## Festlegungen“ noch nicht, leg ihn am Ende der Datei an. Was dort schon steht, bleibt stehen. Ändere sonst nichts an der Datei.'
      : `GOAL.md gibt es noch nicht. Leg sie in der Wurzel des Repos an, in diesem Format, und lass offen, was noch nicht klar ist:\n\n${GOAL_FORMAT}`,
    'Das sind Sätze von mir, die bei jedem Ableiten des Plans gelten: Der Ziel-Graph liest sie aus GOAL.md.',
  ].join('\n\n')
