/**
 * Test Suite: AI Auto-Grader & Question Correctness Verification
 * Tests Smart Batching, MCQ Native Grading, Blank Answer 0-Token Handling,
 * Local Fallback Heuristics, and Teacher Exam Report Generation.
 */

import {
  chunkArray,
  gradeExamSubmissionsBatch,
  generateTeacherExamReport,
} from '../lib/ai-grader.js'
import {
  normalizeRawPowers,
  cleanGeminiArtifacts,
} from '../components/ui/math-renderer.js'

let totalTests = 0
let passedTests = 0

function assert(condition, testName) {
  totalTests++
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passedTests++
  } else {
    console.error(`  ✗ FAIL: ${testName}`)
    throw new Error(`Assertion failed: ${testName}`)
  }
}

async function runTests() {
  console.log('====================================================')
  console.log('   RUNNING AI AUTO-GRADER & PROMPT VERIFICATION TESTS')
  console.log('====================================================\n')

  // ----------------------------------------------------------------
  // Test Suite 1: Chunk Array / Batching Logic
  // ----------------------------------------------------------------
  console.log('Test Suite 1: Smart Batching (chunkArray)')
  {
    const empty = chunkArray([], 10)
    assert(empty.length === 0, 'Empty array yields 0 chunks')

    const small = chunkArray([1, 2, 3], 10)
    assert(small.length === 1 && small[0].length === 3, '3 items yield 1 chunk of 3')

    const exact = chunkArray(Array.from({ length: 20 }, (_, i) => i), 10)
    assert(exact.length === 2 && exact[0].length === 10 && exact[1].length === 10, '20 items yield 2 chunks of 10')

    const uneven = chunkArray(Array.from({ length: 25 }, (_, i) => i), 10)
    assert(uneven.length === 3 && uneven[2].length === 5, '25 items yield 3 chunks (10, 10, 5)')
  }
  console.log('')

  // ----------------------------------------------------------------
  // Test Suite 2: Question Model & Correctness Validation
  // ----------------------------------------------------------------
  console.log('Test Suite 2: Question JSON Correctness Verification Rules')
  {
    const sampleValidQuestions = [
      {
        type: 'mcq',
        body: 'أيٌّ من التعبيرات الآتية يمثل مفكوك المقدار $(X - 2)^2$؟',
        options: [
          '$X^2 - 4X + 4$',
          '$X^2 - 4$',
          '$X^2 + 4X + 4$',
          '$X^2 - 2X + 4$',
        ],
        correct: [0], // 0-based index pointing to options[0]
        marks: 2,
      },
      {
        type: 'true_false',
        body: 'مجموع قياسات زوايا المثلث يساوي $180^\\circ$',
        options: ['صواب', 'خطأ'],
        correct: [0], // 0-based: [0] = صواب
        marks: 1,
      },
      {
        type: 'essay',
        body: 'أوجد مجموعة حل المعادلة $\\sqrt{X + 5} = X - 1$',
        options: [],
        correct: [],
        model_answer: 'خطوات الحل: بتربيع الطرفين... إذن الحل {4}',
        marks: 4,
      },
    ]

    for (const q of sampleValidQuestions) {
      if (q.type === 'mcq') {
        assert(q.options.length >= 2, `MCQ "${q.body.slice(0, 20)}..." has at least 2 options`)
        assert(
          Array.isArray(q.correct) && q.correct.every((idx) => idx >= 0 && idx < q.options.length),
          `MCQ correct indices are valid zero-based indices (0 <= idx < ${q.options.length})`
        )
      } else if (q.type === 'true_false') {
        assert(q.options.length === 2, 'True/False has exactly 2 options (صواب/خطأ)')
        assert(
          q.correct[0] === 0 || q.correct[0] === 1,
          'True/False correct index is strictly 0 (صواب) or 1 (خطأ)'
        )
      } else if (q.type === 'essay') {
        assert(q.options.length === 0, 'Essay options array is empty')
        assert(q.correct.length === 0, 'Essay correct array is empty')
        assert(Boolean(q.model_answer && q.model_answer.length > 5), 'Essay has comprehensive model answer')
      }
    }
  }
  console.log('')

  // ----------------------------------------------------------------
  // Test Suite 3: Batch Auto-Grading (MCQ + Blank + Essay with Fallback)
  // ----------------------------------------------------------------
  console.log('Test Suite 3: Batch Auto-Grading & Heuristics')
  {
    const questions = [
      {
        id: 'q1',
        type: 'mcq',
        body: 'قيمة المقدار $\\sqrt{16}$ تساوي:',
        options: ['4', '8', '2', '16'],
        correct: [0],
        marks: 2,
      },
      {
        id: 'q2',
        type: 'mcq',
        body: 'أي المعادلتين تمثل خطاً مستقيماً؟',
        options: ['$y = x^2$', '$y = 2x + 1$'],
        correct: [1],
        marks: 2,
      },
      {
        id: 'q3',
        type: 'essay',
        body: 'حل المعادلة $2x + 6 = 10$',
        model_answer: 'خطوات الحل: 2x = 10 - 6 => 2x = 4 => x = 2',
        marks: 3,
        options: [],
        correct: [],
      },
    ]

    const submissions = [
      // Student 1: All correct
      {
        id: 'sub-1',
        student_id: 'st-1',
        student_name: 'أحمد محمود',
        answers: {
          q1: 0, // correct MCQ
          q2: [1], // correct MCQ in array format
          q3: '2x = 4 إذن x = 2 الناتج النهائي 2', // matching essay
        },
      },
      // Student 2: MCQ errors + Empty essay
      {
        id: 'sub-2',
        student_id: 'st-2',
        student_name: 'سارة خالد',
        answers: {
          q1: 2, // wrong
          q2: 0, // wrong
          q3: '', // empty essay -> should be 0 marks automatically without AI calls
        },
      },
      // Student 3: Partial essay
      {
        id: 'sub-3',
        student_id: 'st-3',
        student_name: 'محمد علي',
        answers: {
          q1: 0, // correct
          q2: 1, // correct
          q3: 'خطوات الحل 2x = 4',
        },
      },
    ]

    const gradedResults = await gradeExamSubmissionsBatch({
      examTitle: 'اختبار الجبر الشهري',
      questions,
      submissions,
      apiKey: '', // Test offline fallback mode
    })

    assert(gradedResults.length === 3, 'All 3 submissions were graded')

    // Inspect Student 1
    const s1 = gradedResults.find((r) => r.submission_id === 'sub-1')
    assert(s1 !== undefined, 'Student 1 result found')
    assert(s1.max_score === 7, 'Total max score is 7 (2+2+3)')
    assert(s1.score >= 5.5, `Student 1 got high score (${s1.score}/7)`)

    // Inspect Student 2 (Empty answer test)
    const s2 = gradedResults.find((r) => r.submission_id === 'sub-2')
    assert(s2 !== undefined, 'Student 2 result found')
    const s2Essay = s2.evaluations.find((e) => e.question_id === 'q3')
    assert(s2Essay.marks_awarded === 0, 'Blank essay awarded strictly 0 marks')
    assert(s2Essay.feedback.includes('لم يتم تقديم إجابة'), 'Blank essay has appropriate Arabic feedback')
    assert(s2.score === 0, 'Student 2 with all wrong answers has score 0')

    // Inspect Student 3
    const s3 = gradedResults.find((r) => r.submission_id === 'sub-3')
    assert(s3 !== undefined, 'Student 3 result found')
    assert(s3.score >= 4, `Student 3 scored at least 4 for two correct MCQs (${s3.score}/7)`)

    // ----------------------------------------------------------------
    // Test Suite 4: Teacher Exam Report Generation
    // ----------------------------------------------------------------
    console.log('\nTest Suite 4: Teacher Exam Pedagogical Report Generation')
    const report = await generateTeacherExamReport({
      examTitle: 'اختبار الجبر الشهري',
      questions,
      evaluatedSubmissions: gradedResults,
      apiKey: '', // offline report generator
    })

    assert(report.total_students === 3, 'Report reflects 3 total students')
    assert(report.average_score > 0, `Report calculated average score (${report.average_score})`)
    assert(report.average_percentage > 0, `Report calculated average percentage (${report.average_percentage}%)`)
    assert(report.highest_score >= report.lowest_score, 'Highest score >= Lowest score')
    assert(report.strengths.length > 0, 'Report includes student strengths')
    assert(report.recommendations_for_teacher.length > 0, 'Report includes actionable recommendations for teacher')
  }

  // ----------------------------------------------------------------
  // Test Suite 5: Mathematical Powers Normalization (x^2, Unicode Exponents, Polynomials)
  // ----------------------------------------------------------------
  console.log('\nTest Suite 5: Mathematical Powers Normalization (x^2 & Exponents)')
  {
    // 1. Raw simple powers
    assert(normalizeRawPowers('x^2') === '$x^2$', 'Normalizes bare "x^2" to "$x^2$"')
    assert(normalizeRawPowers('X^2') === '$X^2$', 'Normalizes bare "X^2" to "$X^2$"')
    assert(normalizeRawPowers('2^3') === '$2^3$', 'Normalizes bare "2^3" to "$2^3$"')
    assert(normalizeRawPowers('10^-3') === '$10^-3$', 'Normalizes bare "10^-3" to "$10^-3$"')

    // 2. Polynomial expressions (entire option)
    assert(normalizeRawPowers('X^2 - 4X + 4') === '$X^2 - 4X + 4$', 'Normalizes polynomial "X^2 - 4X + 4" to single KaTeX block')
    assert(normalizeRawPowers('x^2 - 4') === '$x^2 - 4$', 'Normalizes "x^2 - 4" to "$x^2 - 4$"')

    // 3. Unicode superscripts (e.g. x², 10⁻³, (x-2)²)
    assert(normalizeRawPowers('x²') === '$x^2$', 'Converts unicode superscript "x²" to "$x^2$"')
    assert(normalizeRawPowers('(x - 2)²') === '$(x - 2)^2$', 'Converts unicode "(x - 2)²" to "$(x - 2)^2$"')
    assert(normalizeRawPowers('10⁻³') === '$10^{-3}$', 'Converts unicode "10⁻³" to "$10^{-3}$"')

    // 4. Spaces around carat
    assert(normalizeRawPowers('x ^ 2') === '$x^2$', 'Removes spaces around carat "x ^ 2" -> "$x^2$"')

    // 5. Mixed Arabic text with embedded powers
    const arabicQuestion = 'أيٌّ من التعبيرات الآتية يمثل مفكوك المقدار (X - 2)^2؟'
    const normalizedArabic = normalizeRawPowers(arabicQuestion)
    assert(normalizedArabic.includes('$(X - 2)^2$'), 'Wraps embedded power in Arabic sentence without breaking surrounding text')

    // 6. Already wrapped math blocks (should not double wrap)
    assert(normalizeRawPowers('$x^2$') === '$x^2$', 'Preserves already wrapped "$x^2$" without double wrapping')
    assert(normalizeRawPowers('$$\\frac{a}{b}$$') === '$$\\frac{a}{b}$$', 'Preserves display math blocks')

    // 7. cleanGeminiArtifacts integration
    assert(cleanGeminiArtifacts('X² - 4X + 4') === '$X^2 - 4X + 4$', 'cleanGeminiArtifacts handles raw powers and unicode')

    // 8. English sentences with powers or ordinals (e.g. 4^{th}) - must NOT wrap whole sentence in $!
    const engQuestion = 'In a geometric sequence, the sum of the 4^{th} and 6^{th} terms is 120 and the sum of the 5^{th} and 7^{th} terms = 240, then the sum of first 10 terms = .........'
    const cleanedEng = cleanGeminiArtifacts(engQuestion)
    assert(cleanedEng.startsWith('In a geometric sequence, the sum of the $4^{th}$'), 'English question text remains normal readable font with only powers wrapped')
    assert(!cleanedEng.startsWith('$In a geometric sequence'), 'English question is never wrapped as a whole in $')

    // 9. Accidentally wrapped English sentence in $...$ must be unwrapped to normal text font
    const wrappedEng = '$' + engQuestion + '$'
    const unwrappedResult = cleanGeminiArtifacts(wrappedEng)
    assert(unwrappedResult.startsWith('In a geometric sequence, the sum of the $4^{th}$'), 'Accidentally wrapped English sentence is unwrapped so font matches standard text')
  }

  console.log('\n====================================================')
  console.log(`   ALL TESTS PASSED: ${passedTests}/${totalTests} ✓`)
  console.log('====================================================\n')
}

runTests().catch((err) => {
  console.error('\nTests failed with error:', err)
  process.exit(1)
})
