/**
 * Utility to generate and trigger download of a sample Question Bank Excel sheet (.xlsx)
 */

export async function downloadSampleQuestionExcel(): Promise<void> {
  const XLSX = await import('xlsx')

  const sampleData = [
    {
      'نص السؤال': 'ما هو ناتج ضرب ٧ × ٨؟',
      'الخيار الأول': '٤٨',
      'الخيار الثاني': '٥٤',
      'الخيار الثالث': '٥٦',
      'الخيار الرابع': '٦٤',
      'الإجابة الصحيحة': '3',
      'الدرجة': 1,
      'الموضوع': 'العمليات الحسابية',
      'الدرس': 'الدرس الأول: ضرب الأعداد',
      'الصف': 'الصف الأول الإعدادي',
      'الصعوبة': 'easy',
    },
    {
      'نص السؤال': 'إذا كانت س + ٥ = ١٢، فما هي قيمة س؟',
      'الخيار الأول': '٥',
      'الخيار الثاني': '٧',
      'الخيار الثالث': '١٢',
      'الخيار الرابع': '-٧',
      'الإجابة الصحيحة': '2',
      'الدرجة': 2,
      'الموضوع': 'المعادلات الجبرية',
      'الدرس': 'الدرس الثاني: حل المعادلات',
      'الصف': 'الصف الأول الإعدادي',
      'الصعوبة': 'medium',
    },
    {
      'نص السؤال': 'ما هي وحدة قياس القوة في النظام الدولي للوحدات (SI)؟',
      'الخيار الأول': 'الجول (Joule)',
      'الخيار الثاني': 'الواط (Watt)',
      'الخيار الثالث': 'النيوتن (Newton)',
      'الخيار الرابع': 'الباسكال (Pascal)',
      'الإجابة الصحيحة': '3',
      'الدرجة': 1,
      'الموضوع': 'قوانين نيوتن',
      'الدرس': 'الدرس الأول: القوى والحركة',
      'الصف': 'الصف الأول الثانوي',
      'الصعوبة': 'medium',
    },
    {
      'نص السؤال': 'أي مما يلي يُعد من مصادر الطاقة المتجددة؟',
      'الخيار الأول': 'الفحم الحجري',
      'الخيار الثاني': 'الغاز الطبيعي',
      'الخيار الثالث': 'الطاقة الشمسية',
      'الخيار الرابع': 'النفط الخام',
      'الإجابة الصحيحة': '3',
      'الدرجة': 1,
      'الموضوع': 'الطاقة والبيئة',
      'الدرس': 'الدرس الثاني: مصادر الطاقة',
      'الصف': 'الصف الأول الثانوي',
      'الصعوبة': 'easy',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(sampleData)

  // Configure column widths for clear readability in Excel
  worksheet['!cols'] = [
    { wch: 42 }, // نص السؤال
    { wch: 18 }, // الخيار الأول
    { wch: 18 }, // الخيار الثاني
    { wch: 18 }, // الخيار الثالث
    { wch: 18 }, // الخيار الرابع
    { wch: 16 }, // الإجابة الصحيحة
    { wch: 10 }, // الدرجة
    { wch: 22 }, // الموضوع
    { wch: 24 }, // الدرس
    { wch: 22 }, // الصف
    { wch: 14 }, // الصعوبة
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'بنك الأسئلة')

  XLSX.writeFile(workbook, 'نموذج_بنك_الأسئلة_المثالي.xlsx')
}


/**
 * Utility to generate and trigger download of a sample Students Excel sheet (.xlsx)
 * Supports columns: اسم الطالب, رقم هاتف الطالب, رقم هاتف ولي الأمر, المجموعة, الصف
 */
export async function downloadSampleStudentExcel(
  existingGroups?: { name: string; grade: string }[]
): Promise<void> {
  const XLSX = await import('xlsx')

  const group1 = existingGroups?.[0]?.name || 'مجموعة السبت والثلاثاء ٥م'
  const grade1 = existingGroups?.[0]?.grade || 'الصف الأول الثانوي'
  const group2 = existingGroups?.[1]?.name || 'مجموعة الأحد والأربعاء ٦م'
  const grade2 = existingGroups?.[1]?.grade || 'الصف الثاني الثانوي'

  const sampleData = [
    {
      'اسم الطالب': 'يوسف أحمد محمد علي',
      'رقم هاتف الطالب': '01012345678',
      'رقم هاتف ولي الأمر': '01198765432',
      'المجموعة': group1,
      'الصف': grade1,
    },
    {
      'اسم الطالب': 'مريم محمود إبراهيم حسن',
      'رقم هاتف الطالب': '01234567890',
      'رقم هاتف ولي الأمر': '01055566677',
      'المجموعة': group1,
      'الصف': grade1,
    },
    {
      'اسم الطالب': 'عمر خالد حسن مصطفى',
      'رقم هاتف الطالب': '01511223344',
      'رقم هاتف ولي الأمر': '01288990011',
      'المجموعة': group2,
      'الصف': grade2,
    },
    {
      'اسم الطالب': 'سارة طارق عبد الرحمن',
      'رقم هاتف الطالب': '01122334455',
      'رقم هاتف ولي الأمر': '01033445566',
      'المجموعة': group2,
      'الصف': grade2,
    },
    {
      'اسم الطالب': 'زياد سامح كمال الدين',
      'رقم هاتف الطالب': '01099887766',
      'رقم هاتف ولي الأمر': '01233221100',
      'المجموعة': group1,
      'الصف': grade1,
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(sampleData)

  // Configure column widths for readability in Excel
  worksheet['!cols'] = [
    { wch: 30 }, // اسم الطالب
    { wch: 20 }, // رقم هاتف الطالب
    { wch: 20 }, // رقم هاتف ولي الأمر
    { wch: 28 }, // المجموعة
    { wch: 22 }, // الصف
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة الطلاب')

  XLSX.writeFile(workbook, 'نموذج_إضافة_الطلاب_المثالي.xlsx')
}
