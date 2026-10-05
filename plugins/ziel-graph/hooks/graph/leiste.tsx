import type { ElementConstructor, RenderElement, SvgProps } from 'claude-code'

import type {
  ZielGraphChats,
  ZielGraphGeladen,
  ZielGraphGraphSicht,
  ZielGraphLauf,
  ZielGraphPlan,
} from '../../types'

import { alter, nameVon, zaehler } from '../chats'
import { MODELL } from '../fest'
import { endzielAuftrag, faktenZeile, goalAuftrag, laufZeile, ohneZiel, strangAuftrag } from '../plan/lesen'
import type { Taten, Teile } from '../teile'
import { mehrzahl } from '../worte'

import type { GraphWahl } from './daten'
import { fasseErledigtes } from './ruhig'
import { schneide } from './streifen'
import type { Streifen } from './streifen'
import { ALLE, SVG_GRENZE, ZEICHEN, chatMarke, klappZeichen, sicht, zeichneSvg } from './zeichnen'
import type { Sicht } from './zeichnen'
import { graphDaten } from './zeilen'

// Die schmale Ansicht `/graph`: oben die laufenden Chats des Repos, darunter der Plan als
// Graph. Hier wird nur gezeichnet, ohne `$`: Den Zustand und die Handgriffe der Knöpfe
// reicht register.tsx.

// Das Bild ist 500 px breit. Eine Zelle der Code-Schrift ist in der App etwa 7,8 px
// breit: So viele Zellen sind das Bild und ein wenig Rand. `columns` ist ein Wunsch; eine
// Breite, die der Nutzer selbst gezogen hat, gewinnt.
export const SPALTEN = 66
// Der Aufklapp-Knopf liegt am rechten Ende der Zeile im Bild, so viele Zellen vom rechten
// Rand des Streifens: Dort hält das Bild in jeder Zeile einen Platz frei.
const KNOPF_RECHTS = 1
// Der Pfeil allein ist ein winziges Ziel für die Maus. Geschützte Leerzeichen davor und
// dahinter machen den Knopf etwa so breit wie der freie Platz, den das Bild rechts in jeder
// Zeile lässt. Ein Knopf über der ganzen Titelzeile wurde probiert und verworfen: Sein
// Schimmer unter der Maus sah in der App nicht gut aus.
const POLSTER = ' '.repeat(3)
const mitPolster = (zeichen: string): string => `${POLSTER}${zeichen}${POLSTER}`

// Was die Zeichnung braucht: der Zustand der Session.
export type GraphLage = {
  laufend: ZielGraphChats
  stand: ZielGraphGeladen
  jetzt: ZielGraphLauf
  wahl: ZielGraphGraphSicht
}

// Der obere Teil der Leiste, immer da: die echten Chats des Repos.
const zeichneChats = (teile: Teile, laufend: ZielGraphChats, taten: Taten): RenderElement => {
  const { Box, Text, Button } = teile
  const istDabei = laufend.chats.some(one => one.id === laufend.ich)

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold wrap="wrap">
        {zaehler(laufend.chats)}
      </Text>

      {laufend.chats.length === 0 && (
        <Text dimColor wrap="wrap">
          {'Ein Chat mit eigenem Branch oder Ticket meldet sich nach seiner nächsten Antwort ' +
            'selbst an. Jeden anderen nimmt der Knopf „Diesen Chat aufnehmen“ auf.'}
        </Text>
      )}

      {laufend.chats.map(chat => (
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {`${chat.frage === '' ? '○' : '●'} ${nameVon(chat)}`}
            {chat.id === laufend.ich ? ' (dieser Chat)' : ''}
          </Text>
          <Text dimColor wrap="wrap">
            {alter(laufend.gelesen, chat.zeit)}
            {chat.branch === '' ? '' : ` · ${chat.branch}`}
          </Text>
          <Text wrap="wrap">{chat.stand}</Text>
          {chat.naechster !== '' && <Text wrap="wrap">{`Weiter: ${chat.naechster}`}</Text>}
          {chat.frage !== '' && (
            <Text bold wrap="wrap">
              {`Wartet auf dich: ${chat.frage}`}
            </Text>
          )}
        </Box>
      ))}

      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button key="laden" label="Neu laden" onPress={taten.laden} />
        {istDabei ? (
          <Button key="heraus" label="Diesen Chat herausnehmen" onPress={taten.herausnehmen} />
        ) : (
          <Button key="auf" label="Diesen Chat aufnehmen" onPress={taten.aufnehmen} />
        )}
      </Box>
    </Box>
  )
}

// Wie GOAL.md dasteht, in ein oder zwei kurzen Zeilen über dem Graphen, jede mit dem Knopf,
// der den passenden Auftrag ins Eingabefeld legt: dieselben Aufträge wie in der breiten
// Ansicht. Schreiben tut GOAL.md nie der Mod.
const zeichneHinweise = (teile: Teile, stand: ZielGraphGeladen, taten: Taten): RenderElement | null => {
  const { Box, Text, Button } = teile
  const { goal, plan } = stand

  // Ohne GOAL.md fehlen Endziel und jedes Strang-Ziel zugleich: ein Hinweis statt vieler.
  if (!goal.vorhanden || goal.leer) {
    return (
      <Box flexDirection="column">
        <Text wrap="wrap">
          {goal.vorhanden
            ? 'GOAL.md ist noch leer: Bis sie etwas festlegt, ist alles über Ziele nur vermutet.'
            : 'GOAL.md fehlt: Ohne sie ist alles über Ziele nur vermutet.'}
        </Text>
        <Box>
          <Button
            key="goal-anlegen"
            label="GOAL.md mit dem Chat entwerfen"
            onPress={() => taten.lege(goalAuftrag())}
          />
        </Box>
      </Box>
    )
  }

  if (plan === null) {
    return null
  }

  const offene = ohneZiel(plan)
  const istEndzielOffen = plan.endziel.herkunft !== 'goal'

  if (!goal.geaendert && !istEndzielOffen && offene.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column">
      {goal.geaendert && (
        <Text dimColor wrap="wrap">
          GOAL.md hat sich seit dem Ableiten geändert: „Neu ableiten“ ordnet die Bündel neu zu.
        </Text>
      )}
      {istEndzielOffen && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
          <Text wrap="wrap">In GOAL.md steht noch kein Endziel.</Text>
          <Button
            key="endziel-festlegen"
            label="Endziel festlegen"
            onPress={() => taten.lege(endzielAuftrag(plan))}
          />
        </Box>
      )}
      {offene.length > 0 && (
        <Text wrap="wrap">{`Ohne Ziel in GOAL.md: ${offene.map(one => one.name).join(', ')}`}</Text>
      )}
      {offene.length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {offene.map(strang => (
            <Button
              key={`ziel-${strang.id}`}
              label={`Ziel festlegen: ${strang.name}`}
              onPress={() => taten.lege(strangAuftrag(plan, strang.id))}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

// Der Text-Ersatz für den Graphen: eine Liste, Zeile für Zeile. Bündel mit Unterzeilen
// sind hier selbst der Aufklapp-Knopf.
const zeichneListe = (teile: Teile, bild: Sicht, taten: Taten): RenderElement => {
  const { Box, Text, Button } = teile

  return (
    <Box flexDirection="column">
      {bild.eintraege.map(eintrag => {
        if (eintrag.typ === 'zone') {
          return (
            <Text bold wrap="truncate-end">
              {eintrag.titel.toUpperCase()}
            </Text>
          )
        }

        if (eintrag.typ === 'ticket') {
          return (
            <Text dimColor wrap="truncate-end">
              {`      ${eintrag.text}`}
            </Text>
          )
        }

        const { zeile } = eintrag
        const bahn = eintrag.bahn === null ? '' : `${eintrag.bahn.name} · `
        const kopf = `${ZEICHEN[zeile.art]} ${zeile.titel}${chatMarke(zeile)}`
        const istLeise = zeile.art === 'erledigt' || zeile.art === 'blockiert'

        return (
          <Box flexDirection="column">
            {eintrag.aufklappbar ? (
              <Button
                key={`auf-${zeile.id}`}
                plain
                label={`${kopf} ${klappZeichen(eintrag.offen)}`}
                onPress={() => taten.klappe(zeile.id)}
              />
            ) : (
              <Text bold={!istLeise} dimColor={istLeise} wrap="truncate-end">
                {kopf}
              </Text>
            )}
            {`${bahn}${zeile.meta}` !== '' && (
              <Text dimColor wrap="truncate-end">
                {`  ${bahn}${zeile.meta}`}
              </Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

// Der Graph als Stapel von Streifen, ohne Abstand: zusammen genau das eine Bild. Über dem
// Streifen eines Bündels mit Unterzeilen liegt sein Aufklapp-Knopf: am rechten Ende der
// Zeile, auf dem Platz, den das Bild dort frei lässt.
//
// Der Knopf hängt am rechten Rand des Streifens, nicht am linken: Wie breit eine Zelle
// ist, spielt so fast keine Rolle. Dafür muss die Box um Streifen und Knopf genau so breit
// sein wie der Streifen. Das ist sie als Kind einer Reihe: Dort ist eine Box so breit wie
// ihr Inhalt, und der Knopf steht `absolute`, braucht also keinen Platz. Die Reihe ist so
// auch genau so hoch wie ihr Streifen, und die Streifen bleiben aneinander.
const zeichneStreifen = (
  teile: { Box: Teile['Box']; Button: Teile['Button']; Svg: ElementConstructor<SvgProps> },
  streifen: readonly Streifen[],
  taten: Taten,
): RenderElement => {
  const { Box, Button, Svg } = teile

  return (
    <Box flexDirection="column">
      {streifen.map(one => {
        const { zeile } = one
        // Ohne feste Höhe: Ist die Leiste schmaler als das Bild, schrumpft der Streifen im
        // Ganzen, statt bei voller Höhe zusammengedrückt zu werden.
        const bild = <Svg source={one.source} alt={one.alt} width={one.breite} />

        if (zeile === null || !one.aufklappbar) {
          return bild
        }

        return (
          <Box flexDirection="row">
            <Box position="relative" alignItems="flex-start">
              {bild}
              <Box position="absolute" top={0} right={KNOPF_RECHTS}>
                <Button
                  key={`auf-${zeile}`}
                  plain
                  label={mitPolster(klappZeichen(one.offen))}
                  onPress={() => taten.klappe(zeile)}
                />
              </Box>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// Der Plan als Graph mit seinen Knöpfen: im Aussehen „Ruhig“, in Streifen, mit einem
// echten Pfeil-Knopf je Zeile. Wo es kein Bild gibt oder es zu groß wird, steht die Liste da.
const zeichneGraph = (teile: Teile, lage: GraphLage, plan: ZielGraphPlan, taten: Taten): RenderElement => {
  const { Box, Text, Button, Svg } = teile
  const { stand, laufend, wahl } = lage
  const einstellung: GraphWahl = {
    ansicht: wahl.ansicht,
    ziel: ALLE,
    bahnenAus: [],
    personenAus: [],
    offen: wahl.offen,
    farben: 'auto',
  }
  // „Ruhig“: Bild und Liste zeigen, was hinter uns liegt, je Bahn in einer Zeile. Der Plan
  // behält jedes Bündel für sich; so zeigt ihn auch die breite Ansicht.
  const daten = fasseErledigtes(graphDaten(plan, laufend))
  const bild = sicht(daten, einstellung)
  const streifen = Svg === null ? null : schneide(zeichneSvg(daten, bild, einstellung.farben), bild)
  // Jeder Streifen trägt das ganze Bild. Eines über der Grenze der Engine wird nicht
  // gezeichnet: Dann steht die Liste da.
  const passt = streifen !== null && streifen.every(one => one.source.length <= SVG_GRENZE)
  const ids = bild.aufklappbar.map(one => one.id)
  const sindAlleOffen = bild.aufklappbar.every(one => one.offen)

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold wrap="wrap">
          {daten.endziel}
        </Text>
        {stand.fakten !== null && (
          <Text dimColor wrap="wrap">
            {faktenZeile(stand.fakten, laufend.gelesen || stand.gelesen)}
          </Text>
        )}
        <Text dimColor wrap="wrap">
          {bild.zaehler}
        </Text>
      </Box>

      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button
          key="ansicht-schritte"
          label="Schritte"
          variant={wahl.ansicht === 'schritte' ? 'primary' : 'secondary'}
          onPress={() => taten.zeige('schritte')}
        />
        <Button
          key="ansicht-uebersicht"
          label="Übersicht"
          variant={wahl.ansicht === 'uebersicht' ? 'primary' : 'secondary'}
          onPress={() => taten.zeige('uebersicht')}
        />
        {ids.length > 0 && (
          <Button
            key="alles"
            label={sindAlleOffen ? 'Alles zuklappen' : 'Alles aufklappen'}
            onPress={() => taten.klappeAlle(ids)}
          />
        )}
      </Box>

      {Svg !== null && streifen !== null && passt
        ? zeichneStreifen({ Box, Button, Svg }, streifen, taten)
        : zeichneListe(teile, bild, taten)}

      {stand.warnungen.length > 0 && (
        <Text dimColor wrap="wrap">
          {`Beim Ableiten aufgefallen: ${mehrzahl(stand.warnungen.length, 'Hinweis', 'Hinweise')}. ` +
            'Sie stehen in der Ansicht /orchestrator.'}
        </Text>
      )}
    </Box>
  )
}

// Der untere Teil der Leiste: wo der Lauf steht, der Knopf zum Ableiten, wie GOAL.md
// dasteht und der Plan als Graph.
const zeichnePlan = (teile: Teile, lage: GraphLage, taten: Taten): RenderElement => {
  const { Box, Text, Button } = teile
  const { stand, jetzt } = lage
  const { plan } = stand
  const status = laufZeile(jetzt)

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        {status !== '' && (
          <Text bold wrap="wrap">
            {status}
          </Text>
        )}
        {jetzt.phase === 'laeuft' && (
          <Text dimColor wrap="wrap">
            {`Ein Modell-Aufruf mit ${MODELL} liest GOAL.md, Doku, Chats und Commits des Repos.`}
          </Text>
        )}
        {jetzt.phase === 'fehler' && plan !== null && (
          <Text dimColor wrap="wrap">
            Darunter steht weiter der vorige Plan.
          </Text>
        )}
        {jetzt.phase !== 'laeuft' && plan === null && (
          <Text dimColor wrap="wrap">
            Noch kein Plan für dieses Repo: „Neu ableiten“ leitet ihn aus GOAL.md, Doku, Chats und
            Commits ab.
          </Text>
        )}
        <Box>
          <Button
            key="neu"
            label="Neu ableiten"
            variant={plan === null ? 'primary' : 'secondary'}
            dimColor={jetzt.phase === 'laeuft'}
            onPress={taten.ableiten}
          />
        </Box>
      </Box>

      {zeichneHinweise(teile, stand, taten)}

      {plan !== null && zeichneGraph(teile, lage, plan, taten)}
    </Box>
  )
}

// Die ganze Leiste: oben die echten Chats, darunter der Plan.
export const zeichneGraphLeiste = (teile: Teile, lage: GraphLage, taten: Taten): RenderElement => {
  const { Box } = teile

  return (
    <Box flexDirection="column" gap={1}>
      {zeichneChats(teile, lage.laufend, taten)}
      {zeichnePlan(teile, lage, taten)}
    </Box>
  )
}
