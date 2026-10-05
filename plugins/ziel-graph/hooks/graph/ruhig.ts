import { STAMM } from './daten'
import type { GraphDaten, GraphZeile } from './daten'

// „Ruhig“: Was hinter uns liegt, steht je Bahn in einer einzigen Zeile, damit der Blick
// bei „Jetzt möglich“ landet. Reine Umformung der Daten vor dem Zeichnen: Das Bild und
// die Liste im Terminal zeigen so dasselbe. Der Plan selbst behält jedes Bündel für sich.

const istErledigt = (zeile: GraphZeile): boolean => zeile.bahn !== STAMM && zeile.zone === 'hinter'

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

    // Die Kennung der Zeile darf keiner anderen Zeile gehören.
    let id = `erledigt-${bahn.id}`

    while (vergeben.has(id)) {
      id = `${id}-x`
    }

    vergeben.add(id)

    return [
      {
        id,
        art: 'erledigt',
        bahn: bahn.id,
        zone: 'hinter',
        titel: `${bahn.name}: ${titel.length} erledigt`,
        meta: titel.join(' · '),
        tickets: titel,
      },
    ]
  })

  return {
    ...daten,
    schritte: [
      ...zusammen,
      // Wer auf ein erledigtes Bündel zeigte, zeigt auf keine Zeile mehr.
      ...rest.map(one => {
        if (one.wartetAuf === undefined || vergeben.has(one.wartetAuf)) {
          return one
        }

        const { wartetAuf: _weg, ...ohne } = one

        return ohne
      }),
    ],
  }
}
