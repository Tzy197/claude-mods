import type {
  ZielGraphAenderung,
  ZielGraphAenderungen,
  ZielGraphBuendel,
  ZielGraphLage,
  ZielGraphPlan,
  ZielGraphSchritt,
} from '../../types'

import { istObjekt, kennung } from '../worte'

// Was ein Lauf geändert hat: der neue Plan gegen den davor, Bündel für Bündel und Schritt
// für Schritt nach der id. Was neu ist, was weg ist, was anders heißt und was in einer
// anderen Zone, einem anderen Stand oder einem anderen Strang steht. Kein `$`, kein Zustand.

const lageVon = (plan: ZielGraphPlan, eines: ZielGraphBuendel): ZielGraphLage => ({
  titel: eines.titel,
  strang: plan.straenge.find(one => one.id === eines.strang)?.name ?? eines.strang,
  zone: eines.zone,
  stand: eines.stand,
})

const lageAufStamm = (schritt: ZielGraphSchritt): ZielGraphLage => ({
  titel: schritt.titel,
  strang: '',
  zone: 'stamm',
  stand: schritt.erreicht ? 'erreicht' : 'offen',
})

// true: Zwischen den zwei Lagen hat sich etwas getan. Beim Strang zählt der Name, nicht die
// id: Derselbe Strang, den das Modell erst „kat“ nannte und der jetzt aus GOAL.md „katalog“
// heißt, ist kein anderer.
const istAnders = (vorher: ZielGraphLage, nachher: ZielGraphLage): boolean =>
  vorher.titel !== nachher.titel ||
  kennung(vorher.strang) !== kennung(nachher.strang) ||
  vorher.zone !== nachher.zone ||
  vorher.stand !== nachher.stand

type Benannt = readonly (readonly [string, ZielGraphLage])[]

// Die Einträge einer Art: was neu oder anders ist, in der Reihenfolge des neuen Plans, und
// getrennt davon, was weg ist.
const paare = (
  was: ZielGraphAenderung['was'],
  vorher: Benannt,
  neu: Benannt,
): { da: ZielGraphAenderung[]; weg: ZielGraphAenderung[] } => {
  const davor = new Map(vorher)
  const geblieben = new Set(neu.map(([id]) => id))

  return {
    da: neu.flatMap(([id, nachher]): ZielGraphAenderung[] => {
      const lage = davor.get(id) ?? null

      return lage === null || istAnders(lage, nachher) ? [{ was, id, vorher: lage, nachher }] : []
    }),
    weg: vorher
      .filter(([id]) => !geblieben.has(id))
      .map(([id, lage]): ZielGraphAenderung => ({ was, id, vorher: lage, nachher: null })),
  }
}

// Vergleicht den neuen Plan mit dem davor. Ein Bündel und ein Schritt des Stamms sind
// dieselben, wenn sie dieselbe id tragen; das Endziel zählt nach seinem Wortlaut.
export const vergleiche = (vorher: ZielGraphPlan, neu: ZielGraphPlan): ZielGraphAenderungen => {
  const buendel = paare(
    'buendel',
    vorher.buendel.map(one => [one.id, lageVon(vorher, one)] as const),
    neu.buendel.map(one => [one.id, lageVon(neu, one)] as const),
  )
  const stamm = paare(
    'schritt',
    vorher.stamm.map(one => [one.id, lageAufStamm(one)] as const),
    neu.stamm.map(one => [one.id, lageAufStamm(one)] as const),
  )

  return {
    eintraege: [...buendel.da, ...stamm.da, ...buendel.weg, ...stamm.weg],
    endziel:
      vorher.endziel.text === neu.endziel.text
        ? null
        : { vorher: vorher.endziel.text, nachher: neu.endziel.text },
  }
}

// ---------- Aus der Plan-Datei lesen ----------

const ZONEN: readonly ZielGraphLage['zone'][] = ['hinter', 'jetzt', 'spaeter', 'stamm']
const STAENDE: readonly ZielGraphLage['stand'][] = [
  'erledigt',
  'bereit',
  'teilweise',
  'blockiert',
  'erreicht',
  'offen',
]

const leseLage = (wert: unknown): ZielGraphLage | null => {
  if (!istObjekt(wert) || typeof wert.titel !== 'string' || typeof wert.strang !== 'string') {
    return null
  }

  const zone = ZONEN.find(one => one === wert.zone)
  const stand = STAENDE.find(one => one === wert.stand)

  return zone === undefined || stand === undefined ? null : { titel: wert.titel, strang: wert.strang, zone, stand }
}

// Die Änderungen aus einer gespeicherten Plan-Datei, so weit sie brauchbar sind. null: Dort
// stehen keine, wie nach dem ersten Lauf und in einer Datei der Version 1.
export const leseAenderungen = (wert: unknown): ZielGraphAenderungen | null => {
  if (!istObjekt(wert) || !Array.isArray(wert.eintraege)) {
    return null
  }

  const { endziel } = wert

  return {
    eintraege: wert.eintraege.flatMap((one: unknown): ZielGraphAenderung[] => {
      if (!istObjekt(one) || typeof one.id !== 'string' || (one.was !== 'buendel' && one.was !== 'schritt')) {
        return []
      }

      const vorher = leseLage(one.vorher)
      const nachher = leseLage(one.nachher)

      return vorher === null && nachher === null ? [] : [{ was: one.was, id: one.id, vorher, nachher }]
    }),
    endziel:
      istObjekt(endziel) && typeof endziel.vorher === 'string' && typeof endziel.nachher === 'string'
        ? { vorher: endziel.vorher, nachher: endziel.nachher }
        : null,
  }
}
