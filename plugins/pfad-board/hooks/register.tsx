import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, Pfad } from '../types'

const PANE = 'pfad-board'
const TITEL = 'Pfad-Board'
const ZIEL_DATEI = '_ziel.json'
const KARTEN_LABEL = 'wayfinder:map'
const TAKT_MS = 20_000
const ZIEL_TAKT_MS = 15 * 60_000
const VERALTET_MS = 14 * 24 * 60 * 60_000
const HAUPTZWEIGE = ['', 'main', 'master', 'HEAD']
const NOCH_NICHTS = 'Noch kein Stand. Er kommt nach der nächsten Antwort.'

const LEER: Board = { ziel: '', pfade: [], gelesen: 0 }
const board = atom({ plugin: 'pfad-board', key: 'board' } as const, LEER)
const sitzung = atom({ plugin: 'pfad-board', key: 'sitzung' } as const, '')

// Ein Ordner je Repo, außerhalb der Arbeitskopie: alle Worktrees teilen ihn.
const ordner = async ($: EngineInterface): Promise<string> => {
  const heim =
    (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.'
  const repo = await $.session.repo()
  const wurzel = repo?.root ?? (await $.session.root())
  const name = wurzel.split(/[\\/]/).filter(Boolean).at(-1) ?? 'ohne-repo'

  return `${heim}/.claude/pfad-board/${name}`
}

const liesJson = async (
  $: EngineInterface,
  pfad: string,
): Promise<Record<string, unknown> | null> => {
  try {
    const wert: unknown = JSON.parse(await $.fs.read(pfad))

    return typeof wert === 'object' && wert !== null
      ? (wert as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const text = (wert: unknown): string => (typeof wert === 'string' ? wert : '')

const alsPfad = (roh: Record<string, unknown> | null): Pfad | null =>
  roh === null || text(roh.id) === ''
    ? null
    : {
        id: text(roh.id),
        name: text(roh.name),
        aktiv: roh.aktiv === true,
        branch: text(roh.branch),
        stand: text(roh.stand),
        naechster: text(roh.naechster),
        frage: text(roh.frage),
        zeit: typeof roh.zeit === 'number' ? roh.zeit : 0,
      }

const lies = async ($: EngineInterface): Promise<Board> => {
  const dir = await ordner($)
  const gelesen = await $.clock.now()

  if (!(await $.fs.exists(dir))) {
    return { ...LEER, gelesen }
  }

  const dateien = (await $.fs.list(dir)).filter(
    one => one.kind === 'file' && one.name.endsWith('.json'),
  )
  const pfade: Pfad[] = []
  let ziel = ''

  for (const datei of dateien) {
    const roh = await liesJson($, `${dir}/${datei.name}`)

    if (datei.name === ZIEL_DATEI) {
      ziel = text(roh?.ziel)
      continue
    }

    const pfad = alsPfad(roh)
    const istFrisch =
      pfad !== null && (pfad.zeit === 0 || gelesen - pfad.zeit < VERALTET_MS)

    if (pfad?.aktiv === true && istFrisch) {
      pfade.push(pfad)
    }
  }

  // Wer auf den Nutzer wartet, steht oben; darunter das Neueste zuerst.
  pfade.sort(
    (a, b) =>
      Number(b.frage !== '') - Number(a.frage !== '') || b.zeit - a.zeit,
  )

  return { ziel, pfade, gelesen }
}

// Die eigene Zeile, auch wenn sie abgemeldet ist: wer sich abgemeldet hat, bleibt draußen.
const liesEigene = async ($: EngineInterface): Promise<Pfad | null> =>
  alsPfad(await liesJson($, `${await ordner($)}/${await $.session.id()}.json`))

const schreibe = async ($: EngineInterface, pfad: Pfad): Promise<void> => {
  await $.fs.write(
    `${await ordner($)}/${pfad.id}.json`,
    JSON.stringify(pfad, null, 2),
  )
}

const laufe = async (
  $: EngineInterface,
  argv: readonly string[],
): Promise<string> => {
  try {
    const r = await $.process.run(argv, { timeoutMs: 15_000 })

    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

const zweig = ($: EngineInterface): Promise<string> =>
  laufe($, ['git', 'rev-parse', '--abbrev-ref', 'HEAD'])

const ticketTitel = async (
  $: EngineInterface,
  nummer: string,
): Promise<string> => {
  try {
    const roh: unknown = JSON.parse(
      await laufe($, ['glab', 'api', `projects/:id/issues/${nummer}`]),
    )

    return text((roh as Record<string, unknown>).title)
  } catch {
    return ''
  }
}

const aeltesteKarte = async ($: EngineInterface): Promise<string> => {
  try {
    const roh: unknown = JSON.parse(
      await laufe($, [
        'glab',
        'api',
        `projects/:id/issues?labels=${KARTEN_LABEL}&state=opened&order_by=created_at&sort=asc&per_page=1`,
      ]),
    )
    const erste: unknown = Array.isArray(roh) ? roh[0] : undefined
    const iid = (erste as Record<string, unknown> | undefined)?.iid

    return typeof iid === 'number' ? String(iid) : ''
  } catch {
    return ''
  }
}

// Das Ziel kommt aus der Wayfinder-Karte, solange niemand eins von Hand gesetzt hat.
const holeZiel = async ($: EngineInterface): Promise<void> => {
  try {
    const datei = `${await ordner($)}/${ZIEL_DATEI}`
    const alt = await liesJson($, datei)

    if (text(alt?.quelle) === 'hand') {
      return
    }

    const karte = text(alt?.karte) || (await aeltesteKarte($))

    if (karte === '') {
      return
    }

    const titel = (await ticketTitel($, karte)).replace(/^Wayfinder\s*·\s*/, '')
    const ziel = `#${karte} ${titel}`

    if (titel !== '' && ziel !== text(alt?.ziel)) {
      await $.fs.write(
        datei,
        JSON.stringify({ quelle: 'karte', karte, ziel }, null, 2),
      )
    }
  } catch (fehler) {
    $.ui.log(`Ziel nicht lesbar: ${String(fehler)}`)
  }
}

// Ticketnummer aus dem Branch: 2 bis 4 Ziffern ohne führende Null, auch als t218.
const ticketAus = (wert: string): string =>
  /(?<![a-z0-9])t?([1-9]\d{1,3})(?![a-z0-9])/i.exec(wert)?.[1] ?? ''

const ticketImPrompt = (wert: string): string =>
  /#([1-9]\d{1,3})\b/.exec(wert)?.[1] ?? ''

const ersterPrompt = async ($: EngineInterface): Promise<string> => {
  const nachrichten = await $.session.messages()

  return (
    nachrichten.find(one => one.role === 'user' && one.text.trim() !== '')
      ?.text ?? ''
  )
}

const alter = (jetzt: number, zeit: number): string => {
  const minuten = Math.round((jetzt - zeit) / 60_000)

  if (zeit === 0) {
    return 'noch nie'
  }

  if (minuten < 2) {
    return 'gerade eben'
  }

  if (minuten < 90) {
    return `vor ${minuten} Min`
  }

  if (minuten < 36 * 60) {
    return `vor ${Math.round(minuten / 60)} Std`
  }

  return `vor ${Math.round(minuten / 1440)} Tagen`
}

const AUFTRAG = `Du füllst eine Zeile in einem Übersichts-Board über parallele Arbeits-Chats.
Antworte NUR mit einem JSON-Objekt, ohne Markdown-Zaun und ohne Text davor oder danach:
{"name": "...", "stand": "...", "naechster": "...", "frage": "..."}

- name: nur wenn "Name des Pfads" leer ist, sonst leerer Text. Dann 2 bis 4 Worte, die sagen, woran dieser Chat arbeitet. Passt das genannte Ticket klar zum ersten Auftrag, beginne mit "#Nummer ".
- stand: ein kurzer Satz in einfachen Worten: was ist in diesem Chat jetzt erreicht.
- naechster: ein kurzer Satz: der nächste konkrete Schritt.
- frage: die Frage oder Freigabe, auf die der Chat gerade vom Nutzer wartet, als ein kurzer Satz. Leerer Text, wenn er auf nichts wartet.

Schreibe auf Deutsch mit Umlauten. Erfinde nichts: was nicht in den Angaben steht, lässt du weg. Ändert die letzte Antwort nichts am bisherigen Stand, übernimm ihn.`

const kurz = (wert: string, laenge: number): string =>
  wert.length > laenge ? `${wert.slice(0, laenge)}…` : wert

let letzterPrompt = ''
// Die Fragen, die dieses Fenster schon kennt: nur neue lösen einen Toast aus.
let bekannt: Map<string, string> | null = null

const lade = async ($: EngineInterface): Promise<void> => {
  try {
    const neu = await lies($)
    const ich = await read($, sitzung)
    const vorher = bekannt

    bekannt = new Map(neu.pfade.map(one => [one.id, one.frage]))

    if (vorher !== null) {
      for (const pfad of neu.pfade) {
        const istNeu = pfad.frage !== '' && vorher.get(pfad.id) !== pfad.frage

        if (istNeu && pfad.id !== ich) {
          $.ui.toast(`${pfad.name} wartet auf dich: ${kurz(pfad.frage, 90)}`, {
            timeoutMs: 8000,
          })
        }
      }
    }

    await update($, board, () => neu)
  } catch (fehler) {
    $.ui.log(`Board nicht lesbar: ${String(fehler)}`)
  }
}

const fasseZusammen = async (
  $: EngineInterface,
  antwort: string,
): Promise<void> => {
  try {
    const id = await $.session.id()
    const eigene = await liesEigene($)

    if (eigene !== null && !eigene.aktiv) {
      return
    }

    const branch = await zweig($)
    const auftrag = await ersterPrompt($)
    const ticket = ticketAus(branch) || ticketImPrompt(auftrag)
    // Von selbst kommt nur ins Board, wer an etwas Eigenem arbeitet: eigener Branch oder Ticket.
    const istPfad = !HAUPTZWEIGE.includes(branch) || ticket !== ''

    if (eigene === null && !istPfad) {
      return
    }

    const ich: Pfad = eigene ?? {
      id,
      name: '',
      aktiv: true,
      branch,
      stand: NOCH_NICHTS,
      naechster: '',
      frage: '',
      zeit: 0,
    }
    const brauchtNamen = ich.name === ''
    const angaben = [
      `Name des Pfads: ${ich.name}`,
      brauchtNamen ? `Branch: ${branch}` : '',
      brauchtNamen && ticket !== ''
        ? `Ticket #${ticket}: ${await ticketTitel($, ticket)}`
        : '',
      brauchtNamen ? `Erster Auftrag des Nutzers:\n${kurz(auftrag, 1500)}` : '',
      `Bisheriger Stand: ${ich.stand}`,
      `Bisheriger nächster Schritt: ${ich.naechster}`,
      `Letzte Nachricht des Nutzers:\n${kurz(letzterPrompt, 1500)}`,
      `Letzte Antwort des Chats:\n${kurz(antwort, 6000)}`,
    ]
      .filter(one => one !== '')
      .join('\n\n')
    const r = await $.model.complete({
      model: 'claude-sonnet-5-5',
      system: AUFTRAG,
      prompt: angaben,
      maxTokens: 400,
      timeoutMs: 30_000,
    })
    const zeit = await $.clock.now()
    let neu: Pfad = { ...ich, branch, zeit }

    if (r.isAnswered) {
      const von = r.text.indexOf('{')
      const bis = r.text.lastIndexOf('}')
      const roh: unknown = JSON.parse(r.text.slice(von, bis + 1))
      const felder = roh as Record<string, unknown>

      neu = {
        ...neu,
        name: ich.name || kurz(text(felder.name), 40),
        stand: text(felder.stand) || ich.stand,
        naechster: text(felder.naechster),
        frage: text(felder.frage),
      }
    } else {
      $.ui.log(`Zusammenfassung blieb aus (${r.reason}); Stand unverändert.`)
    }

    await schreibe($, { ...neu, name: neu.name || branch })
    await lade($)
  } catch (fehler) {
    $.ui.log(`Zusammenfassung fehlgeschlagen: ${String(fehler)}`)
  }
}

const frischeZiel = async ($: EngineInterface): Promise<void> => {
  await holeZiel($)
  await lade($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pfad',
      description: 'Diesen Chat im Board umbenennen, oder mit "aus" abmelden',
      argumentHint: '[Name | aus]',
    })
    await $.command.register({
      name: 'ziel',
      description:
        'Ziel des Boards: leer = aus der Karte, #Nummer = diese Karte, Text = von Hand',
      argumentHint: '[#Nummer | Text]',
    })
    await $.command.register({
      name: 'board',
      description: 'Das Pfad-Board öffnen',
    })

    const id = await $.session.id()
    await update($, sitzung, () => id)
    await lade($)
    $.clock.every(TAKT_MS, () => void lade($))
    $.clock.after(0, () => void frischeZiel($))
    $.clock.every(ZIEL_TAKT_MS, () => void frischeZiel($))

    const istAngemeldet = (await read($, board)).pfade.some(one => one.id === id)

    if (istAngemeldet) {
      void $.ui.open({ id: PANE, title: TITEL })
    }

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    letzterPrompt = e.text

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    const istEigeneAntwort =
      e.agentId === undefined && e.reason === 'answer' && e.answer !== ''

    if (istEigeneAntwort) {
      // Nach der Runde, nicht in ihr: die Zusammenfassung hält das Rundenende nicht auf.
      $.clock.after(0, () => void fasseZusammen($, e.answer))
    }

    return next(e)
  })

  on('command.run', { command: 'board' }, async $ => {
    await lade($)
    const offen = await $.ui.open({ id: PANE, title: TITEL })
    const flaechen = (await $.session.surfaces()).join(', ') || 'keine'

    // Sagt, ob die Leiste wirklich gezeichnet wird: auf einem verbundenen Gerät ohne Platz dafür wartet sie nur.
    return {
      text: offen.isPlaced
        ? `Pfad-Board geöffnet. (Oberflächen: ${flaechen})`
        : `Pfad-Board wartet und wird nicht gezeichnet: ${offen.reason} (Oberflächen: ${flaechen})`,
    }
  })

  on('command.run', { command: 'ziel' }, async ($, e) => {
    const eingabe = e.args.trim()
    const karte = /^#?(\d+)$/.exec(eingabe)?.[1] ?? ''
    const datei = `${await ordner($)}/${ZIEL_DATEI}`
    const inhalt =
      eingabe === ''
        ? { quelle: 'karte', karte: '', ziel: '' }
        : karte === ''
          ? { quelle: 'hand', karte: '', ziel: eingabe }
          : { quelle: 'karte', karte, ziel: '' }

    await $.fs.write(datei, JSON.stringify(inhalt, null, 2))
    await holeZiel($)
    await lade($)
    await $.ui.open({ id: PANE, title: TITEL })

    const ziel = (await read($, board)).ziel

    return {
      text: ziel === '' ? 'Keine Karte gefunden; Ziel ist leer.' : `Ziel: ${ziel}`,
    }
  })

  on('command.run', { command: 'pfad' }, async ($, e) => {
    const name = e.args.trim()
    const id = await $.session.id()
    const ich = await liesEigene($)

    if (name === '') {
      await lade($)
      await $.ui.open({ id: PANE, title: TITEL })

      return {
        text:
          ich?.aktiv === true
            ? `Dieser Chat ist der Pfad „${ich.name}“.`
            : 'Dieser Chat ist nicht im Board. Anmelden mit: /pfad <Name>',
      }
    }

    if (name.toLowerCase() === 'aus') {
      await schreibe($, {
        id,
        name: ich?.name ?? '',
        branch: ich?.branch ?? '',
        stand: ich?.stand ?? '',
        naechster: ich?.naechster ?? '',
        frage: ich?.frage ?? '',
        zeit: ich?.zeit ?? 0,
        aktiv: false,
      })
      await lade($)

      return { text: 'Dieser Chat ist vom Board abgemeldet und bleibt draußen.' }
    }

    await schreibe($, {
      id,
      name,
      aktiv: true,
      branch: ich?.branch ?? (await zweig($)),
      stand: ich?.stand || NOCH_NICHTS,
      naechster: ich?.naechster ?? '',
      frage: ich?.frage ?? '',
      zeit: ich?.zeit ?? 0,
    })
    await lade($)
    await $.ui.open({ id: PANE, title: TITEL })

    return { text: `Dieser Chat ist jetzt der Pfad „${name}“ im Board.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const stand = await read($, board)
    const ich = await read($, sitzung)
    const wartend = stand.pfade.filter(one => one.frage !== '').length

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {stand.ziel === '' ? 'Ziel: noch keins (/ziel)' : `Ziel: ${stand.ziel}`}
          </Text>
          <Text dimColor>
            {stand.pfade.length} Pfade, {wartend} warten auf dich
          </Text>
        </Box>

        {stand.pfade.length === 0 && (
          <Text dimColor wrap="wrap">
            Noch kein Pfad. Ein Chat mit eigenem Branch oder Ticket meldet sich nach
            seiner nächsten Antwort selbst an.
          </Text>
        )}

        {stand.pfade.map(pfad => (
          <Box flexDirection="column">
            <Text bold wrap="wrap">
              {pfad.frage === '' ? '○' : '●'} {pfad.name}
              {pfad.id === ich ? ' (dieser Chat)' : ''}
            </Text>
            <Text dimColor wrap="wrap">
              {alter(stand.gelesen, pfad.zeit)}
              {pfad.branch === '' ? '' : ` · ${pfad.branch}`}
            </Text>
            <Text wrap="wrap">{pfad.stand}</Text>
            {pfad.naechster !== '' && <Text wrap="wrap">Weiter: {pfad.naechster}</Text>}
            {pfad.frage !== '' && (
              <Text bold wrap="wrap">
                Wartet auf dich: {pfad.frage}
              </Text>
            )}
          </Box>
        ))}

        <Box>
          <Button key="laden" label="Neu laden" onPress={() => void frischeZiel($)} />
        </Box>
      </Box>
    )
  })
}
