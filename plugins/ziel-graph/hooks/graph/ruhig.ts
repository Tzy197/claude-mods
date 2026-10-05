import { STAMM } from './daten'
import type { GraphDaten, GraphZeile } from './daten'

// „Ruhig“: Was hinter uns liegt, steht je Bahn in einer einzigen Zeile, und ein Dauerläufer,
// der ruht, auch: damit der Blick bei dem landet, woran gerade gearbeitet wird. Reine
// Umformung der Daten vor dem Zeichnen: Das Bild und die Liste im Terminal zeigen so
// dasselbe. Der Plan selbst behält jedes Bündel für sich.

const istErledigt = (zeile: GraphZeile): boolean => zeile.bahn !== STAMM && zeile.zone === 'hinter'

const istOffen = (zeile: GraphZeile): boolean =>
  zeile.bahn !== STAMM && (zeile.zone === 'jetzt' || zeile.zone === 'spaeter')

// Eine Kennung für eine Sammel-Zeile, die keiner anderen Zeile gehört.
const freieId = (wunsch: string, vergeben: Set<string>): string => {
  let id = wunsch

  while (vergeben.has(id)) {
    id = `${id}-x`
  }

  vergeben.add(id)

  return id
}

// Wer auf ein Bündel zeigte, das in einer Sammel-Zeile aufgegangen ist, zeigt auf keine
// Zeile mehr.
const ohneLosenVerweis = (zeile: GraphZeile, vergeben: ReadonlySet<string>): GraphZeile => {
  if (zeile.wartetAuf === undefined || vergeben.has(zeile.wartetAuf)) {
    return zeile
  }

  const { wartetAuf: _weg, ...ohne } = zeile

  return ohne
}

// Ersetzt in der Ansicht Schritte die erledigten Bündel jeder Bahn durch eine Zeile
// „<Bahn>: <n> erledigt“. Sie nennt die Bündel in ihrer Beschreibung und, aufgeklappt, je
// Bündel in einer Unterzeile. Alles andere bleibt, wie es ist.
export const fasseErledigtes = (daten: GraphDaten): GraphDaten => {
  const erledigt = daten.schritte.filter(istErledigt)

  if (erledigt.length === 0) {
    return daten
  }

  const rest = daten.schritte.filter(one => !istErledigt(one))
  const vergeben = new Set(rest.map(one => one.id))
  const zusammen = daten.bahnen.flatMap((bahn): GraphZeile[] => {
    const titel = erledigt.filter(one => one.bahn === bahn.id).map(one => one.titel)

    if (titel.length === 0) {
      return []
    }

    return [
      {
        id: freieId(`erledigt-${bahn.id}`, vergeben),
        art: 'erledigt',
        bahn: bahn.id,
        zone: 'hinter',
        titel: `${bahn.name}: ${titel.length} erledigt`,
        meta: titel.join(' · '),
        tickets: titel,
      },
    ]
  })

  return { ...daten, schritte: [...zusammen, ...rest.map(one => ohneLosenVerweis(one, vergeben))] }
}

// Ersetzt die offenen Bündel jedes Dauerläufers, der ruht, durch eine Zeile „<Bahn>: ruht ·
// <n> offen“: die Bündel aus „Jetzt möglich“ und „Später“ zusammen. Sie steht dort, wo das
// erste dieser Bündel stand: in „Jetzt möglich“, wenn eines davon jetzt möglich ist, sonst in
// „Später“. Sie nennt die Bündel in ihrer Beschreibung und, aufgeklappt, je Bündel in einer
// Unterzeile. Was hinter uns liegt, bleibt, wie es ist. In der Übersicht sagt die Zeile der
// Bahn dasselbe. `ruhend`: die ids der Bahnen, die ruhen.
export const fasseRuhendes = (daten: GraphDaten, ruhend: ReadonlySet<string>): GraphDaten => {
  const ruht = (zeile: GraphZeile): boolean => istOffen(zeile) && ruhend.has(zeile.bahn)
  const eingeklappt = daten.schritte.filter(ruht)

  if (eingeklappt.length === 0) {
    return daten
  }

  const vergeben = new Set(daten.schritte.filter(one => !ruht(one)).map(one => one.id))
  // je Bahn das erste ihrer Bündel und die eine Zeile, die an seine Stelle tritt
  const zusammen = new Map<string, { erste: GraphZeile; zeile: GraphZeile; offen: number }>()

  for (const bahn of daten.bahnen) {
    const eigene = eingeklappt.filter(one => one.bahn === bahn.id)
    // Ist eines der Bündel jetzt möglich, steht die Zeile in „Jetzt möglich“, sonst in „Später“.
    const zone = eigene.some(one => one.zone === 'jetzt') ? 'jetzt' : 'spaeter'
    const erste = eigene.find(one => one.zone === zone)

    if (erste === undefined) {
      continue
    }

    const titel = eigene.map(one => one.titel)

    zusammen.set(bahn.id, {
      erste,
      offen: eigene.length,
      zeile: {
        id: freieId(`ruht-${bahn.id}`, vergeben),
        art: 'ruht',
        bahn: bahn.id,
        zone,
        titel: `${bahn.name}: ruht · ${eigene.length} offen`,
        meta: titel.join(' · '),
        tickets: titel,
      },
    })
  }

  return {
    ...daten,
    schritte: daten.schritte.flatMap((one): GraphZeile[] => {
      if (!ruht(one)) {
        return [ohneLosenVerweis(one, vergeben)]
      }

      const eine = zusammen.get(one.bahn)

      return eine !== undefined && eine.erste === one ? [eine.zeile] : []
    }),
    uebersicht: daten.uebersicht.map((one): GraphZeile => {
      const eine = one.bahn === STAMM ? undefined : zusammen.get(one.bahn)

      return eine === undefined ? one : { ...one, art: 'ruht', meta: `ruht · ${eine.offen} offen` }
    }),
  }
}
