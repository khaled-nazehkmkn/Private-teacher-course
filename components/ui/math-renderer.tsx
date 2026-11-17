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
  if (/^[-+*/=()a-zA-Z0-9\s.,^_{}\\$]+$/.test(trimmed) && !/[\u0600-\u06FF]/.test(trimmed)) {
    return true
  }
  return false
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

    const renderBareMathSegments = (plainText: string): Segment[] => {
      if (!plainText) return []
      // Matches unwrapped expressions like X^2, x^{2n}, (x - 2)^2, 10^{-3}, or x_1 / a_{n}
      const bareMathRegex =
        /(?:\([A-Za-z0-9+\-*/.\s]+\)|[A-Za-z0-9]+)(?:\^(?:\{[^{}]+\}|-?[A-Za-z0-9]+))+|\b[A-Za-z]_(?:\{[^{}]+\}|\d+)\b/g

      let bareLastIdx = 0
      let bareMatch: RegExpExecArray | null
      const out: Segment[] = []

      while ((bareMatch = bareMathRegex.exec(plainText)) !== null) {
        if (bareMatch.index > bareLastIdx) {
          out.push({
            type: 'text',
            value: plainText.slice(bareLastIdx, bareMatch.index),
          })
        }

        const expr = bareMatch[0]
        try {
          const html = katex.renderToString(expr.trim(), {
            displayMode: false,
            throwOnError: false,
            output: 'htmlAndMathml',
          })
          out.push({
            type: 'math',
            isBlock: false,
            html,
            value: expr,
          })
        } catch {
          out.push({ type: 'text', value: expr })
        }

        bareLastIdx = bareMathRegex.lastIndex
      }

      if (bareLastIdx < plainText.length) {
        out.push({
          type: 'text',
          value: plainText.slice(bareLastIdx),
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

      try {
        const html = katex.renderToString(mathContent.trim(), {
          displayMode: isBlock,
          throwOnError: false,
          output: 'htmlAndMathml',
        })
        result.push({
          type: 'math',
          isBlock,
          html,
          value: mathContent,
        })
      } catch (err) {
        console.warn('[MathRenderer] KaTeX render error:', err)
        result.push({
          type: 'text',
          value: match[0],
        })
      }

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
