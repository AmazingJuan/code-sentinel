export type TerminalTone =
  | 'default'
  | 'dim'
  | 'green'
  | 'cyan'
  | 'prompt'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'bold'
  | 'rule'

export interface TerminalSegment {
  text: string
  tone?: TerminalTone
}

/** A plain string, or styled segments; an empty segment list renders a blank line. */
export type TerminalLine = string | TerminalSegment[]
