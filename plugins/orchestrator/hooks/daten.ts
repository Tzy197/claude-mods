// Feste Werte des Mods: Kennungen, die im Plan etwas bedeuten, und die Farben der Stränge.

// Die Kennung des Endziels als Karte. Kein Bündel und kein Stamm-Schritt darf so heißen.
export const ENDZIEL = 'endziel'

// Die Farben der Stränge, je eine für das helle und das dunkle Schema: dieselben wie im
// Ziel-Graphen. Das Modell wählt keine Farben, die Reihenfolge der Stränge tut es.
export const STRANG_FARBEN: readonly { hell: string; dunkel: string }[] = [
  { hell: '#0b7285', dunkel: '#5cc4d6' },
  { hell: '#2f9e44', dunkel: '#7fd992' },
  { hell: '#1c7ed6', dunkel: '#7fb8f5' },
  { hell: '#a3336b', dunkel: '#ee8fbd' },
  { hell: '#6b4fa0', dunkel: '#b9a3e6' },
  { hell: '#b3541e', dunkel: '#f0a070' },
  { hell: '#7a6a1f', dunkel: '#d6c66a' },
]

export const farbeVon = (stelle: number): { hell: string; dunkel: string } =>
  STRANG_FARBEN[stelle % STRANG_FARBEN.length] ?? { hell: '#5a6d76', dunkel: '#94a7b0' }
