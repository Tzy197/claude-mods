import { expect, test } from 'claude-code/testing'

import type { ZielGraphChats, ZielGraphPlan, ZielGraphTicket } from '../types'

import { fasseErledigtes, fasseRuhendes } from '../hooks/graph/ruhig'
import { sicht as graphSicht, zeichneSvg } from '../hooks/graph/zeichnen'
import { graphDaten } from '../hooks/graph/zeilen'
import { auftragFuer, detail, fertigId, ruhtId, sicht } from '../hooks/karten/karten'
import { baueFlaeche, kopfBild } from '../hooks/karten/zeichnen'
import { AKTIV_TAGE, istAktiv, istFrischGeschlossen, ruhende } from '../hooks/plan/dauer'
import { frische } from '../hooks/plan/frisch'
import { KEINE_NAMEN } from '../hooks/plan/goal'
import { dauerAuftrag, fertigZeile, fertigeZiele } from '../hooks/plan/lesen'
import { ausGithub, merke } from '../hooks/plan/tickets'

import { pruefeGraph, wahl } from './bild'
import { BAHNEN, GOAL, KEINE, TICKETS, ZEILEN, ZEILEN_MIT_TICKETS, alsGithub, amWarenkorb, antwort, antwortMitTickets, gelungen, umfeld } from './shop'
import type { ShopTicket } from './shop'
import {
  BREIT,
  GITHUB,
  GRAPH,
  JETZT,
  TAG,
  VERBRAUCH,
  WURZEL,
  baue,
  befehl,
  gespeichert,
  inhalt,
  legeChat,
  legeDoku,
  legeShop,
  leiteAb,
  mitBildern,
  mitTickets,
  ordnerVon,
  schluesselVon,
} from './welt'

// Dauerläufer: Stränge ohne Ende. Einer, an dem niemand arbeitet, ruht und steht in beiden
// Ansichten in einer Zeile oder Karte; neue Aktivität öffnet ihn wieder. Ein Ziel, das alles
// erledigt hat, kann zum Dauerläufer werden. Und wer einen Strang macht, steht bei seinem
// Namen. Alle Testdaten sind erfunden.

// Im Shop ist „Betrieb“ der Dauerläufer, mit zwei offenen Bündeln; der eine Chat hängt am
// Warenkorb der Kasse. Hier hängt er an einem Bündel des Betriebs.
const AM_BETRIEB = { chats: [{ id: 'c1', zeile: 'ladezeit' }] }

// Ein Plan, in dem ein Bündel diese Tickets nennt, so wie der frische Stand sie darauf legt.
const mitTicketsAn = (plan: ZielGraphPlan, id: string, tickets: ZielGraphTicket[]): ZielGraphPlan => ({
  ...plan,
  buendel: plan.buendel.map(one => (one.id === id ? { ...one, tickets } : one)),
})

const ticket = (schluessel: string, mehr: Partial<ZielGraphTicket> = {}): ZielGraphTicket => ({
  schluessel,
  titel: `Ticket ${schluessel}`,
  zu: false,
  grund: '',
  ...mehr,
})

// ---------- Wann ein Dauerläufer aktiv ist ----------

test('ein Dauerläufer ist aktiv, wenn ein laufender Chat an ihm hängt oder in den letzten 7 Tagen ein Ticket geschlossen wurde', () => {
  const { plan } = gelungen(antwort())
  const betrieb = { id: 'betrieb' }

  // Niemand arbeitet am Betrieb, und er hat keine Tickets: Er ruht. Ein Ziel ruht nie.
  expect(istAktiv(plan, betrieb, KEINE, JETZT)).toBe(false)
  expect(istAktiv(plan, betrieb, amWarenkorb('Ja?'), JETZT)).toBe(false)
  expect([...ruhende(plan, KEINE, JETZT)]).toEqual(['betrieb'])
  expect(ruhende(plan, amWarenkorb(), JETZT).has('kasse')).toBe(false)
  expect(ruhende(plan, KEINE, JETZT).has('suche')).toBe(false)

  // Ein laufender Chat an einem seiner Bündel: aktiv, ob er wartet oder nicht.
  const amBetrieb = gelungen(antwort(AM_BETRIEB)).plan

  expect(amBetrieb.buendel.find(one => one.id === 'ladezeit')?.chats).toEqual(['sitzung-7'])
  expect(istAktiv(amBetrieb, betrieb, amWarenkorb(), JETZT)).toBe(true)
  expect(istAktiv(amBetrieb, betrieb, amWarenkorb('Ja?'), JETZT)).toBe(true)
  expect([...ruhende(amBetrieb, amWarenkorb(), JETZT)]).toEqual([])
  // Derselbe Chat, fertig oder ausgeblendet, zählt nicht: Er steht nicht mehr unter den laufenden.
  const [chat] = amWarenkorb().chats
  const fertig: ZielGraphChats = { ich: 'sitzung-1', chats: [], fertige: chat === undefined ? [] : [{ ...chat, fertig: true }], ausgeblendet: [], gelesen: 1 }
  const still: ZielGraphChats = { ich: 'sitzung-1', chats: [], fertige: [], ausgeblendet: chat === undefined ? [] : [chat], gelesen: 1 }

  expect(istAktiv(amBetrieb, betrieb, fertig, JETZT)).toBe(false)
  expect(istAktiv(amBetrieb, betrieb, still, JETZT)).toBe(false)
  expect([...ruhende(amBetrieb, KEINE, JETZT)]).toEqual(['betrieb'])

  // Ein Ticket eines seiner Bündel, geschlossen in den letzten 7 Tagen: aktiv, ohne Chat.
  // Heute ist der 2026-10-04.
  const geschlossenAm = (tag: string | undefined) =>
    mitTicketsAn(plan, 'ladezeit', [ticket('31', { zu: true, ...(tag === undefined ? {} : { geschlossen: tag }) }), ticket('32')])

  expect(AKTIV_TAGE).toBe(7)
  expect(istAktiv(geschlossenAm('2026-10-04'), betrieb, KEINE, JETZT)).toBe(true)
  expect(istAktiv(geschlossenAm('2026-10-01'), betrieb, KEINE, JETZT)).toBe(true)
  expect(istAktiv(geschlossenAm('2026-09-27'), betrieb, KEINE, JETZT)).toBe(true)
  expect(istAktiv(geschlossenAm('2026-09-26'), betrieb, KEINE, JETZT)).toBe(false)
  expect(istAktiv(geschlossenAm('2026-07-01'), betrieb, KEINE, JETZT)).toBe(false)
  // Dieselben Tickets acht Tage später: Die Aktivität ist verfallen.
  expect(istAktiv(geschlossenAm('2026-10-01'), betrieb, KEINE, JETZT + 4 * TAG)).toBe(true)
  expect(istAktiv(geschlossenAm('2026-10-01'), betrieb, KEINE, JETZT + 5 * TAG)).toBe(false)
  // Ein geschlossenes Ticket, dessen Tag das Ticket-System nicht nennt, zählt nicht.
  expect(istAktiv(geschlossenAm(undefined), betrieb, KEINE, JETZT)).toBe(false)
  // Auch ein Ticket eines erledigten Bündels zählt: Dort wurde gerade etwas fertig.
  expect(istAktiv(mitTicketsAn(plan, 'grundstock', [ticket('7', { zu: true, geschlossen: '2026-10-03' })]), { id: 'katalog' }, KEINE, JETZT)).toBe(true)

  // Offene Tickets allein zählen nicht, auch nicht mit einem Label, das sie aufhält; und ein
  // Tag an einem offenen Ticket (wieder geöffnet) auch nicht.
  expect(istAktiv(mitTicketsAn(plan, 'ladezeit', [ticket('31'), ticket('32', { grund: 'blockiert' })]), betrieb, KEINE, JETZT)).toBe(false)
  expect(istAktiv(mitTicketsAn(plan, 'ladezeit', [ticket('31', { zu: false, geschlossen: '2026-10-03' })]), betrieb, KEINE, JETZT)).toBe(false)
  // Die Tickets eines anderen Strangs wecken ihn nicht.
  expect(istAktiv(mitTicketsAn(plan, 'gutscheine', [ticket('14', { zu: true, geschlossen: '2026-10-03' })]), betrieb, KEINE, JETZT)).toBe(false)

  // Der Tag des Schließens, in ganzen Tagen gezählt.
  expect(istFrischGeschlossen('2026-10-04', JETZT)).toBe(true)
  expect(istFrischGeschlossen('2026-09-27', JETZT)).toBe(true)
  expect(istFrischGeschlossen('2026-09-26', JETZT)).toBe(false)
  for (const kaputt of [undefined, '', 'gestern', '2026-13-40', '04.10.2026', '2026-10-05', '2027-01-01']) {
    expect(istFrischGeschlossen(kaputt, JETZT)).toBe(false)
  }
})

// ---------- Wie ein Dauerläufer aussieht, der ruht ----------

test('der Graph: Ein Dauerläufer, der ruht, steht in einer Zeile dort, wo seine offenen Bündel standen', () => {
  const { plan } = gelungen(antwort())
  const offen = fasseErledigtes(graphDaten(plan, KEINE))
  const ruhig = fasseRuhendes(offen, new Set(['betrieb']))

  pruefeGraph(ruhig)
  // Ohne ruhende Bahn, und für eine Bahn ohne offene Bündel, bleibt alles, wie es ist.
  expect(fasseRuhendes(offen, new Set())).toBe(offen)
  expect(fasseRuhendes(offen, new Set(['gibt-es-nicht']))).toBe(offen)
  // Die zwei Bündel des Betriebs sind eine Zeile, an der Stelle des ersten; sonst ändert sich nichts.
  expect(offen.schritte.map(one => one.id)).toEqual([
    'erledigt-katalog', 'erledigt-kasse', 'katalog-texte', 'warenkorb', 'gutscheine', 'suchfelder', 'ladezeit', 'build-skripte',
    'rueckfragen', 'rechnungen', 'grundstock-steht', 'grosser-umbau', 'lasttest-bestanden', 'endziel',
  ])
  expect(ruhig.schritte.map(one => one.id)).toEqual([
    'erledigt-katalog', 'erledigt-kasse', 'katalog-texte', 'warenkorb', 'gutscheine', 'suchfelder', 'ruht-betrieb',
    'rueckfragen', 'rechnungen', 'grundstock-steht', 'grosser-umbau', 'lasttest-bestanden', 'endziel',
  ])
  expect(ruhig.schritte.find(one => one.id === 'ruht-betrieb')).toEqual({
    id: 'ruht-betrieb',
    art: 'ruht',
    bahn: 'betrieb',
    zone: 'jetzt',
    titel: 'Betrieb: ruht · 2 offen',
    meta: 'Ladezeit der Startseite senken · Umbau der Build-Skripte',
    // Aufgeklappt stehen die Titel seiner Bündel da, wie bei „… erledigt“.
    tickets: ['Ladezeit der Startseite senken', 'Umbau der Build-Skripte'],
  })
  // Die Bahn bleibt ein Dauerläufer: Sie endet weiter im Pfeil.
  expect(ruhig.bahnen).toEqual(offen.bahnen)
  // Die Übersicht sagt dasselbe an der Zeile der Bahn.
  expect(ruhig.uebersicht.find(one => one.bahn === 'betrieb')).toMatchObject({ art: 'ruht', titel: 'Betrieb · Dauerläufer', meta: 'ruht · 2 offen' })
  expect(offen.uebersicht.find(one => one.bahn === 'betrieb')).toMatchObject({ art: 'bereit', meta: '2 offen · 2 jetzt möglich' })

  // Die Zeile klappt auf, und was der Dauerläufer offen hat, zählt nicht als „jetzt möglich“.
  const zu = graphSicht(ruhig, wahl('schritte', []))
  const auf = graphSicht(ruhig, wahl('schritte', ['ruht-betrieb']))

  expect(zu.zaehler).toBe('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  expect(graphSicht(offen, wahl('schritte', [])).zaehler).toBe('6 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  expect(zu.aufklappbar.find(one => one.id === 'ruht-betrieb')).toEqual({ id: 'ruht-betrieb', titel: 'Betrieb: ruht · 2 offen', anzahl: 2, offen: false })
  expect(auf.eintraege.filter(one => one.typ === 'ticket').map(one => (one.typ === 'ticket' ? one.text : ''))).toEqual([
    'Ladezeit der Startseite senken',
    'Umbau der Build-Skripte',
  ])
  // Im Bild: blass, mit dem kleinen Punkt der Bahn, und die Bahn endet im Pfeil.
  const bild = zeichneSvg(ruhig, zu, 'hell')

  expect(bild.source).toContain('font-weight="500" fill="#5a6d76">Betrieb: ruht · 2 offen</text>')
  expect(bild.source).toContain(`<path d="M90.5 ${bild.hoehe - 17} L101.5 ${bild.hoehe - 17} L96 ${bild.hoehe - 6} Z" fill="#a3336b"/>`)
  expect(bild.hoehe).toBe(zeichneSvg(offen, graphSicht(offen, wahl('schritte', [])), 'hell').hoehe - 46)

  // Liegen seine Bündel in „Jetzt möglich“ und in „Später“, ist es trotzdem eine Zeile, in
  // „Jetzt möglich“; liegen alle in „Später“, steht sie dort. Wer auf eines der Bündel
  // wartete, zeigt auf keine Zeile mehr.
  const verteilt = gelungen(
    antwort({
      zeilen: ZEILEN.map(one =>
        one.id === 'build-skripte'
          ? { ...one, zone: 'spaeter', stand: 'blockiert', meta: 'wartet auf den Lasttest' }
          : one.id === 'rechnungen'
            ? { ...one, wartetAuf: 'ladezeit' }
            : one,
      ),
    }),
  ).plan
  const vorher = fasseErledigtes(graphDaten(verteilt, KEINE))
  const danach = fasseRuhendes(vorher, new Set(['betrieb']))

  pruefeGraph(danach)
  expect(vorher.schritte.find(one => one.id === 'rechnungen')?.wartetAuf).toBe('ladezeit')
  expect(danach.schritte.find(one => one.id === 'rechnungen')).not.toHaveProperty('wartetAuf')
  expect(danach.schritte.filter(one => one.bahn === 'betrieb').map(one => `${one.id}|${one.zone}|${one.titel}|${one.meta}`)).toEqual([
    'ruht-betrieb|jetzt|Betrieb: ruht · 2 offen|Ladezeit der Startseite senken · Umbau der Build-Skripte',
  ])

  const spaeter = gelungen(
    antwort({ zeilen: ZEILEN.map(one => (one.bahn === 'betrieb' ? { ...one, zone: 'spaeter', stand: 'blockiert', meta: 'wartet auf den Lasttest', wartetAuf: '' } : one)) }),
  ).plan
  const hinten = fasseRuhendes(fasseErledigtes(graphDaten(spaeter, KEINE)), new Set(['betrieb']))

  pruefeGraph(hinten)
  expect(hinten.schritte.filter(one => one.bahn === 'betrieb').map(one => `${one.id}|${one.zone}|${one.art}`)).toEqual(['ruht-betrieb|spaeter|ruht'])
  expect(graphSicht(hinten, wahl('schritte', [])).zaehler).toBe('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  // Was hinter uns liegt, bleibt die Zeile „… erledigt“; ohne offene Bündel gibt es nichts einzuklappen.
  const fertig = gelungen(antwort({ zeilen: ZEILEN.map(one => (one.bahn === 'betrieb' ? { ...one, zone: 'hinter', stand: 'erledigt', wartetAuf: '' } : one)) })).plan
  const erledigt = fasseErledigtes(graphDaten(fertig, KEINE))

  expect(fasseRuhendes(erledigt, new Set(['betrieb']))).toBe(erledigt)
  expect(erledigt.schritte.find(one => one.id === 'erledigt-betrieb')?.titel).toBe('Betrieb: 2 erledigt')
})

test('die Karten: Die Spalte eines Dauerläufers, der ruht, zeigt ihren Kopf und eine Karte statt der offenen Bündel', () => {
  const { plan } = gelungen(antwort())
  const ruhend = new Set(['betrieb'])
  const bild = sicht(plan, amWarenkorb('Ja?'), '', null, ruhend)
  const [, , , betrieb] = bild.spalten

  expect(betrieb?.karten).toEqual({
    hinter: [],
    jetzt: [
      {
        id: ruhtId('betrieb'),
        art: 'ruht',
        strang: 'betrieb',
        zone: 'jetzt',
        zeichen: 'blockiert',
        titel: 'ruht · 2 offen',
        meta: 'Ladezeit der Startseite senken · Umbau der Build-Skripte',
        chat: '',
        leise: true,
        gewaehlt: false,
      },
    ],
    spaeter: [],
  })
  // Der Kopf der Spalte und ihr Ende bleiben, und die anderen Spalten auch.
  expect(betrieb).toMatchObject({ kopf: ['kein Ziel festgelegt'], wohin: 'Dauerläufer: läuft weiter', ohneZiel: true })
  expect(bild.spalten.slice(0, 3)).toEqual(sicht(plan, amWarenkorb('Ja?'), '').spalten.slice(0, 3))
  // Was er offen hat, zählt nicht mit.
  expect(bild.zaehler).toBe('4 Bündel jetzt möglich · 1 Chat · 1 wartet auf dich')
  expect(sicht(plan, amWarenkorb('Ja?'), '').zaehler).toBe('6 Bündel jetzt möglich · 1 Chat · 1 wartet auf dich')
  // Eines seiner Bündel lässt sich nicht mehr wählen: Die Wahl fällt auf die Karte zurück, an der ein Chat wartet.
  expect(sicht(plan, amWarenkorb('Ja?'), 'ladezeit', null, ruhend).gewaehlt).toBe('warenkorb')
  expect(sicht(plan, amWarenkorb('Ja?'), 'ladezeit').gewaehlt).toBe('ladezeit')
  expect(sicht(plan, amWarenkorb('Ja?'), ruhtId('betrieb'), null, ruhend).gewaehlt).toBe(ruhtId('betrieb'))
  // Was hinter uns liegt, bleibt die Karte „n erledigt“; ohne offene Bündel gibt es keine Karte „ruht“.
  const fertig = gelungen(antwort({ zeilen: ZEILEN.map(one => (one.bahn === 'betrieb' ? { ...one, zone: 'hinter', stand: 'erledigt', wartetAuf: '' } : one)) })).plan

  expect(sicht(fertig, KEINE, '', null, ruhend).spalten[3]?.karten).toMatchObject({ hinter: [{ id: fertigId('betrieb'), titel: '2 erledigt' }], jetzt: [], spaeter: [] })
  // Liegen alle seine offenen Bündel in „Später“, steht die Karte dort.
  const spaeter = gelungen(
    antwort({ zeilen: ZEILEN.map(one => (one.bahn === 'betrieb' ? { ...one, zone: 'spaeter', stand: 'blockiert', meta: 'wartet auf den Lasttest', wartetAuf: '' } : one)) }),
  ).plan

  expect(sicht(spaeter, KEINE, '', null, ruhend).spalten[3]?.karten).toMatchObject({ jetzt: [], spaeter: [{ id: ruhtId('betrieb'), zone: 'spaeter' }] })

  // Die Fläche: eine Karte mit dem Zeichen für „hält an“, und darunter füllt die Linie die Spalte auf.
  const flaeche = baueFlaeche(bild, { zellen: 200, farben: 'hell' })
  const karte = flaeche.baender.flatMap(one => one.spalten.flat()).find(one => one.knopf === ruhtId('betrieb'))

  expect(karte?.bild.alt).toBe('· ruht · 2 offen (Ladezeit der Startseite senken · Umbau der Build-Skripte)')
  expect(karte?.bild.source).toContain('>ruht · 2 offen</text>')
  expect(flaeche.baender.map(one => one.spalten[3]?.map(zelle => zelle.knopf))).toEqual([[''], [ruhtId('betrieb'), ''], ['']])

  // Die Detail-Fläche nennt seine Bündel und bietet je jetzt möglichem einen Auftrag an.
  expect(detail(plan, KEINE, ruhtId('betrieb'))).toEqual({
    id: ruhtId('betrieb'),
    kopf: 'Dauerläufer · Strang Betrieb',
    titel: 'ruht · 2 offen',
    zeilen: [
      { art: 'leise', text: 'Ein Dauerläufer ruht, solange kein Chat an ihm arbeitet und in den letzten 7 Tagen keines seiner Tickets geschlossen wurde.' },
      { art: 'leise', text: 'Ziel des Strangs: kein Ziel festgelegt' },
      { art: 'punkt', text: 'Ladezeit der Startseite senken (Jetzt möglich)' },
      { art: 'punkt', text: 'Umbau der Build-Skripte (Jetzt möglich · 1 von 3 erledigt · Rest wartet auf den Lasttest)' },
    ],
    chats: [],
    knoepfe: [],
    auftraege: [
      { id: 'ladezeit', titel: 'Ladezeit der Startseite senken' },
      { id: 'build-skripte', titel: 'Umbau der Build-Skripte' },
    ],
  })
  // Was erst später möglich ist, steht dabei, aber ohne Auftrag.
  expect(detail(spaeter, KEINE, ruhtId('betrieb'))?.auftraege).toEqual([])
  expect(detail(plan, KEINE, ruhtId('gibt-es-nicht'))).toBe(null)
})

// ---------- In beiden Ansichten ----------

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: Ein Dauerläufer, an dem ein Chat arbeitet, steht offen da; wird der Chat fertig, ruht er; eine neue Antwort öffnet ihn von selbst`, async ($, on) => {
    const welt = baue(on, { modell: { isAnswered: true, text: antwort(AM_BETRIEB), usage: VERBRAUCH } })
    const { plan } = gelungen(antwort(AM_BETRIEB))

    legeShop(welt)
    await befehl($, 'graph')
    await befehl($, 'orchestrator')

    const graph = await $.ui.mount({ ...GRAPH, surface })
    const karten = await $.ui.mount({ ...BREIT, surface })
    const zeilen = async (): Promise<string[]> =>
      (await graph.findAll(surface === 'terminal' ? { type: 'Button' } : { type: 'Svg' }))
        .map(one => (surface === 'terminal' ? one.text : String(one.props.alt)))
        .filter(one => /Ladezeit|Build-Skripte|ruht/.test(one) && !one.startsWith('Ziel-Graph'))

    await leiteAb(graph, welt)

    // Der Chat hängt an einem Bündel des Betriebs: Der Dauerläufer ist aktiv, jedes Bündel steht für sich.
    const pfeil = surface === 'terminal' ? ' ▸' : ''

    expect(await zeilen()).toEqual(
      surface === 'terminal'
        ? ['◉ Ladezeit der Startseite senken [Chat · wartet auf dich] ▸', '◐ Umbau der Build-Skripte ▸']
        : ['Ladezeit der Startseite senken [Chat · wartet auf dich]', 'Umbau der Build-Skripte'],
    )
    expect(await mitBildern(graph)).toContain('6 Bündel jetzt möglich · 1 laufen · 1 warten auf dich')
    expect(await inhalt(karten)).toContain('6 Bündel jetzt möglich · 1 Chat · 1 wartet auf dich')
    expect(await inhalt(karten)).not.toContain('ruht')
    expect(await schluesselVon(karten, 'karte-')).toContain('karte-ladezeit')

    // Der Chat ist fertig: Nach spätestens 20 Sekunden ruht der Dauerläufer, in beiden Ansichten.
    legeChat(welt, 'sitzung-7', { name: 'Warenkorb-Regeln', stand: 'Die Ladezeit ist gesenkt.', fertig: true })
    await welt.uhr.advance(20_000)
    expect(await zeilen()).toEqual([`${surface === 'terminal' ? '· ' : ''}Betrieb: ruht · 2 offen${pfeil}`])
    expect(await mitBildern(graph)).toContain('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
    expect(await mitBildern(graph)).toContain('✓ Warenkorb-Regeln · fertig')
    expect(await inhalt(karten)).toContain('4 Bündel jetzt möglich · 0 Chats · keiner wartet auf dich')
    expect(await inhalt(karten)).toContain(
      surface === 'terminal'
        ? '  · Betrieb · ruht · 2 offen — Ladezeit der Startseite senken · Umbau der Build-Skripte'
        : '· ruht · 2 offen (Ladezeit der Startseite senken · Umbau der Build-Skripte)',
    )
    expect((await schluesselVon(karten, 'karte-')).filter(one => /ladezeit|build|ruht/.test(one))).toEqual([`karte-${ruhtId('betrieb')}`])

    // Die Zeile klappt auf wie „… erledigt“: Darunter stehen die Titel seiner Bündel.
    await graph.press({ key: 'auf-ruht-betrieb' })

    const offen = await mitBildern(graph)

    expect(offen).toContain(surface === 'terminal' ? '      Ladezeit der Startseite senken' : '>Ladezeit der Startseite senken</text>')
    expect(offen).toContain(surface === 'terminal' ? '      Umbau der Build-Skripte' : '>Umbau der Build-Skripte</text>')
    await graph.press({ key: 'auf-ruht-betrieb' })

    // Die Karte „ruht“ gewählt: Die Detail-Fläche nennt die Bündel und legt je einen Auftrag ins Eingabefeld.
    await karten.press({ key: `karte-${ruhtId('betrieb')}` })

    const gewaehlt = await inhalt(karten)

    expect(gewaehlt).toContain('Dauerläufer · Strang Betrieb')
    expect(gewaehlt).toContain('Ein Dauerläufer ruht, solange kein Chat an ihm arbeitet und in den letzten 7 Tagen keines seiner Tickets geschlossen wurde.')
    expect(gewaehlt).toContain('– Umbau der Build-Skripte (Jetzt möglich · 1 von 3 erledigt · Rest wartet auf den Lasttest)')
    expect(await schluesselVon(karten, 'auftrag')).toEqual(['auftrag-ladezeit', 'auftrag-build-skripte'])
    expect((await karten.findAll({ key: 'auftrag-ladezeit' }))[0]?.text).toBe('Auftrag: Ladezeit der Startseite senken')
    await karten.press({ key: 'auftrag-ladezeit' })
    expect(welt.gefuellt).toEqual([{ text: auftragFuer(plan, 'ladezeit'), mode: 'replace' }])
    expect(welt.toasts.at(-1)).toBe('Der Auftrag liegt im Eingabefeld. Prüfen und abschicken.')

    // Eine neue Antwort im Chat: Er läuft wieder, und der Dauerläufer öffnet sich von selbst.
    legeChat(welt, 'sitzung-7', { name: 'Warenkorb-Regeln', stand: 'Ein Bild ist noch zu groß.', fertig: false, zeit: JETZT + 60_000 })
    await welt.uhr.advance(20_000)
    expect(await zeilen()).toEqual(
      surface === 'terminal' ? ['◉ Ladezeit der Startseite senken [Chat] ▸', '◐ Umbau der Build-Skripte ▸'] : ['Ladezeit der Startseite senken [Chat]', 'Umbau der Build-Skripte'],
    )
    expect(await inhalt(karten)).not.toContain('ruht')
    expect(await schluesselVon(karten, 'karte-')).toContain('karte-build-skripte')
    // Das alles ohne einen neuen Modell-Aufruf.
    expect(welt.fragen).toHaveLength(1)

    await graph.unmount()
    await karten.unmount()
  })
}

test('GitHub: Ein Ticket, das in den letzten 7 Tagen geschlossen wurde, hält den Dauerläufer offen; offene Tickets allein tun es nicht', async ($, on) => {
  // Zwei Tickets im Betrieb: eines vor drei Tagen geschlossen, eines offen. Kein Chat läuft.
  const stand = {
    tickets: [
      ...TICKETS,
      { nr: 31, titel: 'Zertifikat erneuern', zu: '2026-10-01', labels: ['bereich:betrieb'] },
      { nr: 32, titel: 'Protokolle aufräumen', labels: ['bereich:betrieb'] },
    ] as readonly ShopTicket[],
  }
  const zeilen = ZEILEN_MIT_TICKETS.map(one => ({
    meta: '',
    punkte: [],
    wartetAuf: '',
    vermutet: false,
    ...one,
    ...(one.id === 'ladezeit' ? { tickets: ['#31', '#32'], quelle: 'tickets' } : {}),
  }))
  const welt = baue(on, {
    remote: GITHUB,
    werkzeug: mitTickets(() => stand.tickets, alsGithub),
    modell: { isAnswered: true, text: antwortMitTickets({ chats: [], zeilen }), usage: VERBRAUCH },
  })
  const datei = `${ordnerVon('github.com+beispiel+shop')}/plan/plan.json`
  const mit = (wie: Record<number, Partial<ShopTicket>>): ShopTicket[] => stand.tickets.map(one => ({ ...one, ...wie[one.nr] }))

  legeDoku(welt)
  welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL)
  await befehl($, 'orchestrator')

  const karten = await $.ui.mount({ ...BREIT, surface: 'terminal' })
  const graph = await $.ui.mount({ ...GRAPH, surface: 'terminal' })

  await leiteAb(karten, welt)

  // Aktiv: Seine Bündel stehen einzeln da, und sie zählen mit.
  expect(await inhalt(karten)).toContain('  ○ Betrieb · Ladezeit der Startseite senken — 1 von 2 erledigt')
  expect(await inhalt(karten)).toContain('  ◐ Betrieb · Umbau der Build-Skripte — 1 von 3 erledigt · Rest wartet auf den Lasttest')
  expect(await inhalt(karten)).not.toContain('ruht')
  expect(await mitBildern(graph)).not.toContain('ruht')
  expect(await mitBildern(graph)).toContain('6 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')
  // Die Plan-Datei merkt sich zu einem geschlossenen Ticket den Tag; ihre Version bleibt 3.
  const gemerkt = (gespeichert(welt, datei).umfeld as { tickets: { schluessel: string }[] }).tickets

  expect(gespeichert(welt, datei).version).toBe(3)
  expect(gemerkt.find(one => one.schluessel === '31')).toEqual({ schluessel: '31', titel: 'Zertifikat erneuern', zu: true, labels: ['bereich:betrieb'], zugewiesen: [], geschlossen: '2026-10-01' })
  expect(gemerkt.find(one => one.schluessel === '32')).toEqual({ schluessel: '32', titel: 'Protokolle aufräumen', zu: false, labels: ['bereich:betrieb'], zugewiesen: [] })

  // Das Ticket wurde vor neun Tagen geschlossen: Offene Tickets allein halten ihn nicht offen,
  // auch nicht mit einem neuen Label. „Neu laden“ genügt, kein Modell-Aufruf.
  stand.tickets = mit({ 31: { zu: '2026-09-25' }, 32: { labels: ['bereich:betrieb', 'dringend'] } })
  await karten.press({ key: 'laden' })
  expect(await inhalt(karten)).toContain('  · Betrieb · ruht · 2 offen — Ladezeit der Startseite senken · Umbau der Build-Skripte')
  expect(await mitBildern(graph)).toContain('· Betrieb: ruht · 2 offen ▸')
  expect(await mitBildern(graph)).toContain('4 Bündel jetzt möglich · 0 laufen · 0 warten auf dich')

  // Heute wird das zweite Ticket geschlossen: Der Dauerläufer ist wieder aktiv, sein Bündel erledigt.
  stand.tickets = mit({ 32: { zu: '2026-10-04' } })
  await karten.press({ key: 'laden' })
  expect(await inhalt(karten)).toContain('  ✓ Betrieb · 1 erledigt — Ladezeit der Startseite senken')
  expect(await inhalt(karten)).toContain('  ◐ Betrieb · Umbau der Build-Skripte — 1 von 3 erledigt · Rest wartet auf den Lasttest')
  expect(await inhalt(karten)).not.toContain('ruht')
  expect(await mitBildern(graph)).not.toContain('ruht')

  // Lässt sich das Ticket-System nicht fragen, gilt der Stand vom Ableiten mit dem Tag von
  // damals: vor drei Tagen geschlossen, also aktiv.
  welt.werkzeug = () => ({ fehler: 'gh: nicht angemeldet' })
  await karten.press({ key: 'laden' })
  expect(await inhalt(karten)).toContain('  ○ Betrieb · Ladezeit der Startseite senken — 1 von 2 erledigt')
  expect(await inhalt(karten)).not.toContain('ruht')
  expect(welt.fragen).toHaveLength(1)

  await karten.unmount()
  await graph.unmount()
})

// ---------- Vom Ziel zum Dauerläufer ----------

test('ein Ziel, in dem jedes Bündel erledigt ist, kann zum Dauerläufer werden', () => {
  const { plan } = gelungen(antwort())
  const fertig = (ids: readonly string[], goal: string | null = GOAL): ZielGraphPlan =>
    gelungen(antwort({ zeilen: ZEILEN.map(one => (ids.includes(one.id) ? { ...one, zone: 'hinter', stand: 'erledigt', wartetAuf: '', meta: '' } : one)) }), umfeld(goal)).plan

  // Im Shop hat jedes Ziel noch offene Bündel.
  expect(fertigeZiele(plan)).toEqual([])
  // Die Suche hat nur ein Bündel: Ist es erledigt, hat sie alles erledigt.
  expect(fertigeZiele(fertig(['suchfelder'])).map(one => one.id)).toEqual(['suche'])
  expect(fertigZeile({ name: 'Suche' })).toBe('Suche hat alles erledigt. Zum Dauerläufer machen?')
  // Ein Ziel mit einem offenen Bündel noch nicht; ein Dauerläufer nie, er ist schon einer.
  expect(fertigeZiele(fertig(['katalog-texte'])).map(one => one.id)).toEqual([])
  expect(fertigeZiele(fertig(['katalog-texte', 'rueckfragen', 'ladezeit', 'build-skripte'])).map(one => one.id)).toEqual(['katalog'])
  // Ein Strang ohne ein einziges Bündel hat noch nichts erledigt.
  expect(fertigeZiele(gelungen(antwort({ zeilen: ZEILEN.filter(one => one.bahn !== 'suche') })).plan)).toEqual([])
  // Sagt GOAL.md „Art: Dauerläufer“, ist die Frage beantwortet.
  expect(fertigeZiele(fertig(['suchfelder'], GOAL.replace('### Suche\n', '### Suche\nArt: Dauerläufer\n')))).toEqual([])
  // Und der Auftrag dazu nennt, was dort erledigt ist.
  expect(dauerAuftrag(fertig(['suchfelder']), 'suche').text).toContain('Setz unter „### Suche“ die Zeile „Art: Dauerläufer“.')
  expect(dauerAuftrag(fertig(['suchfelder']), 'suche').text).toContain('Was der Plan in diesem Strang als erledigt sieht:\n- Suchfelder und Sortierung')
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: Hat ein Ziel alles erledigt, fragen beide Ansichten in einer Zeile, und der Knopf legt den Auftrag ins Eingabefeld; GOAL.md schreibt der Chat`, async ($, on) => {
    const erledigt = { zeilen: ZEILEN.map(one => (one.id === 'suchfelder' ? { ...one, zone: 'hinter', stand: 'erledigt' } : one)) }
    const welt = baue(on, { modell: { isAnswered: true, text: antwort(erledigt), usage: VERBRAUCH } })
    const { plan } = gelungen(antwort(erledigt))

    legeShop(welt)
    await befehl($, 'graph')
    await befehl($, 'orchestrator')

    const graph = await $.ui.mount({ ...GRAPH, surface })
    const karten = await $.ui.mount({ ...BREIT, surface })

    await leiteAb(graph, welt)
    welt.toasts.length = 0

    // Eine Zeile je Ansicht, mit ihrem Knopf; die anderen Stränge haben noch Offenes.
    for (const ui of [graph, karten]) {
      expect(await inhalt(ui)).toContain('Suche hat alles erledigt. Zum Dauerläufer machen?')
      expect(await inhalt(ui)).not.toContain('Katalog hat alles erledigt')
      expect(await schluesselVon(ui, 'dauer-')).toEqual(['dauer-suche'])
      expect((await ui.findAll({ key: 'dauer-suche' }))[0]?.text).toBe('Zum Dauerläufer machen')
    }

    // Beide Knöpfe legen denselben Auftrag ins Eingabefeld. Geschrieben und abgeschickt wird nichts.
    await graph.press({ key: 'dauer-suche' })
    await karten.press({ key: 'dauer-suche' })
    expect(welt.gefuellt).toEqual([
      { text: dauerAuftrag(plan, 'suche').text, mode: 'replace' },
      { text: dauerAuftrag(plan, 'suche').text, mode: 'replace' },
    ])
    expect(welt.gefuellt[0]?.text).toContain('Setz unter „### Suche“ die Zeile „Art: Dauerläufer“.')
    expect(welt.toasts).toEqual([
      'Der Auftrag „Zum Dauerläufer machen“ liegt im Eingabefeld. Prüfen und abschicken.',
      'Der Auftrag „Zum Dauerläufer machen“ liegt im Eingabefeld. Prüfen und abschicken.',
    ])
    expect(welt.geschrieben.has(`${WURZEL}/GOAL.md`)).toBe(false)
    expect(welt.prompts).toHaveLength(0)

    // Der Chat hat die Zeile eingetragen: „Neu laden“ macht die Suche zum Dauerläufer, ohne
    // Modell-Aufruf. Die Frage ist weg.
    welt.dateien.set(`${WURZEL}/GOAL.md`, GOAL.replace('### Suche\n', '### Suche\nArt: Dauerläufer\n'))
    await karten.press({ key: 'laden' })

    for (const ui of [graph, karten]) {
      expect(await inhalt(ui)).not.toContain('hat alles erledigt')
      expect(await schluesselVon(ui, 'dauer-')).toEqual([])
    }

    expect(welt.fragen).toHaveLength(1)
    await graph.press({ key: 'ansicht-uebersicht' })
    expect(await mitBildern(graph)).toContain('Suche · Dauerläufer')
    expect(await inhalt(karten)).toContain(surface === 'terminal' ? 'Suche — Jedes Produkt in zwei Klicks finden' : 'Dauerläufer: läuft weiter')

    await graph.unmount()
    await karten.unmount()
  })
}

test('ohne GOAL.md fragt keine Ansicht nach dem Dauerläufer: Dort steht erst der Hinweis, sie anzulegen', async ($, on) => {
  const erledigt = { zeilen: ZEILEN.map(one => (one.id === 'suchfelder' ? { ...one, zone: 'hinter', stand: 'erledigt' } : one)) }
  const welt = baue(on, { modell: { isAnswered: true, text: antwort(erledigt), usage: VERBRAUCH } })

  legeShop(welt, null)

  const graph = await $.ui.mount({ ...GRAPH, surface: 'terminal' })
  const karten = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(graph, welt)

  for (const ui of [graph, karten]) {
    expect(await inhalt(ui)).toContain('GOAL.md fehlt')
    expect(await inhalt(ui)).not.toContain('hat alles erledigt')
    expect(await schluesselVon(ui, 'dauer-')).toEqual([])
  }

  await graph.unmount()
  await karten.unmount()
})

// ---------- Wer einen Strang macht ----------

const GOAL_MIT_PERSONEN = GOAL.replace('### Kasse\n', '### Kasse\nWer: Mara\n').replace('### Betrieb\n', '### Betrieb\nArt: Dauerläufer\nWer: Jonas\n')

test('wer einen Strang laut GOAL.md macht, steht im Graphen hinter seinem Namen in der Legende und auf den Karten im Kopf der Spalte', () => {
  const { plan } = gelungen(antwort(), umfeld(GOAL_MIT_PERSONEN))

  expect(plan.straenge.map(one => `${one.name}|${one.wer ?? '-'}`)).toEqual(['Katalog|-', 'Kasse|Mara', 'Suche|-', 'Betrieb|Jonas'])

  // Der Graph: Die Legende nennt die Person hinter dem Namen, die Zeilen der Bahn nicht.
  const daten = fasseErledigtes(graphDaten(plan, KEINE))
  const bild = zeichneSvg(daten, graphSicht(daten, wahl('schritte', [])), 'hell')
  const ohne = fasseErledigtes(graphDaten(gelungen(antwort()).plan, KEINE))

  pruefeGraph(daten)
  expect(daten.bahnen.map(one => `${one.name}|${one.wer ?? '-'}`)).toEqual(['Katalog|-', 'Kasse|Mara', 'Suche|-', 'Betrieb|Jonas'])
  expect(bild.source).toContain('font-size="13" font-weight="500" fill="#5a6d76">Katalog</text>')
  expect(bild.source).toContain('font-size="13" font-weight="500" fill="#5a6d76">Kasse · Mara</text>')
  expect(bild.source).toContain('font-size="13" font-weight="500" fill="#5a6d76">Betrieb · Jonas</text>')
  expect(bild.alt).toContain('Bahnen: Katalog, Kasse · Mara, Suche, Betrieb · Jonas.')
  expect(bild.source).toContain('>Kasse: 1 erledigt</text>')
  // Die längeren Namen rücken die Legende nur zurecht: Sie bleibt in einer Zeile, das Bild gleich hoch.
  expect(bild.hoehe).toBe(zeichneSvg(ohne, graphSicht(ohne, wahl('schritte', [])), 'hell').hoehe)
  expect(zeichneSvg(ohne, graphSicht(ohne, wahl('schritte', [])), 'hell').source).not.toContain(' · Mara')

  // Die Karten: Der Kopf der Spalte nennt die Person hinter dem Namen, leiser.
  const karten = sicht(plan, KEINE, '')

  expect(karten.spalten.map(one => one.wer)).toEqual(['', 'Mara', '', 'Jonas'])

  const flaeche = baueFlaeche(karten, { zellen: 200, farben: 'hell' })

  expect(flaeche.koepfe.map(one => one.name)).toEqual(['Katalog', 'Kasse · Mara', 'Suche', 'Betrieb · Jonas'])
  expect(flaeche.koepfe[1]?.bild.alt).toBe('Strang Kasse · Mara: kein Ziel festgelegt, vermutet: Bestellen ohne Umweg')
  expect(flaeche.koepfe[1]?.bild.source).toContain('font-weight="600" fill="#16242b">Kasse<tspan font-weight="400" fill="#5a6d76"> · Mara</tspan></text>')
  expect(flaeche.koepfe[0]?.bild.alt).toBe('Strang Katalog: Alle Produkte mit Text und Bild im Shop')
  expect(flaeche.koepfe[0]?.bild.source).toContain('font-weight="600" fill="#16242b">Katalog</text>')
  expect(flaeche.koepfe[0]?.bild.source).not.toContain('<tspan')

  // Reicht der Platz im Kopf nicht, wird die Person gekürzt und fällt zuletzt weg; der Name bleibt.
  const kopf = (name: string, wer: string): string => kopfBild(name, wer, ['Ziel'], false, { hell: '#0b7285', dunkel: '#5cc4d6' }, 184, 220, 'hell').source

  expect(kopf('Kasse', 'Mara')).toContain('>Kasse<tspan font-weight="400" fill="#5a6d76"> · Mara</tspan></text>')
  expect(kopf('Kasse', 'Maximiliane Beispiel')).toContain('>Kasse<tspan font-weight="400" fill="#5a6d76"> · Maximilia…</tspan></text>')
  expect(kopf('Katalogpflege 2026', 'Mara')).toContain('>Katalogpflege 2026</text>')
  expect(kopf('Katalogpflege 2026', 'Mara')).not.toContain('<tspan')
  // Zeichen, die ein SVG stören würden, stehen als Ersatzfolgen da.
  expect(kopf('Kasse', 'A & <B>')).toContain(' · A &amp; &lt;B&gt;</tspan>')

  // Der Strang der Kasse gehört Mara. Sind die Tickets eines Bündels jemand anderem
  // zugewiesen, gewinnt für dieses Bündel die Zuweisung: Es sagt „macht kassenwart“.
  const gemerkt = merke([...(ausGithub(alsGithub(TICKETS, false)) ?? []), ...(ausGithub(alsGithub(TICKETS, true)) ?? [])])
  const mitTicket = frische(
    gelungen(antwortMitTickets(), { ...umfeld(GOAL_MIT_PERSONEN), quellen: [...umfeld().quellen, 'tickets'], tickets: gemerkt }).plan,
    { liste: gemerkt, istVollstaendig: true },
    KEINE_NAMEN,
  )
  const kasse = sicht(mitTicket, KEINE, '').spalten[1]

  expect(kasse?.wer).toBe('Mara')
  expect(kasse?.karten.jetzt.map(one => `${one.id}|${one.meta}`)).toEqual(['warenkorb|', 'gutscheine|0 von 2 erledigt · macht kassenwart'])
})

test('wer einen Strang macht, steht auch in den Listen im Terminal, und GOAL.md geht mit der Zeile ans Modell', async ($, on) => {
  const welt = baue(on)

  legeShop(welt, GOAL_MIT_PERSONEN)

  const graph = await $.ui.mount({ ...GRAPH, surface: 'terminal' })
  const karten = await $.ui.mount({ ...BREIT, surface: 'terminal' })

  await leiteAb(graph, welt)
  expect(await inhalt(graph)).toContain('Wer es macht: Kasse · Mara, Betrieb · Jonas')
  expect(await inhalt(karten)).toContain('Kasse · Mara — kein Ziel festgelegt · vermutet: Bestellen ohne Umweg')
  expect(await inhalt(karten)).toContain('Betrieb · Jonas — kein Ziel festgelegt')
  expect(await inhalt(karten)).toContain('Katalog — Alle Produkte mit Text und Bild im Shop')
  // GOAL.md geht ans Modell wie bisher, mit der Zeile darin; einen eigenen Block gibt es nicht.
  expect(welt.fragen[0]?.prompt).toContain('### Kasse\nWer: Mara\nZiel:')
  expect(welt.fragen[0]?.prompt.split('Mara')).toHaveLength(2)
  expect(welt.fragen[0]?.prompt).toContain('- id "betrieb": Betrieb · kein Ziel festgelegt · Art: Dauerläufer')
  await graph.unmount()
  await karten.unmount()

  // Auf dem Bild der schmalen Ansicht steht die Person in der Legende.
  const bild = await $.ui.mount({ ...GRAPH, surface: 'desktop' })

  expect(String((await bild.findAll({ type: 'Svg' }))[0]?.props.source)).toContain('>Kasse · Mara</text>')
  expect(await inhalt(bild)).not.toContain('Wer es macht:')
  await bild.unmount()
})
