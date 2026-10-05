import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  SelectProps,
  SvgProps,
  TextProps,
} from 'claude-code'

import type { ZielGraphAnsicht, ZielGraphFarben } from '../types'

import type { Auftrag } from './plan/lesen'

// Was die zwei Leisten zum Zeichnen bekommen. Sie selbst fassen die Engine nie an:
// register.tsx reicht ihnen die Elemente der Surface und die Handgriffe ihrer Knöpfe.

// Die Elemente der Surface. Select und Svg gibt es nicht überall: null heißt Ersatz zeichnen.
export type Teile = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Select: ElementConstructor<SelectProps> | null
  Svg: ElementConstructor<SvgProps> | null
}

// Was ein Knopf auslöst. `validate` folgt `$` nicht über einen Import hinweg: Deshalb baut
// register.tsx diese Handgriffe aus `$`, und die Leisten rufen sie nur auf.
export type Taten = {
  // Beide Ansichten: den Plan neu ableiten, alles neu lesen, einen Auftrag ins Eingabefeld legen.
  ableiten: () => void
  laden: () => void
  lege: (auftrag: Auftrag) => void
  // Die schmale Ansicht: diesen Chat aufnehmen oder herausnehmen, die Ansicht wechseln, aufklappen.
  aufnehmen: () => void
  herausnehmen: () => void
  zeige: (ansicht: ZielGraphAnsicht) => void
  klappe: (id: string) => void
  klappeAlle: (ids: readonly string[]) => void
  // Die breite Ansicht: eine Karte wählen, die Farben festlegen.
  waehle: (id: string) => void
  faerbe: (farben: ZielGraphFarben) => void
}
