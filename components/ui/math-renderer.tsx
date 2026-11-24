'use client'

import React, { useMemo } from 'react'
import katex from 'katex'

export const UNICODE_SUPERSCRIPTS_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  'ⁿ': 'n',
  'ⁱ': 'i',
}

/**
 * Standard mathematical command or function names
 */
const MATH_IDENTIFIERS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'lg', 'exp', 'det', 'lim',
  'gcd', 'deg', 'sqrt', 'cbrt', 'max', 'min',
  'mod', 'abs', 'pi', 'dx', 'dy', 'dt', 'dz',
  'theta', 'alpha', 'beta', 'gamma', 'delta', 'epsilon',
  'zeta', 'eta', 'iota', 'kappa', 'lambda', 'mu', 'nu',
  'xi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi',
  'psi', 'omega', 'frac', 'sum', 'prod', 'int',
  'text', 'mathrm', 'mathbf', 'mathit', 'mathbb', 'mathcal',
  'th', 'st', 'nd', 'rd',
])

/**
 * Detects whether a string or segment contains natural language prose words
 * (English or Arabic) rather than a pure standalone math formula.
 */
export function containsProseWords(str: string): boolean {
  if (!str) return false
  if (/[\u0600-\u06FF]/.test(str)) return true

  const words = str.match(/\b[A-Za-z]{2,}\b/g)
  if (!words) return false

  return words.some((w) => !MATH_IDENTIFIERS.has(w.toLowerCase()))
}

/**
 * Detects whether a math string contains bare natural language prose words
 * OUTSIDE intentional LaTeX text commands like \\text{...} or \\mathrm{...}.
 */
export function hasBareProseOutsideText(str: string): boolean {
  if (!str) return false
  let stripped = str
  for (let pass = 0; pass < 2; pass++) {
    stripped = stripped.replace(
      /\\(?:text|mathrm|mathbf|mathit|textbf|textit|textrm|operatorname)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g,
      ' '
    )
  }
  return containsProseWords(stripped)
}

/**
 * Normalizes unwrapped mathematical powers and unicode superscripts (e.g. x^2, x², 10⁻³, (x-2)^2)
 * so they are rendered as proper KaTeX math formulas rather than broken text.
 */
export function normalizeRawPowers(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''

  // 1. Convert Unicode superscripts after any operand e.g. x² -> x^2, (x-2)² -> (x-2)^2, 10⁻³ -> 10^{-3}
  let text = raw.replace(
    /([A-Za-z0-9\)\]\}])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+)/g,
    (_, base, supers) => {
      const converted = Array.from(supers as string)
        .map((ch) => UNICODE_SUPERSCRIPTS_MAP[ch] || ch)
        .join('')
      return converted.length > 1 || converted.startsWith('-') || converted.startsWith('+')
        ? `${base}^{${converted}}`
        : `${base}^${converted}`
    }
  )

  // 2. Fix spaces around carats e.g. "x ^ 2" -> "x^2", "(x - 1) ^ 3" -> "(x - 1)^3"
  text = text.replace(
    /([A-Za-z0-9\)\]\}])\s*\^\s*(\{?[A-Za-z0-9+\-_]+\}?)/g,
    '$1^$2'
  )

  // 3. If an entire string (e.g. an MCQ option like "X^2 - 4X + 4" or "x^2") is a math expression with powers
  // and has no $ delimiters, wrap the entire string in $...$ ONLY IF it is not natural language prose!
  const trimmed = text.trim()
  if (!trimmed.includes('$') && trimmed.includes('^')) {
    // If it contains NO prose words and is made of standard math tokens
    if (
      !containsProseWords(trimmed) &&
      /^[-+*/=()<>[\]|&%:;,?!'"`a-zA-Z0-9\s._^{}\\√±≤≥≠]+$/.test(trimmed)
    ) {
      return `$${trimmed}$`
    }
  }

  // 4. For mixed text (e.g. Arabic/English questions with unwrapped powers like "x^2 - 4" or "4^{th}"):
  // Split by existing math blocks ($$...$$, $...$, \(...\), \[...\])
  const mathBlockRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([\s\S]*?\\\))/g
  const parts = text.split(mathBlockRegex)

  for (let i = 0; i < parts.length; i += 2) {
    let segment = parts[i]
    if (!segment || !segment.includes('^')) continue

    // Wrap bare power expressions or equations with powers (supports 1-level nested braces e.g. 4^{\\text{th}}):
    // e.g. (X - 2)^2, x^2 - 4x + 4, x^2 = 25, 2^3, 10^{-3}, 4^{th}, 4^{\\text{th}}
    segment = segment.replace(
      /(?<![$\w\\/])((?:\([A-Za-z0-9+\-*/.\s]+\)|[A-Za-z0-9]+)\^(?:\{(?:[^{}]|\{[^{}]*\})+\}|-?[A-Za-z0-9]+)(?:\s*[-+*/=<>≤≥≠]\s*(?:(?:\([A-Za-z0-9+\-*/.\s]+\)|[A-Za-z0-9]+)(?:\^(?:\{(?:[^{}]|\{[^{}]*\})+\}|-?[A-Za-z0-9]+))?|[A-Za-z0-9]+(?:\.[0-9]+)?))*)(?![$\w^])/g,
      (match) => `$${match.trim()}$`
    )

    parts[i] = segment
  }

  return parts.join('')
}

/**
 * If a LaTeX math block ($...$, $$...$$, \(...\)) mistakenly wraps natural language prose
 * (Arabic or English sentences) without \text{}, unwrap the prose so it renders in standard
 * readable font (like normal questions), keeping only actual mathematical formulas wrapped in $...$.
 */
export function unwrapProseMath(text: string): string {
  if (!text || (!text.includes('$') && !text.includes('\\(') && !text.includes('\\['))) {
    return text
  }

  const mathBlockRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([\s\S]*?\\\))/g
  return text.replace(mathBlockRegex, (match) => {
    let content = match
    if (match.startsWith('$$') && match.endsWith('$$')) content = match.slice(2, -2)
    else if (match.startsWith('\\[') && match.endsWith('\\]')) content = match.slice(2, -2)
    else if (match.startsWith('$') && match.endsWith('$')) content = match.slice(1, -1)
    else if (match.startsWith('\\(') && match.endsWith('\\)')) content = match.slice(2, -2)

    // If it contains bare natural prose words outside \text{} / \mathrm{}, unwrap the prose and normalize embedded powers
    if (hasBareProseOutsideText(content)) {
      const unwrapped = content.replace(/\\ +/g, ' ').trim()
      return normalizeRawPowers(unwrapped)
    }

    return match
  })
}

/**
 * Strips Gemini / ChatGPT grounding citation span artifacts and fixes reversed negative numbers
 */
export function cleanGeminiArtifacts(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''

  let text = raw
    // Markdown style citation tags: [span_25](start_span) or [span_25](end_span)
    .replace(/\[span[_-]?\d+\]\((?:start|end)[_-]?span\)/gi, '')
    // Reversed citation tags: (start_span)[span_25] or (end_span)[span_25]
    .replace(/\((?:start|end)[_-]?span\)\[span[_-]?\d+\]/gi, '')
    // Standalone [span_25] or [span-25]
    .replace(/\[span[_-]?\d+\]/gi, '')
    // Standalone (start_span) or (end_span)
    .replace(/\((?:start|end)[_-]?span\)/gi, '')
    // Bare start_span or end_span
    .replace(/\b(?:start|end)_span\b/gi, '')
    // Citation / doc markers: [citation:1], [doc:1], etc.
    .replace(/\[(?:citation|doc|source)[_-]?\d+\]/gi, '')
    .trim()

  // If text was flipped in RTL e.g. "12-" or "48-", reverse it to "-12" or "-48"
  if (/^\s*(\d+(\.\d+)?)[-−]\s*$/.test(text)) {
    text = '-' + text.replace(/[-−]/, '').trim()
  }

  // 1. Unwrap any accidentally wrapped prose sentences so they use the standard clean UI font
  text = unwrapProseMath(text)

  // 2. Normalize raw powers and unicode superscripts to proper KaTeX math
  text = normalizeRawPowers(text)

  return text
}

export function cleanGeminiOption(opt: string): string {
  return cleanGeminiArtifacts(opt)
}

/**
 * Checks if the text is predominantly LTR, pure numbers/formulas, or English to prevent BiDi glitches
 */
export function isPureNumberOrLtr(text: string): boolean {
  if (!text) return false
  const trimmed = text.trim()
  // Matches numbers like -12, 48, 3.14, +5
  if (/^[-+]?\d+(\.\d+)?$/.test(trimmed)) return true
  // Matches math formulas, inequalities, or English expressions without Arabic characters
  if (
    /^[-+*/=()<>[\]|&%:;?!'"a-zA-Z0-9\s.,^_{}\\$√]+$/.test(trimmed) &&
    !/[\u0600-\u06FF]/.test(trimmed)
  ) {
    return true
  }
  return false
}

function extractBalancedGroup(
  str: string,
  openIndex: number,
  openChar: '(' | '{' | '[',
  closeChar: ')' | '}' | ']'
): { content: string; endIndex: number } | null {
  if (str[openIndex] !== openChar) return null
  let depth = 0
  for (let i = openIndex; i < str.length; i++) {
    const ch = str[i]
    if (i > openIndex && ch === '\\' && i + 1 < str.length) {
      i++
      continue
    }
    if (ch === openChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) {
        return {
          content: str.slice(openIndex + 1, i),
          endIndex: i + 1,
        }
      }
    }
  }
  return null
}

/**
 * Normalizes root expressions inside LaTeX strings so bare `sqrt(...)`, `sqrt{...}`, `\sqrt(...)`,
 * `cbrt(...)`, or Unicode `√(...)` render as proper KaTeX root signs.
 */
export function normalizeLatexMathContent(math: string): string {
  if (!math) return ''
  // Normalize unicode superscripts inside math mode (e.g. $x²$ -> $x^2$)
  let mathStr = math.replace(
    /([A-Za-z0-9\)\]\}])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+)/g,
    (_, base, supers) => {
      const converted = Array.from(supers as string)
        .map((ch) => UNICODE_SUPERSCRIPTS_MAP[ch] || ch)
        .join('')
      return converted.length > 1 || converted.startsWith('-') || converted.startsWith('+')
        ? `${base}^{${converted}}`
        : `${base}^${converted}`
    }
  )

  let out = ''
  let i = 0

  while (i < mathStr.length) {
    const slice = mathStr.slice(i)
    const cmdMatch = /^(?:(\\)?(sqrt|cbrt)\b|√)/i.exec(slice)

    if (cmdMatch) {
      const prevChar = i > 0 ? mathStr[i - 1] : ''
      // Avoid matching inside identifiers like `my_sqrt`
      if (/[A-Za-z_]/.test(prevChar)) {
        out += mathStr[i]
        i += 1
        continue
      }

      const fullMatch = cmdMatch[0]
      const isCbrt = (cmdMatch[2] || '').toLowerCase() === 'cbrt'
      let cursor = i + fullMatch.length
      let optionalIndex = ''

      // Skip spaces between command and optional [n]
      let tempCursor = cursor
      while (tempCursor < mathStr.length && /\s/.test(mathStr[tempCursor])) tempCursor++
      if (mathStr[tempCursor] === '[') {
        const bracketGroup = extractBalancedGroup(mathStr, tempCursor, '[', ']')
        if (bracketGroup) {
          optionalIndex = `[${normalizeLatexMathContent(bracketGroup.content)}]`
          cursor = bracketGroup.endIndex
        }
      } else if (isCbrt) {
        optionalIndex = '[3]'
      }

      // Skip spaces between command and argument
      let argStart = cursor
      while (argStart < mathStr.length && /\s/.test(mathStr[argStart])) argStart++

      if (mathStr[argStart] === '{') {
        const braceGroup = extractBalancedGroup(mathStr, argStart, '{', '}')
        if (braceGroup) {
          out += `\\sqrt${optionalIndex}{${normalizeLatexMathContent(braceGroup.content)}}`
          i = braceGroup.endIndex
          continue
        }
      } else if (mathStr[argStart] === '(') {
        const parenGroup = extractBalancedGroup(mathStr, argStart, '(', ')')
        if (parenGroup) {
          out += `\\sqrt${optionalIndex}{${normalizeLatexMathContent(parenGroup.content)}}`
          i = parenGroup.endIndex
          continue
        }
      } else {
        const tokenMatch =
          /^([A-Za-z0-9]+(?:\^(?:\{[^{}]+\}|-?[A-Za-z0-9]+)|_(?:\{[^{}]+\}|\d+))?)/.exec(
            mathStr.slice(argStart)
          )
        if (tokenMatch) {
          out += `\\sqrt${optionalIndex}{${tokenMatch[1]}}`
          i = argStart + tokenMatch[1].length
          continue
        }
      }

      // If no operand matched, preserve `\` prefix for valid LaTeX commands
      out += fullMatch === '√' ? '\\sqrt' : cmdMatch[1] ? fullMatch : `\\${cmdMatch[2]}`
      i += fullMatch.length
      continue
    }

    out += mathStr[i]
    i += 1
  }

  return out
}

/**
 * Extracts the lesson name/number from a question's lesson or topic field
 */
export function extractLessonFromTopic(topic?: string | null, explicitLesson?: string | null): string {
  if (explicitLesson && explicitLesson.trim()) {
    return explicitLesson.trim()
  }
  if (!topic || !topic.trim()) return ''

  const parts = topic.split('|').map((p) => p.trim())
  for (const part of parts) {
    if (part.startsWith('الدرس:')) {
      return part.replace(/^الدرس:\s*/, '').trim()
    }
    if (part.startsWith('الدرس ')) {
      return part.trim()
    }
    if (/^lesson\b/i.test(part)) {
      return part.trim()
    }
  }

  // If multiple parts e.g. "Group | Lesson Name"
  if (parts.length >= 2) {
    return parts[parts.length - 1]
  }

  return topic.trim()
}

/**
 * Formats group, unit, and lesson into a clean topic string for database persistence
 */
export function formatQuestionTopic(groupName?: string, unit?: string, lesson?: string): string {
  const parts: string[] = []
  if (groupName && groupName.trim()) parts.push(groupName.trim())
  if (unit && unit.trim()) parts.push(unit.trim())
  if (lesson && lesson.trim()) {
    const cleanLesson = lesson.trim()
    parts.push(cleanLesson.startsWith('الدرس') ? cleanLesson : `الدرس: ${cleanLesson}`)
  }
  return parts.join(' | ')
}

interface Segment {
  type: 'text' | 'math'
  isBlock?: boolean
  html?: string
  value?: string
}

interface MathRendererProps {
  text?: string | null
  className?: string
  as?: 'span' | 'p' | 'div'
  dir?: 'ltr' | 'rtl' | 'auto'
}

export function MathRenderer({
  text,
  className = '',
  as: Component = 'span',
  dir,
}: MathRendererProps) {
  const cleanedText = useMemo(() => cleanGeminiArtifacts(text || ''), [text])

  const segments: Segment[] = useMemo(() => {
    if (!cleanedText) return []

    // Matches:
    // $$...$$ (display math)
    // \[...\] (display math)
    // $...$ (inline math)
    // \(...\) (inline math)
    const mathRegex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([^\$\n]+?)\$|\\\(([\s\S]*?)\\\)/g

    let lastIndex = 0
    let match: RegExpExecArray | null
    const result: Segment[] = []

    const renderKatexSegment = (rawMath: string, isBlock: boolean): Segment => {
      // Safety net: If math block contains prose words without \text{}, render as standard text
      // to guarantee readable font with normal spacing (never cramped italic math font)
      if (hasBareProseOutsideText(rawMath)) {
        return {
          type: 'text',
          value: rawMath,
        }
      }

      const normalizedMath = normalizeLatexMathContent(rawMath.trim())
      try {
        const html = katex.renderToString(normalizedMath, {
          displayMode: isBlock,
          throwOnError: false,
          output: 'htmlAndMathml',
        })
        return {
          type: 'math',
          isBlock,
          html,
          value: normalizedMath,
        }
      } catch (err) {
        console.warn('[MathRenderer] KaTeX render error:', err)
        return {
          type: 'text',
          value: rawMath,
        }
      }
    }

    const BARE_LATEX_COMMANDS = new Set([
      'geq', 'ge', 'leq', 'le', 'neq', 'ne', 'implies', 'impliedby', 'iff',
      'Rightarrow', 'rightarrow', 'Leftarrow', 'leftarrow', 'leftrightarrow', 'Leftrightarrow',
      'approx', 'equiv', 'cong', 'sim', 'propto', 'pm', 'mp', 'times', 'div', 'cdot', 'ast', 'star',
      'infty', 'partial', 'nabla', 'forall', 'exists', 'nexists', 'in', 'notin', 'ni',
      'subset', 'subseteq', 'supset', 'supseteq', 'cup', 'cap', 'setminus', 'emptyset', 'varnothing',
      'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
      'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon',
      'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi',
      'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
      'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'lim', 'sup', 'inf',
      'max', 'min', 'det', 'gcd', 'deg', 'circ', 'degree', 'angle', 'measuredangle', 'triangle',
      'perp', 'parallel', 'because', 'therefore', 'dots', 'ldots', 'cdots', 'vdots', 'ddots',
      'sum', 'prod', 'int', 'oint', 'prime', 'to', 'mapsto', 'mid', 'nmid',
    ])

    const consumeOptionalSuperSub = (str: string, start: number): number => {
      let cursor = start
      while (cursor < str.length && (str[cursor] === '^' || str[cursor] === '_')) {
        const nextIdx = cursor + 1
        if (nextIdx >= str.length) break
        if (str[nextIdx] === '{') {
          const grp = extractBalancedGroup(str, nextIdx, '{', '}')
          if (grp) {
            cursor = grp.endIndex
            continue
          }
          break
        }
        const token = /^(?:\\[a-zA-Z]+|-?[A-Za-z0-9]+)/.exec(str.slice(nextIdx))
        if (token) {
          cursor = nextIdx + token[0].length
          continue
        }
        break
      }
      return cursor
    }

    const consumeDelimiterAfterLeftRight = (str: string, pos: number): number => {
      let c = pos
      while (c < str.length && /\s/.test(str[c])) c++
      if (c >= str.length) return pos
      if (str[c] === '\\') {
        const cmd = /^\\([a-zA-Z]+|.)/.exec(str.slice(c))
        if (cmd) return c + cmd[0].length
      }
      return c + 1
    }

    const findNextBareRootMatch = (
      plainText: string,
      fromIndex: number
    ): { start: number; end: number; expr: string } | null => {
      const rootSearchRegex = /(?:\\?(?:sqrt|cbrt)\b|√)/gi
      rootSearchRegex.lastIndex = fromIndex

      let m: RegExpExecArray | null
      while ((m = rootSearchRegex.exec(plainText)) !== null) {
        const idx = m.index
        const prevChar = idx > 0 ? plainText[idx - 1] : ''
        if (/[A-Za-z_]/.test(prevChar)) continue

        let cursor = idx + m[0].length
        let tempCursor = cursor
        while (tempCursor < plainText.length && /\s/.test(plainText[tempCursor])) tempCursor++

        if (plainText[tempCursor] === '[') {
          const bracket = extractBalancedGroup(plainText, tempCursor, '[', ']')
          if (bracket) {
            cursor = bracket.endIndex
          }
        }

        let argStart = cursor
        while (argStart < plainText.length && /\s/.test(plainText[argStart])) argStart++

        if (plainText[argStart] === '(') {
          const paren = extractBalancedGroup(plainText, argStart, '(', ')')
          if (paren) {
            const end = consumeOptionalSuperSub(plainText, paren.endIndex)
            return { start: idx, end, expr: plainText.slice(idx, end) }
          }
        } else if (plainText[argStart] === '{') {
          const brace = extractBalancedGroup(plainText, argStart, '{', '}')
          if (brace) {
            const end = consumeOptionalSuperSub(plainText, brace.endIndex)
            return { start: idx, end, expr: plainText.slice(idx, end) }
          }
        } else {
          // Only treat `sqrt x` / `sqrt 16` / `√16` without parens as math if operand is a number, single letter, or power
          const tokenMatch =
            /^(\d+(?:\.\d+)?(?:\^(?:\{[^{}]+\}|-?[A-Za-z0-9]+))?|[A-Za-z](?![A-Za-z])(?:\^(?:\{[^{}]+\}|-?[A-Za-z0-9]+)|_(?:\{[^{}]+\}|\d+))?)/.exec(
              plainText.slice(argStart)
            )
          if (tokenMatch) {
            const end = argStart + tokenMatch[1].length
            return { start: idx, end, expr: plainText.slice(idx, end) }
          }
        }
      }

      return null
    }

    const findNextBareLatexMatch = (
      plainText: string,
      fromIndex: number
    ): { start: number; end: number; expr: string; isBlock?: boolean } | null => {
      const cmdRegex = /\\([a-zA-Z]+)/g
      cmdRegex.lastIndex = fromIndex

      let m: RegExpExecArray | null
      while ((m = cmdRegex.exec(plainText)) !== null) {
        const idx = m.index
        const cmdName = m[1]
        const lowerCmd = cmdName.toLowerCase()

        // Roots are handled uniformly by findNextBareRootMatch
        if (lowerCmd === 'sqrt' || lowerCmd === 'cbrt') continue

        // 1. \begin{env}...\end{env}
        if (cmdName === 'begin') {
          const envGroup = extractBalancedGroup(plainText, idx + 6, '{', '}')
          if (envGroup) {
            const envName = envGroup.content.trim()
            const endTag = `\\end{${envName}}`
            const endIdx = plainText.indexOf(endTag, envGroup.endIndex)
            if (endIdx !== -1) {
              const end = endIdx + endTag.length
              return {
                start: idx,
                end,
                expr: plainText.slice(idx, end),
                isBlock: true,
              }
            }
          }
        }

        // 2. \left ... \right (supporting nested \left / \right and trailing ^ or _)
        if (cmdName === 'left') {
          let depth = 1
          let scan = consumeDelimiterAfterLeftRight(plainText, idx + 5)
          while (scan < plainText.length && depth > 0) {
            if (plainText.slice(scan).startsWith('\\left') && !/[a-zA-Z]/.test(plainText[scan + 5] || '')) {
              depth++
              scan = consumeDelimiterAfterLeftRight(plainText, scan + 5)
              continue
            }
            if (plainText.slice(scan).startsWith('\\right') && !/[a-zA-Z]/.test(plainText[scan + 6] || '')) {
              depth--
              scan = consumeDelimiterAfterLeftRight(plainText, scan + 6)
              if (depth === 0) {
                const end = consumeOptionalSuperSub(plainText, scan)
                return { start: idx, end, expr: plainText.slice(idx, end) }
              }
              continue
            }
            scan++
          }
        }

        // 3. Any \command with optional scripts and/or [...] / {...} arguments, or known standalone math symbol
        let cursor = idx + 1 + cmdName.length
        const afterCmd = cursor
        cursor = consumeOptionalSuperSub(plainText, cursor)
        let hasBalancedArg = false

        while (cursor < plainText.length) {
          let lookahead = cursor
          while (lookahead < plainText.length && /\s/.test(plainText[lookahead])) lookahead++
          if (plainText[lookahead] === '{') {
            const grp = extractBalancedGroup(plainText, lookahead, '{', '}')
            if (grp) {
              hasBalancedArg = true
              cursor = grp.endIndex
              continue
            }
          } else if (plainText[lookahead] === '[' && hasBalancedArg) {
            const grp = extractBalancedGroup(plainText, lookahead, '[', ']')
            if (grp) {
              cursor = grp.endIndex
              continue
            }
          } else if (plainText[lookahead] === '[' && (cmdName === 'frac' || cmdName === 'binom' || cmdName === 'text')) {
            const grp = extractBalancedGroup(plainText, lookahead, '[', ']')
            if (grp) {
              hasBalancedArg = true
              cursor = grp.endIndex
              continue
            }
          }
          break
        }

        cursor = consumeOptionalSuperSub(plainText, cursor)
        const hasScripts = cursor > afterCmd

        if (hasBalancedArg || hasScripts || BARE_LATEX_COMMANDS.has(cmdName)) {
          return {
            start: idx,
            end: cursor,
            expr: plainText.slice(idx, cursor),
          }
        }
      }

      return null
    }

    const renderBareMathSegments = (plainText: string): Segment[] => {
      if (!plainText) return []
      // Matches unwrapped expressions like X^2, x^{2n}, (x - 2)^2, 10^{-3}, 180^\circ, x², or x_1 / a_{n}
      const barePowerOrSubRegex =
        /(?:\([A-Za-z0-9+\-*/.\s]+\)|[A-Za-z0-9]+)(?:\s*\^\s*(?:\{(?:[^{}]|\{[^{}]*\})+\}|\\[A-Za-z]+|-?[A-Za-z0-9]+)|[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+)+|\b[A-Za-z]_(?:\{(?:[^{}]|\{[^{}]*\})+\}|\d+)\b/g

      let cursor = 0
      const out: Segment[] = []

      while (cursor < plainText.length) {
        const rootMatch = findNextBareRootMatch(plainText, cursor)
        const latexMatch = findNextBareLatexMatch(plainText, cursor)
        barePowerOrSubRegex.lastIndex = cursor
        const powerMatch = barePowerOrSubRegex.exec(plainText)

        const candidates: Array<{ start: number; end: number; expr: string; isBlock?: boolean }> = []
        if (rootMatch) candidates.push(rootMatch)
        if (latexMatch) candidates.push(latexMatch)
        if (powerMatch) {
          candidates.push({
            start: powerMatch.index,
            end: powerMatch.index + powerMatch[0].length,
            expr: powerMatch[0],
          })
        }

        if (candidates.length === 0) break

        // Pick earliest match; on tie prefer the longer match
        candidates.sort((a, b) => (a.start !== b.start ? a.start - b.start : b.end - a.end))
        const nextMatch = candidates[0]

        if (nextMatch.start > cursor) {
          out.push({
            type: 'text',
            value: plainText.slice(cursor, nextMatch.start),
          })
        }

        out.push(renderKatexSegment(nextMatch.expr, Boolean(nextMatch.isBlock)))
        cursor = nextMatch.end
      }

      if (cursor < plainText.length) {
        out.push({
          type: 'text',
          value: plainText.slice(cursor),
        })
      }

      return out
    }

    while ((match = mathRegex.exec(cleanedText)) !== null) {
      if (match.index > lastIndex) {
        result.push(...renderBareMathSegments(cleanedText.slice(lastIndex, match.index)))
      }

      const isBlock = Boolean(match[1] !== undefined || match[2] !== undefined)
      const mathContent = match[1] || match[2] || match[3] || match[4] || ''

      result.push(renderKatexSegment(mathContent, isBlock))

      lastIndex = mathRegex.lastIndex
    }

    if (lastIndex < cleanedText.length) {
      result.push(...renderBareMathSegments(cleanedText.slice(lastIndex)))
    }

    return result
  }, [cleanedText])

  if (!cleanedText) return null

  // Determine directionality
  const effectiveDir = dir || (isPureNumberOrLtr(cleanedText) ? 'ltr' : 'auto')

  return (
    <Component
      dir={effectiveDir}
      className={`math-rendered-content max-w-full ${effectiveDir === 'ltr' ? 'text-left' : ''} ${className}`}
      style={{ unicodeBidi: 'isolate' }}
    >
      {segments.map((seg, idx) => {
        if (seg.type === 'math' && seg.html) {
          return (
            <span
              key={idx}
              className={`inline-math-item max-w-full ${seg.isBlock ? 'my-2 block text-center' : 'inline-block mx-0.5 align-baseline'}`}
              dangerouslySetInnerHTML={{ __html: seg.html }}
              dir="ltr"
            />
          )
        }
        return <React.Fragment key={idx}>{seg.value}</React.Fragment>
      })}
    </Component>
  )
}
