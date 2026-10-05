import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { ZielGraphGeladen, ZielGraphLauf } from '../types'

import { fasseZusammen, kurz, liesChats, nameVon, neueFragen, nimmAuf, nimmHeraus } from './chats'
import type { ChatZugang } from './chats'
import { MODELL } from './fest'
import { SPALTEN, zeichneGraphLeiste } from './graph/leiste'
import type { GraphLage } from './graph/leiste'
import { registriereAntwort } from './karten/antwort'
import { zeichneKartenLeiste } from './karten/leiste'
import type { KartenLage } from './karten/leiste'
import { wunschZellen } from './karten/zeichnen'
import { entferneFestlegung, ladeMitTickets, legeFestlegung, leiteAb } from './plan/lauf'
import type { Aufruf, LaufZugang } from './plan/lauf'
import type { Auftrag } from './plan/lesen'
import { liesTickets } from './plan/tickets'
import type { TicketLage } from './plan/tickets'
import type { Taten } from './teile'
import { mehrzahl, sekunden } from './worte'
import { GRAPH_START, KARTEN_START, KEINE_CHATS, NICHTS_GELADEN, RUHE } from './zustand'

// Der Zugang des Mods zur Engine: ein Plan, zwei Ansichten. Hier stehen das Laden, der Lauf,
// der den Plan ableitet, das Aufnehmen einer Festlegung, die Handgriffe aller Knöpfe und die
// zwei Leisten. Das Ticket-System des Repos wird nur gefragt, wenn der Plan geladen wird,
// bei „Neu laden“ und einmal je Lauf. `validate` folgt `$` nicht über einen Import hinweg:
// Jede Stelle, an der der Mod die Engine braucht, steht deshalb in dieser Datei. Gezeichnet
// und gerechnet wird in den Dateien daneben, ohne `$`.

// Die schmale Ansicht: die laufenden Chats und der Plan als Graph.
const GRAPH = 'ziel-graph'
const GRAPH_TITEL = 'Ziel-Graph'
// Die breite Ansicht: derselbe Plan als Prozesskarten.
const KARTEN = 'orchestrator'
const KARTEN_TITEL = 'Orchestrator'
// Großzügig: Die Antwort ist ein JSON mit einigen tausend Tokens und kommt am Stück.
const MAX_TOKENS = 16_000
const TIMEOUT_MS = 240_000
const AUFRUF: Aufruf = { modell: MODELL, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS }
// So oft zählen die Leisten die Sekunden eines Laufs weiter.
const LAUF_TAKT_MS = 5_000
// So oft liest jede Session die Stände der Chats neu.
const CHAT_TAKT_MS = 20_000

// Plan, Chats und Lauf teilen sich beide Ansichten; was der Nutzer einstellt, hat jede für sich.
const geladen = atom({ plugin: 'ziel-graph', key: 'geladen' } as const, NICHTS_GELADEN)
const chats = atom({ plugin: 'ziel-graph', key: 'chats' } as const, KEINE_CHATS)
const uhr = atom({ plugin: 'ziel-graph', key: 'uhr' } as const, 0)
const lauf = atom({ plugin: 'ziel-graph', key: 'lauf' } as const, RUHE)
const graph = atom({ plugin: 'ziel-graph', key: 'graph' } as const, GRAPH_START)
const karten = atom({ plugin: 'ziel-graph', key: 'karten' } as const, KARTEN_START)

let letzterPrompt = ''
// Was im Feld für eine neue Festlegung steht. Kein Zustand der Session: Jeder Tastendruck
// würde sonst die breite Ansicht neu zeichnen.
let festEntwurf = ''
// Die Fragen, die dieses Fenster schon kennt: nur neue lösen einen Toast aus.
let bekannt: Map<string, string> | null = null
// Der Takt, in dem die Chats neu gelesen werden; null, solange er nicht läuft.
let chatTakt: Timer | null = null
// Was das Ticket-System zuletzt genannt hat; null, solange es in diesem Fenster noch nicht
// gefragt wurde. Wer den Plan nur neu aufbaut, etwa nach einer Festlegung, nimmt das.
let tickets: TicketLage | null = null
// Ob in diesem Fenster gerade ein Lauf unterwegs ist, und seit wann. Der Zustand `lauf`
// übersteht ein Neuladen des Mods, der Lauf selbst nicht: deshalb zählt für „läuft schon“
// nur das hier.
let unterwegs = false
let unterwegsSeit = 0
// Ein Lauf endet spätestens mit der Zeitgrenze des Modell-Aufrufs. Meldet er sich danach
// immer noch nicht, ist er verloren, und der Knopf darf einen neuen starten.
const VERLOREN_MS = TIMEOUT_MS + 60_000

// Der Zugang der Chat-Logik und der Quellen zur Engine. `frage` ist hier der kleine Aufruf,
// der nach einer Antwort den Stand eines Chats fasst.
const zugang = ($: EngineInterface): ChatZugang => ({
  sitzung: () => $.session.id(),
  heim: async () => (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.',
  repo: () => $.session.repo(),
  wurzel: () => $.session.root(),
  nachrichten: () => $.session.messages(),
  jetzt: () => $.clock.now(),
  gibtEs: pfad => $.fs.exists(pfad),
  liste: pfad => $.fs.list(pfad),
  lies: pfad => $.fs.read(pfad),
  schreibe: (pfad, text) => $.fs.write(pfad, text),
  laufe: argv => $.process.run(argv, { timeoutMs: 15_000 }),
  frage: (system, prompt) =>
    $.model.complete({ model: MODELL, system, prompt, maxTokens: 400, timeoutMs: 30_000 }),
  melde: text => $.ui.log(text),
})

// Derselbe Zugang für den Lauf: Nur `frage` ist dort der große Aufruf, der den Plan ableitet.
const laufZugang = ($: EngineInterface): LaufZugang => ({
  ...zugang($),
  frage: (system, prompt) =>
    $.model.complete({ model: MODELL, system, prompt, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS }),
})

// ---------- Laden ----------

// Liest die Stände der laufenden Chats neu und meldet, wo ein anderer Chat neu auf den
// Nutzer wartet. `nurNeues`: Hat sich nichts geändert, bleiben die Chats im Zustand
// unberührt, und die breite Ansicht wird nicht neu gezeichnet. So stört der Takt niemanden,
// der dort gerade in ein Feld tippt. Die Uhr geht trotzdem weiter: Die schmale Ansicht hat
// kein Feld, und ihre Zeitangaben („vor 3 Min“) sollen nicht stehen bleiben.
const ladeChats = async ($: EngineInterface, nurNeues = false): Promise<void> => {
  try {
    const neu = await liesChats(zugang($))
    const vorher = bekannt

    bekannt = new Map(neu.chats.map(one => [one.id, one.frage]))

    for (const chat of neueFragen(vorher, neu)) {
      $.ui.toast(`${nameVon(chat)} wartet auf dich: ${kurz(chat.frage, 90)}`, { timeoutMs: 8000 })
    }

    const alt = await read($, chats)
    const istGleich = alt.ich === neu.ich && JSON.stringify(alt.chats) === JSON.stringify(neu.chats)

    if (!nurNeues || !istGleich) {
      await update($, chats, () => neu)
    }

    await update($, uhr, () => neu.gelesen)
  } catch (fehler) {
    $.ui.log(`Chats nicht lesbar: ${String(fehler)}`)
  }
}

// Woher der Stand der Tickets beim Laden kommt. 'frisch': Das Ticket-System wird gefragt.
// 'gemerkt': Es gilt, was es zuletzt genannt hat, und es wird nicht gefragt.
type TicketWahl = 'frisch' | 'gemerkt'

// Lädt den letzten gespeicherten Plan des Repos, GOAL.md, die Festlegungen und den Stand der
// Tickets. Kein Modell-Aufruf.
const ladeNurPlan = async ($: EngineInterface, wie: TicketWahl = 'frisch'): Promise<void> => {
  try {
    const neu = await ladeMitTickets(zugang($), wie === 'frisch' ? undefined : tickets)

    // Ohne gespeicherten Plan wird nicht gefragt: Dann bleibt, was schon gemerkt ist.
    tickets = neu.tickets ?? tickets
    await update($, geladen, () => neu.geladen)
  } catch (fehler) {
    $.ui.log(`Plan nicht lesbar: ${String(fehler)}`)
  }
}

// Dasselbe und dazu die Chats.
const lade = async ($: EngineInterface, wie: TicketWahl = 'frisch'): Promise<void> => {
  await ladeNurPlan($, wie)
  await ladeChats($)
}

// Fragt das Ticket-System und legt seinen Stand auf den Plan. Ohne Plan gibt es nichts
// aufzufrischen, und ohne Ticket-System bleibt alles, wie es geladen ist.
const frischeTicketsAuf = async ($: EngineInterface): Promise<void> => {
  try {
    if ((await read($, geladen)).plan === null) {
      return
    }

    const lage = await liesTickets(zugang($))

    if (lage.tracker !== 'keine') {
      tickets = lage
      await ladeNurPlan($, 'gemerkt')
    }
  } catch (fehler) {
    $.ui.log(`Tickets nicht gelesen: ${String(fehler)}`)
  }
}

// Was beide Leisten vom Plan zeichnen. Der Zustand übersteht ein Neuladen des Mod-Codes:
// Stammt er noch von einer älteren Fassung, fehlen ihm Felder, und die Anfangswerte füllen sie.
const liesGeladen = async ($: EngineInterface): Promise<ZielGraphGeladen> => ({
  ...NICHTS_GELADEN,
  ...(await read($, geladen)),
})

// Lädt, was sofort da ist, und fragt das Ticket-System gleich danach. Es antwortet übers
// Netz: Wer eine Session beginnt oder eine Leiste öffnet, wartet nicht darauf. Bis dahin
// zeigen die Bündel, was es zuletzt genannt hat, und davor den Stand vom Ableiten.
const ladeOhneWarten = async ($: EngineInterface): Promise<void> => {
  await lade($, 'gemerkt')
  $.clock.after(0, () => void frischeTicketsAuf($))
}

// Jede Session liest die Chats von selbst neu: Nur so meldet sie eine neue Frage.
const haltChatsFrisch = ($: EngineInterface): void => {
  chatTakt ??= $.clock.every(CHAT_TAKT_MS, () => void ladeChats($, true))
}

const ladeVomKnopf = async ($: EngineInterface): Promise<void> => {
  await lade($)
  haltChatsFrisch($)
}

// ---------- Die Chats ----------

// Die zwei Knöpfe der schmalen Ansicht: diesen Chat von Hand aufnehmen oder herausnehmen.
const nimmChatAuf = async ($: EngineInterface): Promise<void> => {
  try {
    await nimmAuf(zugang($))
    await ladeChats($)
  } catch (fehler) {
    $.ui.log(`Chat nicht aufgenommen: ${String(fehler)}`)
  }
}

const nimmChatHeraus = async ($: EngineInterface): Promise<void> => {
  try {
    await nimmHeraus(zugang($))
    await ladeChats($)
  } catch (fehler) {
    $.ui.log(`Chat nicht herausgenommen: ${String(fehler)}`)
  }
}

const nachAntwort = async ($: EngineInterface, antwort: string): Promise<void> => {
  if (await fasseZusammen(zugang($), antwort, letzterPrompt)) {
    await ladeChats($)
  }
}

// ---------- Festlegungen ----------

// Nimmt einen Satz des Nutzers als Festlegung auf: Er gilt ab dem nächsten Ableiten und
// liegt erst lokal, im Ordner des Plans. GOAL.md schreibt der Mod nie.
const legeFest = async ($: EngineInterface, satz: string): Promise<void> => {
  try {
    const ausgang = await legeFestlegung(zugang($), satz)

    if (!ausgang.ok) {
      $.ui.toast(ausgang.grund, { timeoutMs: 6000 })

      return
    }

    festEntwurf = ''
    await ladeNurPlan($, 'gemerkt')
    $.ui.toast('Festgelegt. Der Satz gilt ab dem nächsten Ableiten.', { timeoutMs: 6000 })
  } catch (fehler) {
    $.ui.toast('Die Festlegung ließ sich nicht speichern.', { timeoutMs: 6000 })
    $.ui.log(`Festlegung nicht gespeichert: ${String(fehler)}`)
  }
}

// Nimmt eine Festlegung zurück, die erst lokal liegt.
const nimmFestZurueck = async ($: EngineInterface, satz: string): Promise<void> => {
  try {
    await entferneFestlegung(zugang($), satz)
    await ladeNurPlan($, 'gemerkt')
    $.ui.toast('Festlegung entfernt.')
  } catch (fehler) {
    $.ui.toast('Die Festlegung ließ sich nicht entfernen.', { timeoutMs: 6000 })
    $.ui.log(`Festlegung nicht entfernt: ${String(fehler)}`)
  }
}

// ---------- Der Lauf ----------

const scheitere = async ($: EngineInterface, grund: string): Promise<void> => {
  await update($, lauf, (alt): ZielGraphLauf => ({ ...alt, phase: 'fehler', grund }))
  $.ui.toast(`Ableiten fehlgeschlagen: ${grund}`, { timeoutMs: 10_000 })
}

// Zählt die Sekunden des Laufs weiter, damit die Leisten nicht stehen bleiben.
const zaehle = async ($: EngineInterface): Promise<void> => {
  try {
    const jetzt = await $.clock.now()

    await update($, lauf, alt =>
      alt.phase === 'laeuft' ? { ...alt, sekunden: Math.round((jetzt - alt.seit) / 1000) } : alt,
    )
  } catch {
    // Nur die Anzeige: Der Lauf geht weiter.
  }
}

// Der Lauf selbst. Er läuft außerhalb des Knopfdrucks, der ihn gestartet hat. `seit` ist
// sein Beginn und zugleich sein Name: Nur der jüngste Lauf darf etwas zeigen. Sein Ergebnis
// ist der eine Plan: Beide Ansichten zeichnen ihn, aus welcher der Lauf auch kam.
const fuehreAus = async ($: EngineInterface, seit: number): Promise<void> => {
  const takt = $.clock.every(LAUF_TAKT_MS, () => void zaehle($))

  try {
    const ausgang = await leiteAb(laufZugang($), AUFRUF, () => unterwegsSeit === seit)

    takt.cancel()

    if (unterwegsSeit !== seit) {
      // Der Lauf galt als verloren, und ein neuerer ist unterwegs: Dessen Ergebnis zählt.
      return
    }

    if (ausgang.ok) {
      const { plan, warnungen, fakten } = ausgang.geladen

      tickets = ausgang.tickets
      await update($, geladen, () => ausgang.geladen)
      // Der neue Plan hat neue Zeilen: Was im Graphen aufgeklappt war, gibt es so nicht mehr.
      await update($, graph, alt => ({ ...alt, offen: [] }))
      await update($, lauf, (alt): ZielGraphLauf => ({ ...alt, phase: 'fertig', grund: '' }))
      await ladeChats($)
      $.ui.toast(
        `Ableiten fertig nach ${sekunden(fakten?.dauerMs ?? 0)} s: ` +
          `${mehrzahl(plan?.buendel.length ?? 0, 'Bündel', 'Bündel')} in ` +
          mehrzahl(plan?.straenge.length ?? 0, 'Strang', 'Strängen') +
          (warnungen.length === 0 ? '' : `, ${mehrzahl(warnungen.length, 'Hinweis', 'Hinweise')}`),
        { timeoutMs: 8000 },
      )
    } else {
      await scheitere(
        $,
        ausgang.datei === '' ? ausgang.grund : `${ausgang.grund} Der Lauf liegt in ${ausgang.datei}.`,
      )
    }
  } catch (fehler) {
    takt.cancel()

    if (unterwegsSeit === seit) {
      await scheitere($, `Der Lauf ist abgebrochen: ${String(fehler)}`)
    }
  } finally {
    if (unterwegsSeit === seit) {
      unterwegs = false
    }
  }
}

// Startet einen Lauf, ohne auf ihn zu warten. false: Es ist schon einer unterwegs.
const starte = async ($: EngineInterface): Promise<boolean> => {
  const seit = await $.clock.now()

  // Von hier bis zum Merken ohne Warten: Zwei Starts zugleich ergeben einen Lauf.
  if (unterwegs && seit - unterwegsSeit < VERLOREN_MS) {
    return false
  }

  unterwegs = true
  unterwegsSeit = seit

  try {
    await update($, lauf, (): ZielGraphLauf => ({ phase: 'laeuft', seit, sekunden: 0, grund: '' }))
    // Nach dem Knopfdruck, nicht darin: Der Modell-Aufruf hält ihn nicht auf.
    $.clock.after(0, () => void fuehreAus($, seit))
  } catch (fehler) {
    unterwegs = false
    throw fehler
  }

  return true
}

const starteVomKnopf = async ($: EngineInterface): Promise<void> => {
  try {
    if (!(await starte($))) {
      $.ui.toast('Ein Lauf ist schon unterwegs.')
    }
  } catch (fehler) {
    $.ui.log(`Ableiten nicht gestartet: ${String(fehler)}`)
  }
}

// Ein Lauf, der laut Zustand noch läuft, obwohl in diesem Fenster keiner unterwegs ist:
// Der Mod wurde mittendrin neu geladen. Die Leisten sollen das sagen, statt ewig zu warten.
const raeumeAuf = async ($: EngineInterface): Promise<void> => {
  if (!unterwegs && (await read($, lauf)).phase === 'laeuft') {
    await update($, lauf, (alt): ZielGraphLauf =>
      alt.phase === 'laeuft'
        ? { ...alt, phase: 'fehler', grund: 'Der Lauf wurde unterbrochen: Der Mod ist mittendrin neu geladen worden.' }
        : alt,
    )
  }
}

// ---------- Knöpfe ----------

const wechsle = (liste: readonly string[], id: string): string[] =>
  liste.includes(id) ? liste.filter(one => one !== id) : [...liste, id]

// Legt einen Auftrag ins Eingabefeld des Chats. Abschicken tut ihn der Nutzer selbst. Hat er
// dort schon etwas getippt, bleibt es stehen, und der Auftrag kommt dahinter.
const lege = async ($: EngineInterface, auftrag: Auftrag): Promise<void> => {
  const { text, was } = auftrag

  if (text === null) {
    return
  }

  try {
    let entwurf = ''

    try {
      entwurf = (await $.prompt.read()).text
    } catch {
      // Ohne lesbares Eingabefeld gilt es als leer.
    }

    const haengtAn = entwurf.trim() !== ''
    const r = await $.prompt.fill({
      text: haengtAn ? `\n\n${text}` : text,
      mode: haengtAn ? 'append' : 'replace',
    })
    const warum =
      r.refusal === 'dialog'
        ? ': Ein Dialog ist offen.'
        : r.refusal === 'no_composer'
          ? ': Diese Oberfläche hat kein Eingabefeld.'
          : '.'

    $.ui.toast(
      r.isFilled
        ? `${was} liegt im Eingabefeld${haengtAn ? ', hinter deinem Entwurf' : ''}. Prüfen und abschicken.`
        : `Das Eingabefeld hat den Text nicht angenommen${warum}`,
      { timeoutMs: 6000 },
    )
  } catch (fehler) {
    $.ui.log(`Eingabefeld nicht gefüllt: ${String(fehler)}`)
  }
}

// Die Handgriffe aller Knöpfe, für beide Leisten. Ableiten, Laden und die Aufträge sind in
// beiden dieselben; was nur eine Ansicht einstellt, schreibt nur in deren Zustand, und nur
// sie wird davon neu gezeichnet.
const tatenVon = ($: EngineInterface): Taten => ({
  ableiten: () => void starteVomKnopf($),
  laden: () => void ladeVomKnopf($),
  lege: auftrag => void lege($, auftrag),
  aufnehmen: () => void nimmChatAuf($),
  herausnehmen: () => void nimmChatHeraus($),
  zeige: ansicht => void update($, graph, alt => ({ ...alt, ansicht })),
  klappe: id => void update($, graph, alt => ({ ...alt, offen: wechsle(alt.offen, id) })),
  // Klappt alle Zeilen auf; sind schon alle offen, klappt es sie zu.
  klappeAlle: ids =>
    void update($, graph, alt => ({
      ...alt,
      offen: ids.every(one => alt.offen.includes(one)) ? [] : [...ids],
    })),
  waehle: id => void update($, karten, alt => ({ ...alt, wahl: id })),
  faerbe: farben => void update($, karten, alt => ({ ...alt, farben })),
  merkeFest: text => {
    festEntwurf = text
  },
  // Enter im Feld bringt den Satz mit; der Knopf nimmt, was im Feld steht.
  festlegen: satz => void legeFest($, satz ?? festEntwurf),
  entferneFest: satz => void nimmFestZurueck($, satz),
})

export const register: Register = on => {
  // Versuch, in sich geschlossen: einen wartenden Chat aus der breiten Ansicht beantworten.
  // Der Aufruf steht zuerst, damit sein Hook über dem Zeichnen dieser Ansicht liegt.
  registriereAntwort(on)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'graph',
      description: 'Den Ziel-Graphen als Seitenleiste öffnen: die laufenden Chats und der Plan des Repos',
    })
    await $.command.register({
      name: 'orchestrator',
      description: 'Denselben Plan als Prozesskarten breit neben dem Chat öffnen',
    })
    await raeumeAuf($)
    // Eine Leiste, die vom letzten Mal noch offen ist, soll nicht leer dastehen.
    await ladeOhneWarten($)
    haltChatsFrisch($)

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    letzterPrompt = e.text

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    const istEigeneAntwort = e.agentId === undefined && e.reason === 'answer' && e.answer !== ''

    if (istEigeneAntwort) {
      // Nach der Runde, nicht in ihr: die Zusammenfassung hält das Rundenende nicht auf.
      $.clock.after(0, () => void nachAntwort($, e.answer))
    }

    return next(e)
  })

  on('command.run', { command: 'graph' }, async $ => {
    await ladeOhneWarten($)
    haltChatsFrisch($)

    const offen = await $.ui.open({ id: GRAPH, title: GRAPH_TITEL, columns: SPALTEN })
    const flaechen = (await $.session.surfaces()).join(', ') || 'keine'
    // Sagt, ob die Leiste wirklich gezeichnet wird: auf einem verbundenen Gerät ohne Platz
    // dafür wartet sie nur.
    const lage = offen.isPlaced ? 'geöffnet.' : `wartet und wird nicht gezeichnet: ${offen.reason}`

    return { text: `${GRAPH_TITEL} ${lage} (Oberflächen: ${flaechen})` }
  })

  on('command.run', { command: 'orchestrator' }, async $ => {
    await ladeOhneWarten($)
    haltChatsFrisch($)

    const { plan } = await read($, geladen)
    const offen = await $.ui.open({
      id: KARTEN,
      title: KARTEN_TITEL,
      columns: wunschZellen(plan?.straenge.length ?? 0),
    })
    // Sagt, ob die Leiste wirklich gezeichnet wird: auf einem verbundenen Gerät ohne Platz
    // dafür wartet sie nur.
    const lage = offen.isPlaced
      ? 'geöffnet.'
      : `wartet und wird nicht gezeichnet: ${offen.reason.replace(/\.$/, '')}.`
    const inhalt =
      plan === null
        ? 'Noch kein Plan für dieses Repo: „Neu ableiten“ in der Leiste leitet ihn ab.'
        : `Letzter Plan geladen: ${mehrzahl(plan.buendel.length, 'Bündel', 'Bündel')} in ` +
          `${mehrzahl(plan.straenge.length, 'Strang', 'Strängen')}.`

    return { text: `${KARTEN_TITEL} ${lage} ${inhalt}` }
  })

  // Die schmale Ansicht. Sie liest Plan, Chats und Lauf und dazu nur ihre eigene Einstellung
  // und die Uhr: Ihre Zeitangaben zählen ab dem letzten Lesen, nicht ab der letzten Änderung.
  on('ui.render', { component: 'Pane', requestId: GRAPH }, async ($, e) => {
    const laufend = await read($, chats)
    const lage: GraphLage = {
      laufend: { ...laufend, gelesen: Math.max(laufend.gelesen, await read($, uhr)) },
      stand: await liesGeladen($),
      jetzt: await read($, lauf),
      wahl: await read($, graph),
    }

    // Das Terminal hat kein Svg: Dort steht der Graph als Liste.
    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)

      return zeichneGraphLeiste({ Box, Text, Button, Select: null, Svg: null, Input: null }, lage, tatenVon($))
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)

    return zeichneGraphLeiste({ Box, Text, Button, Select: null, Svg, Input: null }, lage, tatenVon($))
  })

  // Die breite Ansicht. Sie liest denselben Plan, dieselben Chats und denselben Lauf.
  on('ui.render', { component: 'Pane', requestId: KARTEN }, async ($, e) => {
    const lage: KartenLage = {
      stand: await liesGeladen($),
      laufend: await read($, chats),
      jetzt: await read($, lauf),
      wahl: await read($, karten),
      zellen: e.props.bodyColumns,
      entwurf: festEntwurf,
    }

    // Das Terminal hat kein Svg, die mobile App weder Select noch Eingabefeld: dort
    // zeichnet der Ersatz.
    if (e.surface === 'terminal') {
      const { Box, Text, Button, Select, Input } = $.ui.resolve(e)

      return zeichneKartenLeiste({ Box, Text, Button, Select, Svg: null, Input }, lage, tatenVon($))
    }

    if (e.surface === 'mobile') {
      const { Box, Text, Button, Svg } = $.ui.resolve(e)

      return zeichneKartenLeiste({ Box, Text, Button, Select: null, Svg, Input: null }, lage, tatenVon($))
    }

    const { Box, Text, Button, Select, Svg, Input } = $.ui.resolve(e)

    return zeichneKartenLeiste({ Box, Text, Button, Select, Svg, Input }, lage, tatenVon($))
  })
}
