'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { evaluateTeacherStatus, type TeacherStatus } from '@/lib/teacher-status'
import { generateOccurrencesForWeeks } from '@/lib/occurrences'

// UI Components
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { TeacherStatusBanner } from '@/components/TeacherStatusBanner'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { GroupsView, type GroupItem } from '@/components/groups/GroupsView'
import { StudentsView, type StudentItem } from '@/components/students/StudentsView'
import { AttendanceView, type OccurrenceItem, type AttendanceStatus } from '@/components/attendance/AttendanceView'
import { AbsenceView, type AbsenceRecord } from '@/components/absence/AbsenceView'
import { MakeupView, type MakeupRequestItem } from '@/components/makeup/MakeupView'
import { QuestionsView, type QuestionBankItem } from '@/components/questions/QuestionsView'
import { ExamsView, type ExamItem, type ExamSubmissionDetail } from '@/components/exams/ExamsView'
import { RemindersView, type ReminderItem } from '@/components/reminders/RemindersView'
import { ReportsView } from '@/components/reports/ReportsView'
import { MessageLogView, type MessageLogItem } from '@/components/messages/MessageLogView'
import { AdminView, type AdminTeacherItem } from '@/components/admin/AdminView'

import { Loader2 } from 'lucide-react'

// Demo Fallback Data for instant offline/dev testing
const INITIAL_GROUPS: GroupItem[] = [
  {
    id: 'grp-1',
    name: 'مجموعة الصف الثاني الإعدادي (أ)',
    grade: 'الصف الثاني الإعدادي',
    capacity: 20,
    studentCount: 3,
    sessions: [
      { weekday: 0, start_time: '17:00', end_time: '18:30' },
      { weekday: 2, start_time: '17:00', end_time: '18:30' },
    ],
  },
  {
    id: 'grp-2',
    name: 'مجموعة الصف الأول الثانوي (متفوقين)',
    grade: 'الصف الأول الثانوي',
    capacity: 25,
    studentCount: 3,
    sessions: [
      { weekday: 1, start_time: '18:00', end_time: '19:30' },
      { weekday: 3, start_time: '18:00', end_time: '19:30' },
    ],
  },
]

const INITIAL_STUDENTS: StudentItem[] = [
  {
    id: 'st-1',
    full_name: 'يوسف أحمد علي',
    parent_phone: '01012345678',
    grade: 'الصف الثاني الإعدادي',
    group_id: 'grp-1',
    group_name: 'مجموعة الصف الثاني الإعدادي (أ)',
    access_code: '48291',
  },
  {
    id: 'st-2',
    full_name: 'ملك محمود إبراهيم',
    parent_phone: '01198765432',
    grade: 'الصف الثاني الإعدادي',
    group_id: 'grp-1',
    group_name: 'مجموعة الصف الثاني الإعدادي (أ)',
    access_code: '59382',
  },
  {
    id: 'st-3',
    full_name: 'عمر خالد حسن',
    parent_phone: '01234567890',
    grade: 'الصف الأول الثانوي',
    group_id: 'grp-2',
    group_name: 'مجموعة الصف الأول الثانوي (متفوقين)',
    access_code: '31849',
  },
]

const INITIAL_QUESTIONS: QuestionBankItem[] = [
  {
    id: 'q-1',
    body: 'ما قيمة x إذا كانت 2x + 4 = 10؟',
    options: ['2', '3', '4', '5'],
    correct: [1],
    marks: 2,
    topic: 'المعادلات الخطية',
    grade: 'الصف الثاني الإعدادي',
    difficulty: 'easy',
  },
  {
    id: 'q-2',
    body: 'مجموع قياسات زوايا المثلث الداخلة تساوي:',
    options: ['90 درجة', '180 درجة', '270 درجة', '360 درجة'],
    correct: [1],
    marks: 1,
    topic: 'الهندسة',
    grade: 'الصف الأول الإعدادي',
    difficulty: 'easy',
  },
]

export default function TeacherAppPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('الرئيسية')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Current Teacher Profile & Status
  const [teacherProfile, setTeacherProfile] = useState<{
    id: string
    full_name: string
    subject: string
    is_admin: boolean
  }>({
    id: 'demo-teacher',
    full_name: 'أحمد محمود',
    subject: 'الرياضيات',
    is_admin: true,
  })

  const [teacherStatus, setTeacherStatus] = useState<TeacherStatus>({
    isActive: true,
    isSuspended: false,
    isExpired: false,
    isAdmin: true,
  })

  // State data
  const [groups, setGroups] = useState<GroupItem[]>(INITIAL_GROUPS)
  const [students, setStudents] = useState<StudentItem[]>(INITIAL_STUDENTS)
  const [occurrences, setOccurrences] = useState<OccurrenceItem[]>([])
  const [absencesData, setAbsencesData] = useState<Record<string, AbsenceRecord>>({})
  const [makeupRequests, setMakeupRequests] = useState<MakeupRequestItem[]>([])
  const [questions, setQuestions] = useState<QuestionBankItem[]>(INITIAL_QUESTIONS)
  const [exams, setExams] = useState<ExamItem[]>([])
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [messageLogs, setMessageLogs] = useState<MessageLogItem[]>([])
  const [adminTeachers, setAdminTeachers] = useState<AdminTeacherItem[]>([])

  // Load all data from Supabase
  const loadData = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Fetch teacher record
        const { data: tRow } = await supabase
          .from('teachers')
          .select('*')
          .eq('id', user.id)
          .single()

        if (tRow) {
          setTeacherProfile({
            id: tRow.id,
            full_name: tRow.full_name,
            subject: tRow.subject || 'المادة',
            is_admin: tRow.is_admin,
          })
          const evaluated = evaluateTeacherStatus(tRow)
          setTeacherStatus(evaluated)
        }

        // Fetch Groups with sessions
        const { data: groupsData } = await supabase
          .from('groups')
          .select(`
            id,
            name,
            grade,
            capacity,
            sessions:group_sessions (
              id,
              weekday,
              start_time,
              end_time
            )
          `)
          .order('created_at', { ascending: false })

        if (groupsData && groupsData.length > 0) {
          const mappedGroups: GroupItem[] = groupsData.map((g: any) => ({
            id: g.id,
            name: g.name,
            grade: g.grade,
            capacity: g.capacity,
            sessions: g.sessions || [],
          }))
          setGroups(mappedGroups)
        }

        // Fetch Students
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, full_name, parent_phone, grade, group_id, access_code')
          .order('full_name', { ascending: true })

        if (studentsData) {
          setStudents(studentsData as StudentItem[])
        }

        // Fetch Occurrences
        let { data: occData } = await supabase
          .from('session_occurrences')
          .select('*')
          .order('session_date', { ascending: true })

        // Auto-generate occurrences for groups with weekly sessions if none exist
        if ((!occData || occData.length === 0) && groupsData && groupsData.length > 0) {
          const toInsert: any[] = []
          groupsData.forEach((grp: any) => {
            const sessions = grp.sessions || []
            if (sessions.length > 0) {
              const occs = generateOccurrencesForWeeks({
                weeklySessions: sessions.map((s: any) => ({
                  weekday: s.weekday,
                  start_time: s.start_time.slice(0, 5),
                  end_time: s.end_time.slice(0, 5),
                })),
                weeksAhead: 4,
                weeksBehind: 2,
              })
              occs.forEach((o) => {
                toInsert.push({
                  teacher_id: user.id,
                  group_id: grp.id,
                  session_date: o.session_date,
                  start_time: o.start_time,
                  end_time: o.end_time,
                  status: 'held',
                })
              })
            }
          })

          if (toInsert.length > 0) {
            await supabase
              .from('session_occurrences')
              .upsert(toInsert, { onConflict: 'group_id,session_date,start_time' })

            const { data: refreshedOcc } = await supabase
              .from('session_occurrences')
              .select('*')
              .order('session_date', { ascending: true })

            occData = refreshedOcc
          }
        }

        if (occData && occData.length > 0) {
          setOccurrences(occData as OccurrenceItem[])
        }

        // Fetch Questions
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .order('created_at', { ascending: false })

        if (qData) {
          setQuestions(
            qData.map((q: any) => ({
              id: q.id,
              body: q.body,
              type: q.type || 'mcq',
              image_path: q.image_path,
              options: Array.isArray(q.options) ? q.options : [],
              correct: Array.isArray(q.correct) ? q.correct : [0],
              marks: q.marks,
              grade: q.grade,
              topic: q.topic,
              difficulty: q.difficulty,
              model_answer: q.model_answer,
            }))
          )
        }

        // Fetch Exams
        const { data: exData } = await supabase
          .from('exams')
          .select('*, exam_questions(question_id)')
          .order('created_at', { ascending: false })

        if (exData) {
          setExams(
            exData.map((e: any) => ({
              id: e.id,
              title: e.title,
              group_id: e.group_id,
              grade: e.grade,
              duration_min: e.duration_min,
              opens_at: e.opens_at,
              closes_at: e.closes_at,
              shuffle: e.shuffle,
              results_released: e.results_released,
              public_token: e.public_token,
              question_ids: e.exam_questions?.map((eq: any) => eq.question_id) || [],
              created_at: e.created_at,
            }))
          )
        }

        // Fetch Message Log & Reminders
        const { data: mlData } = await supabase
          .from('message_log')
          .select('*, student:students(full_name)')
          .order('created_at', { ascending: false })

        if (mlData) {
          setMessageLogs(
            mlData.map((m: any) => ({
              id: m.id,
              student_id: m.student_id,
              student_name: m.student?.full_name,
              kind: m.kind,
              body: m.body,
              created_at: m.created_at,
            }))
          )

          const loadedReminders: ReminderItem[] = []
          mlData.forEach((m: any) => {
            if (m.kind === 'custom') {
              try {
                const parsed = JSON.parse(m.body)
                if (parsed && parsed.is_reminder) {
                  loadedReminders.push({
                    id: m.id,
                    title: parsed.title,
                    group_id: parsed.group_id || null,
                    group_name: parsed.group_name || null,
                    remind_date: parsed.remind_date,
                    remind_time: parsed.remind_time,
                    notes: parsed.notes,
                    completed: Boolean(parsed.completed),
                    created_at: m.created_at,
                  })
                }
              } catch (_) {}
            }
          })
          setReminders(loadedReminders)
        }

        // Fetch Absences with Bulletproof Fallback
        const { data: absData, error: absError } = await supabase
          .from('student_absences')
          .select('student_id, session_date, occurrence_id')
          .order('session_date', { ascending: true })

        let effectiveAbsData = absData || []
        if (absError || !absData || absData.length === 0) {
          const { data: directAtt } = await supabase
            .from('attendance')
            .select('student_id, occurrence_id, session_occurrences(session_date, status)')
            .eq('status', 'absent')

          if (directAtt && directAtt.length > 0) {
            effectiveAbsData = directAtt
              .filter((r: any) => r.session_occurrences?.status !== 'cancelled')
              .map((r: any) => ({
                student_id: r.student_id,
                occurrence_id: r.occurrence_id,
                session_date: r.session_occurrences?.session_date,
              }))
          }
        }

        const map: Record<string, AbsenceRecord> = {}
        if (studentsData) {
          studentsData.forEach((st: any) => {
            map[st.id] = { student_id: st.id, dates: [], consecutive: 0 }
          })
        }
        effectiveAbsData.forEach((row: any) => {
          if (!map[row.student_id]) {
            map[row.student_id] = { student_id: row.student_id, dates: [], consecutive: 0 }
          }
          if (row.session_date && !map[row.student_id].dates.includes(row.session_date)) {
            map[row.student_id].dates.push(row.session_date)
          }
        })
        Object.values(map).forEach((rec) => {
          rec.consecutive = rec.dates.length
        })
        setAbsencesData(map)

        // Fetch Admin Teachers if Admin
        if (tRow?.is_admin) {
          try {
            const adminRes = await fetch('/api/admin/teachers')
            if (adminRes.ok) {
              const resJson = await adminRes.json()
              if (resJson.teachers) {
                setAdminTeachers(resJson.teachers as AdminTeacherItem[])
              }
            }
          } catch (e) {
            console.error('[Admin] Error fetching enriched teachers via API:', e)
          }
        }
      }
    } catch (err) {
      console.error('[App] Supabase data load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handlers for Groups
  const handleAddGroup = async (newGroupData: Omit<GroupItem, 'id'>) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: insertedGroup, error: grpError } = await supabase
        .from('groups')
        .insert({
          teacher_id: user.id,
          name: newGroupData.name,
          grade: newGroupData.grade,
          capacity: newGroupData.capacity,
        })
        .select()
        .single()

      if (!grpError && insertedGroup) {
        if (newGroupData.sessions.length > 0) {
          await supabase.from('group_sessions').insert(
            newGroupData.sessions.map((s) => ({
              group_id: insertedGroup.id,
              weekday: s.weekday,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          )

          const occs = generateOccurrencesForWeeks({
            weeklySessions: newGroupData.sessions,
            weeksAhead: 4,
            weeksBehind: 2,
          })
          if (occs.length > 0) {
            await supabase.from('session_occurrences').upsert(
              occs.map((o) => ({
                teacher_id: user.id,
                group_id: insertedGroup.id,
                session_date: o.session_date,
                start_time: o.start_time,
                end_time: o.end_time,
                status: 'held',
              })),
              { onConflict: 'group_id,session_date,start_time' }
            )
          }
        }
        await loadData()
        return
      }
    }

    // Local fallback update
    const id = `grp-${Date.now()}`
    setGroups((prev) => [...prev, { id, ...newGroupData, studentCount: 0 }])
  }

  const handleDeleteGroup = async (groupId: string) => {
    const supabase = createClient()
    await supabase.from('groups').delete().eq('id', groupId)
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
  }

  const handleUpdateGroup = async (
    groupId: string,
    updatedData: {
      name: string
      grade: string
      capacity: number
      sessions: Array<{ weekday: number; start_time: string; end_time: string }>
    }
  ) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from('groups')
        .update({
          name: updatedData.name,
          grade: updatedData.grade,
          capacity: updatedData.capacity,
        })
        .eq('id', groupId)

      await supabase.from('group_sessions').delete().eq('group_id', groupId)

      if (updatedData.sessions.length > 0) {
        await supabase.from('group_sessions').insert(
          updatedData.sessions.map((s) => ({
            group_id: groupId,
            weekday: s.weekday,
            start_time: s.start_time,
            end_time: s.end_time,
          }))
        )

        const occs = generateOccurrencesForWeeks({
          weeklySessions: updatedData.sessions,
          weeksAhead: 4,
          weeksBehind: 1,
        })
        if (occs.length > 0) {
          await supabase.from('session_occurrences').upsert(
            occs.map((o) => ({
              teacher_id: user.id,
              group_id: groupId,
              session_date: o.session_date,
              start_time: o.start_time,
              end_time: o.end_time,
              status: 'held',
            })),
            { onConflict: 'group_id,session_date,start_time' }
          )
        }
      }
      await loadData()
      return
    }

    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...updatedData } : g))
    )
  }

  // Reminder Handlers
  const handleAddReminder = async (rem: Omit<ReminderItem, 'id' | 'created_at'>) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const reminderPayload = {
      is_reminder: true,
      title: rem.title,
      group_id: rem.group_id,
      group_name: rem.group_name,
      remind_date: rem.remind_date,
      remind_time: rem.remind_time,
      notes: rem.notes,
      completed: false,
    }

    if (user) {
      const { data: inserted, error } = await supabase
        .from('message_log')
        .insert({
          teacher_id: user.id,
          kind: 'custom',
          body: JSON.stringify(reminderPayload),
        })
        .select()
        .single()

      if (!error && inserted) {
        setReminders((prev) => [
          {
            id: inserted.id,
            ...rem,
            created_at: inserted.created_at,
          },
          ...prev,
        ])
        return
      }
    }

    const localItem: ReminderItem = {
      id: `rem-${Date.now()}`,
      ...rem,
      created_at: new Date().toISOString(),
    }
    setReminders((prev) => [localItem, ...prev])
  }

  const handleToggleReminder = async (id: string, currentCompleted: boolean) => {
    const target = reminders.find((r) => r.id === id)
    if (!target) return
    const updatedCompleted = !currentCompleted

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const updatedPayload = {
        is_reminder: true,
        title: target.title,
        group_id: target.group_id,
        group_name: target.group_name,
        remind_date: target.remind_date,
        remind_time: target.remind_time,
        notes: target.notes,
        completed: updatedCompleted,
      }
      await supabase
        .from('message_log')
        .update({ body: JSON.stringify(updatedPayload) })
        .eq('id', id)
    }

    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: updatedCompleted } : r))
    )
  }

  const handleDeleteReminder = async (id: string) => {
    const supabase = createClient()
    await supabase.from('message_log').delete().eq('id', id)
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }

  // Handlers for Students
  const handleAddStudent = async (studentData: Omit<StudentItem, 'id'>) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('students').insert({
        teacher_id: user.id,
        group_id: studentData.group_id,
        full_name: studentData.full_name,
        parent_phone: studentData.parent_phone,
        grade: studentData.grade,
        access_code: studentData.access_code,
      })
      await loadData()
      return
    }

    const id = `st-${Date.now()}`
    const grp = groups.find((g) => g.id === studentData.group_id)
    setStudents((prev) => [
      ...prev,
      { id, ...studentData, group_name: grp?.name || undefined },
    ])
  }

  const handleBatchImportStudents = async (list: Omit<StudentItem, 'id'>[]) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('students').insert(
        list.map((s) => ({
          teacher_id: user.id,
          group_id: s.group_id,
          full_name: s.full_name,
          parent_phone: s.parent_phone,
          grade: s.grade,
          access_code: s.access_code,
        }))
      )
      await loadData()
      return
    }

    const newItems: StudentItem[] = list.map((s, idx) => ({
      id: `st-import-${Date.now()}-${idx}`,
      ...s,
      group_name: groups.find((g) => g.id === s.group_id)?.name,
    }))
    setStudents((prev) => [...prev, ...newItems])
  }

  const handleMoveStudent = async (studentId: string, newGroupId: string) => {
    const supabase = createClient()
    await supabase.from('students').update({ group_id: newGroupId }).eq('id', studentId)

    const targetGroup = groups.find((g) => g.id === newGroupId)
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, group_id: newGroupId, group_name: targetGroup?.name }
          : s
      )
    )
  }

  const handleDeleteStudent = async (studentId: string) => {
    const supabase = createClient()
    await supabase.from('students').delete().eq('id', studentId)
    setStudents((prev) => prev.filter((s) => s.id !== studentId))
  }

  // Attendance Handlers
  const handleSaveAttendance = async (
    occurrenceId: string,
    records: Array<{ student_id: string; status: AttendanceStatus; note?: string }>
  ) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const payload = records.map((rec) => ({
        teacher_id: user.id,
        occurrence_id: occurrenceId,
        student_id: rec.student_id,
        status: rec.status,
        note: rec.note || null,
      }))

      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'occurrence_id,student_id' })

      if (error) {
        console.error('[Attendance Save] Upsert Error:', error)
        throw error
      }

      // Refresh absences and application state
      await loadData()
    }
  }

  const handleToggleCancelOccurrence = async (
    occurrenceId: string,
    currentStatus: 'held' | 'cancelled'
  ) => {
    const nextStatus = currentStatus === 'held' ? 'cancelled' : 'held'
    const supabase = createClient()
    await supabase
      .from('session_occurrences')
      .update({ status: nextStatus })
      .eq('id', occurrenceId)

    setOccurrences((prev) =>
      prev.map((o) => (o.id === occurrenceId ? { ...o, status: nextStatus } : o))
    )
  }

  const handleAddOccurrence = async (newOcc: {
    group_id: string
    session_date: string
    start_time: string
    end_time: string
  }): Promise<string | undefined> => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data, error } = await supabase
        .from('session_occurrences')
        .upsert(
          {
            teacher_id: user.id,
            group_id: newOcc.group_id,
            session_date: newOcc.session_date,
            start_time: newOcc.start_time,
            end_time: newOcc.end_time,
            status: 'held',
          },
          { onConflict: 'group_id,session_date,start_time' }
        )
        .select()
        .single()

      if (!error && data) {
        setOccurrences((prev) => {
          const filtered = prev.filter((o) => o.id !== data.id)
          return [...filtered, data as OccurrenceItem].sort((a, b) =>
            a.session_date.localeCompare(b.session_date)
          )
        })
        return data.id
      }
    }

    const id = `occ-${Date.now()}`
    const localItem: OccurrenceItem = {
      id,
      group_id: newOcc.group_id,
      session_date: newOcc.session_date,
      start_time: newOcc.start_time,
      end_time: newOcc.end_time,
      status: 'held',
    }
    setOccurrences((prev) => [...prev, localItem])
    return id
  }

  // Questions Handlers
  const handleAddQuestion = async (qData: Omit<QuestionBankItem, 'id'>) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('questions').insert({
        teacher_id: user.id,
        body: qData.body,
        type: qData.type || 'mcq',
        options: (qData.options || []) as any,
        correct: (qData.correct || []) as any,
        marks: qData.marks,
        grade: qData.grade,
        topic: qData.topic,
        difficulty: qData.difficulty,
        image_path: qData.image_path,
        model_answer: qData.model_answer || null,
      })
      await loadData()
      return
    }

    const id = `q-${Date.now()}`
    setQuestions((prev) => [
      {
        id,
        ...qData,
      },
      ...prev,
    ])
  }

  const handleBatchAddQuestions = async (qList: Omit<QuestionBankItem, 'id'>[]) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('questions').insert(
        qList.map((q) => ({
          teacher_id: user.id,
          body: q.body,
          type: q.type || 'mcq',
          options: (q.options || []) as any,
          correct: (q.correct || []) as any,
          marks: q.marks,
          grade: q.grade,
          topic: q.topic,
          difficulty: q.difficulty,
          image_path: q.image_path,
          model_answer: q.model_answer || null,
        }))
      )
      await loadData()
      return
    }

    const newItems: QuestionBankItem[] = qList.map((q, idx) => ({
      id: `q-import-${Date.now()}-${idx}`,
      ...q,
    }))
    setQuestions((prev) => [...newItems, ...prev])
  }

  const handleDeleteQuestion = async (id: string) => {
    const supabase = createClient()
    await supabase.from('questions').delete().eq('id', id)
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const handleUploadImage = async (fileBlob: Blob, fileName: string): Promise<string> => {
    try {
      const formData = new FormData()
      formData.append('file', fileBlob, fileName)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const json = await res.json()
        if (json.url) return json.url
      }
    } catch (err) {
      console.warn('[Image Upload] Server API error, falling back to Data URL:', err)
    }

    // Direct Data URL fallback
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(fileBlob)
    })
  }

  // Exams Handlers
  const handleCreateExam = async (examData: {
    title: string
    group_id?: string | null
    grade?: string | null
    duration_min: number
    opens_at?: string | null
    closes_at?: string | null
    shuffle: boolean
    question_ids: string[]
  }) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          teacher_id: user.id,
          title: examData.title,
          group_id: examData.group_id || null,
          grade: examData.grade || null,
          duration_min: examData.duration_min,
          opens_at: examData.opens_at || null,
          closes_at: examData.closes_at || null,
          shuffle: examData.shuffle,
        })
        .select()
        .single()

      if (!examErr && newExam) {
        if (examData.question_ids.length > 0) {
          await supabase.from('exam_questions').insert(
            examData.question_ids.map((qId, idx) => ({
              exam_id: newExam.id,
              question_id: qId,
              position: idx,
            }))
          )
        }
        await loadData()
        return
      }
    }

    // Local fallback
    const id = `exam-${Date.now()}`
    const token = Math.random().toString(36).substring(2, 14)
    setExams((prev) => [
      {
        id,
        title: examData.title,
        group_id: examData.group_id || null,
        grade: examData.grade || null,
        duration_min: examData.duration_min,
        opens_at: examData.opens_at || null,
        closes_at: examData.closes_at || null,
        shuffle: examData.shuffle,
        results_released: false,
        public_token: token,
        question_ids: examData.question_ids,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  const handleToggleResultsRelease = async (examId: string, currentReleased: boolean) => {
    const nextState = !currentReleased
    const supabase = createClient()
    await supabase.from('exams').update({ results_released: nextState }).eq('id', examId)

    setExams((prev) =>
      prev.map((e) => (e.id === examId ? { ...e, results_released: nextState } : e))
    )
  }

  const handleDeleteExam = async (examId: string) => {
    const supabase = createClient()
    await supabase.from('exams').delete().eq('id', examId)
    setExams((prev) => prev.filter((e) => e.id !== examId))
  }

  const handleFetchExamSubmissions = async (examId: string): Promise<ExamSubmissionDetail[]> => {
    const supabase = createClient()
    const { data: subsData } = await supabase
      .from('submissions')
      .select(`
        id,
        student_id,
        score,
        max_score,
        submitted_at,
        student:students(full_name, parent_phone),
        answers:answers(question_id, is_correct, marks_awarded)
      `)
      .eq('exam_id', examId)
      .not('submitted_at', 'is', null)

    if (subsData && subsData.length > 0) {
      return subsData.map((s: any) => ({
        id: s.id,
        student_id: s.student_id,
        student_name: s.student?.full_name || 'طالب',
        parent_phone: s.student?.parent_phone || '',
        score: Number(s.score || 0),
        max_score: Number(s.max_score || 0),
        submitted_at: s.submitted_at,
        answers: s.answers || [],
      }))
    }

    // Mock submissions for testing if offline
    return [
      {
        id: 'sub-1',
        student_id: 'st-1',
        student_name: 'يوسف أحمد علي',
        parent_phone: '01012345678',
        score: 18,
        max_score: 20,
        submitted_at: new Date().toISOString(),
        answers: [],
      },
      {
        id: 'sub-2',
        student_id: 'st-2',
        student_name: 'ملك محمود إبراهيم',
        parent_phone: '01198765432',
        score: 14,
        max_score: 20,
        submitted_at: new Date().toISOString(),
        answers: [],
      },
    ]
  }

  // Make-up Handlers
  const handleCreateMakeupRequest = async (req: {
    student_id: string
    missed_occurrence_id: string
    target_occurrence_id: string
  }) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('makeup_requests').insert({
        teacher_id: user.id,
        student_id: req.student_id,
        missed_occurrence_id: req.missed_occurrence_id,
        target_occurrence_id: req.target_occurrence_id,
        status: 'pending',
      })
    }

    const st = students.find((s) => s.id === req.student_id)
    const missedOcc = occurrences.find((o) => o.id === req.missed_occurrence_id)
    const targetOcc = occurrences.find((o) => o.id === req.target_occurrence_id)
    const targetGrp = groups.find((g) => g.id === targetOcc?.group_id)

    setMakeupRequests((prev) => [
      {
        id: `mr-${Date.now()}`,
        student_id: req.student_id,
        student_name: st?.full_name || 'طالب',
        missed_occurrence_id: req.missed_occurrence_id,
        missed_date: missedOcc?.session_date || '',
        target_occurrence_id: req.target_occurrence_id,
        target_date: targetOcc?.session_date || '',
        target_group_name: targetGrp?.name || 'مجموعة بديلة',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  const handleUpdateMakeupStatus = async (
    requestId: string,
    newStatus: 'approved' | 'rejected'
  ) => {
    const supabase = createClient()
    await supabase.from('makeup_requests').update({ status: newStatus }).eq('id', requestId)

    setMakeupRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
    )
  }

  // Message Logging Handler
  const handleLogWhatsAppMessage = async (
    studentId: string,
    message: string,
    kind: 'absence' | 'result' | 'custom' = 'absence'
  ) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('message_log').insert({
        teacher_id: user.id,
        student_id: studentId,
        kind,
        body: message,
      })
    }

    const st = students.find((s) => s.id === studentId)
    setMessageLogs((prev) => [
      {
        id: `ml-${Date.now()}`,
        student_id: studentId,
        student_name: st?.full_name,
        kind,
        body: message,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  // Logout Handler
  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error(err)
      router.push('/login')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-sm">
          <Loader2 className="size-5 animate-spin text-[#1d5ca8]" />
          <span className="text-sm font-bold text-slate-700">جاري تحميل البيانات...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f6f8fb] text-[#17263b]">
      {/* Responsive Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        teacherName={teacherProfile.full_name}
        subject={teacherProfile.subject}
        isAdmin={teacherProfile.is_admin}
        onLogout={handleLogout}
        absenceAlertsCount={
          Object.values(absencesData).filter((a) => a.dates.length >= 3 || a.consecutive >= 2).length
        }
        pendingMakeupsCount={makeupRequests.filter((m) => m.status === 'pending').length}
        remindersCount={reminders.filter((r) => !r.completed).length}
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          teacherName={teacherProfile.full_name}
          activeTab={activeTab}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-4 sm:px-8 sm:py-6 pb-24 lg:pb-8">
          {/* Read-Only Status Banner if suspended or expired */}
          <TeacherStatusBanner status={teacherStatus} />

          {/* Tab Views */}
          {activeTab === 'الرئيسية' && (
            <DashboardView
              teacherName={teacherProfile.full_name}
              subject={teacherProfile.subject}
              groups={groups}
              students={students}
              occurrences={occurrences}
              absencesData={absencesData}
              makeupRequests={makeupRequests}
              exams={exams}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'المجموعات' && (
            <GroupsView
              groups={groups}
              onAddGroup={handleAddGroup}
              onUpdateGroup={handleUpdateGroup}
              onDeleteGroup={handleDeleteGroup}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'الطلاب' && (
            <StudentsView
              students={students}
              groups={groups}
              onAddStudent={handleAddStudent}
              onBatchImport={handleBatchImportStudents}
              onMoveStudent={handleMoveStudent}
              onDeleteStudent={handleDeleteStudent}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'الحضور والغياب' && (
            <AttendanceView
              groups={groups}
              students={students}
              occurrences={occurrences}
              absencesData={absencesData}
              reminders={reminders}
              onSaveAttendance={handleSaveAttendance}
              onToggleCancelOccurrence={handleToggleCancelOccurrence}
              onAddOccurrence={handleAddOccurrence}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'الغياب والتنبيهات' && (
            <AbsenceView
              students={students}
              absencesData={absencesData}
              teacherName={teacherProfile.full_name}
              subject={teacherProfile.subject}
              onLogWhatsAppMessage={handleLogWhatsAppMessage}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'الحصص التعويضية' && (
            <MakeupView
              requests={makeupRequests}
              students={students}
              groups={groups}
              occurrences={occurrences}
              onCreateRequest={handleCreateMakeupRequest}
              onUpdateStatus={handleUpdateMakeupStatus}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'التذكيرات' && (
            <RemindersView
              reminders={reminders}
              groups={groups}
              onAddReminder={handleAddReminder}
              onToggleReminder={handleToggleReminder}
              onDeleteReminder={handleDeleteReminder}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'بنك الأسئلة' && (
            <QuestionsView
              questions={questions}
              onAddQuestion={handleAddQuestion}
              onBatchAddQuestions={handleBatchAddQuestions}
              onDeleteQuestion={handleDeleteQuestion}
              onUploadImage={handleUploadImage}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'الاختبارات' && (
            <ExamsView
              exams={exams}
              groups={groups}
              questions={questions}
              students={students}
              teacherName={teacherProfile.full_name}
              onCreateExam={handleCreateExam}
              onToggleResultsRelease={handleToggleResultsRelease}
              onDeleteExam={handleDeleteExam}
              onFetchExamSubmissions={handleFetchExamSubmissions}
              onLogWhatsAppResult={(sId, msg) => handleLogWhatsAppMessage(sId, msg, 'result')}
              teacherStatus={teacherStatus}
            />
          )}

          {activeTab === 'التقارير' && (
            <ReportsView
              groups={groups}
              students={students}
              absencesData={absencesData}
              teacherName={teacherProfile.full_name}
              subject={teacherProfile.subject}
            />
          )}

          {activeTab === 'سجل الرسائل' && <MessageLogView logs={messageLogs} />}

          {activeTab === 'المشرف العام' && teacherProfile.is_admin && (
            <AdminView
              teachers={adminTeachers}
              onRefreshTeachers={loadData}
            />
          )}
        </main>

        {/* Phone Bottom Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenSidebar={() => setSidebarOpen(true)}
          absenceAlertsCount={
            Object.values(absencesData).filter((a) => a.dates.length >= 3 || a.consecutive >= 2).length
          }
        />
      </div>
    </div>
  )
}
