'use client'

import React, { useMemo } from 'react'
import katex from 'katex'

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
  // Matches math formulas or expressions
  if (/^[-+*/=()a-zA-Z0-9\s.,^_{}\\$√]+$/.test(trimmed) && !/[\u0600-\u06FF]/.test(trimmed)) {
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
  let out = ''
  let i = 0

  while (i < math.length) {
    const slice = math.slice(i)
    const cmdMatch = /^(?:(\\)?(sqrt|cbrt)\b|√)/i.exec(slice)

    if (cmdMatch) {
      const prevChar = i > 0 ? math[i - 1] : ''
      // Avoid matching inside identifiers like `my_sqrt`
      if (/[A-Za-z_]/.test(prevChar)) {
        out += math[i]
        i += 1
        continue
      }

      const fullMatch = cmdMatch[0]
      const isCbrt = (cmdMatch[2] || '').toLowerCase() === 'cbrt'
      let cursor = i + fullMatch.length
      let optionalIndex = ''

      // Skip spaces between command and optional [n]
      let tempCursor = cursor
      while (tempCursor < math.length && /\s/.test(math[tempCursor])) tempCursor++
      if (math[tempCursor] === '[') {
        const bracketGroup = extractBalancedGroup(math, tempCursor, '[', ']')
        if (bracketGroup) {
          optionalIndex = `[${normalizeLatexMathContent(bracketGroup.content)}]`
          cursor = bracketGroup.endIndex
        }
      } else if (isCbrt) {
        optionalIndex = '[3]'
      }

      // Skip spaces between command and argument
      let argStart = cursor
      while (argStart < math.length && /\s/.test(math[argStart])) argStart++

      if (math[argStart] === '{') {
        const braceGroup = extractBalancedGroup(math, argStart, '{', '}')
        if (braceGroup) {
          out += `\\sqrt${optionalIndex}{${normalizeLatexMathContent(braceGroup.content)}}`
          i = braceGroup.endIndex
          continue
        }
      } else if (math[argStart] === '(') {
        const parenGroup = extractBalancedGroup(math, argStart, '(', ')')
        if (parenGroup) {
          out += `\\sqrt${optionalIndex}{${normalizeLatexMathContent(parenGroup.content)}}`
          i = parenGroup.endIndex
          continue
        }
      } else {
        const tokenMatch =
          /^([A-Za-z0-9]+(?:\^(?:\{[^{}]+\}|-?[A-Za-z0-9]+)|_(?:\{[^{}]+\}|\d+))?)/.exec(
            math.slice(argStart)
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

    out += math[i]
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
            return { start: idx, end: paren.endIndex, expr: plainText.slice(idx, paren.endIndex) }
          }
        } else if (plainText[argStart] === '{') {
          const brace = extractBalancedGroup(plainText, argStart, '{', '}')
          if (brace) {
            return { start: idx, end: brace.endIndex, expr: plainText.slice(idx, brace.endIndex) }
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

    const renderBareMathSegments = (plainText: string): Segment[] => {
      if (!plainText) return []
      // Matches unwrapped expressions like X^2, x^{2n}, (x - 2)^2, 10^{-3}, or x_1 / a_{n}
      const barePowerOrSubRegex =
        /(?:\([A-Za-z0-9+\-*/.\s]+\)|[A-Za-z0-9]+)(?:\^(?:\{[^{}]+\}|-?[A-Za-z0-9]+))+|\b[A-Za-z]_(?:\{[^{}]+\}|\d+)\b/g

      let cursor = 0
      const out: Segment[] = []

      while (cursor < plainText.length) {
        const rootMatch = findNextBareRootMatch(plainText, cursor)
        barePowerOrSubRegex.lastIndex = cursor
        const powerMatch = barePowerOrSubRegex.exec(plainText)

        let nextMatch: { start: number; end: number; expr: string } | null = null
        if (rootMatch && powerMatch) {
          nextMatch =
            rootMatch.start <= powerMatch.index
              ? rootMatch
              : {
                  start: powerMatch.index,
                  end: powerMatch.index + powerMatch[0].length,
                  expr: powerMatch[0],
                }
        } else if (rootMatch) {
          nextMatch = rootMatch
        } else if (powerMatch) {
          nextMatch = {
            start: powerMatch.index,
            end: powerMatch.index + powerMatch[0].length,
            expr: powerMatch[0],
          }
        }

        if (!nextMatch) break

        if (nextMatch.start > cursor) {
          out.push({
            type: 'text',
            value: plainText.slice(cursor, nextMatch.start),
          })
        }

        out.push(renderKatexSegment(nextMatch.expr, false))
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
      className={`math-rendered-content ${effectiveDir === 'ltr' ? 'text-left' : ''} ${className}`}
      style={{ unicodeBidi: 'isolate' }}
    >
      {segments.map((seg, idx) => {
        if (seg.type === 'math' && seg.html) {
          return (
            <span
              key={idx}
              className={`inline-math-item ${seg.isBlock ? 'my-2 block text-center' : 'inline-block mx-0.5 align-baseline'}`}
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
