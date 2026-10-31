export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      teachers: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          subject: string | null
          is_admin: boolean
          active_from: string | null
          active_to: string | null
          is_suspended: boolean
          absence_consecutive_limit: number
          absence_total_limit: number
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          phone?: string | null
          subject?: string | null
          is_admin?: boolean
          active_from?: string | null
          active_to?: string | null
          is_suspended?: boolean
          absence_consecutive_limit?: number
          absence_total_limit?: number
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          subject?: string | null
          is_admin?: boolean
          active_from?: string | null
          active_to?: string | null
          is_suspended?: boolean
          absence_consecutive_limit?: number
          absence_total_limit?: number
          created_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          teacher_id: string
          name: string
          grade: string
          capacity: number
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          name: string
          grade: string
          capacity?: number
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          name?: string
          grade?: string
          capacity?: number
          created_at?: string
        }
      }
      group_sessions: {
        Row: {
          id: string
          group_id: string
          weekday: number
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          group_id: string
          weekday: number
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          group_id?: string
          weekday?: number
          start_time?: string
          end_time?: string
        }
      }
      students: {
        Row: {
          id: string
          teacher_id: string
          group_id: string | null
          full_name: string
          parent_phone: string
          grade: string
          access_code: string
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          group_id?: string | null
          full_name: string
          parent_phone: string
          grade: string
          access_code: string
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          group_id?: string | null
          full_name?: string
          parent_phone?: string
          grade?: string
          access_code?: string
          created_at?: string
        }
      }
      session_occurrences: {
        Row: {
          id: string
          teacher_id: string
          group_id: string
          session_date: string
          start_time: string
          end_time: string
          status: 'held' | 'cancelled'
        }
        Insert: {
          id?: string
          teacher_id: string
          group_id: string
          session_date: string
          start_time: string
          end_time: string
          status?: 'held' | 'cancelled'
        }
        Update: {
          id?: string
          teacher_id?: string
          group_id?: string
          session_date?: string
          start_time?: string
          end_time?: string
          status?: 'held' | 'cancelled'
        }
      }
      attendance: {
        Row: {
          id: string
          teacher_id: string
          occurrence_id: string
          student_id: string
          status: 'present' | 'late' | 'absent' | 'excused'
          makeup_of: string | null
          note: string | null
        }
        Insert: {
          id?: string
          teacher_id: string
          occurrence_id: string
          student_id: string
          status: 'present' | 'late' | 'absent' | 'excused'
          makeup_of?: string | null
          note?: string | null
        }
        Update: {
          id?: string
          teacher_id?: string
          occurrence_id?: string
          student_id?: string
          status?: 'present' | 'late' | 'absent' | 'excused'
          makeup_of?: string | null
          note?: string | null
        }
      }
      makeup_requests: {
        Row: {
          id: string
          teacher_id: string
          student_id: string
          missed_occurrence_id: string
          target_occurrence_id: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          student_id: string
          missed_occurrence_id: string
          target_occurrence_id: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          student_id?: string
          missed_occurrence_id?: string
          target_occurrence_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          teacher_id: string
          type: 'mcq' | 'true_false' | 'short' | 'matching' | 'essay'
          body: string
          image_path: string | null
          options: Json | null
          correct: Json | null
          marks: number
          topic: string | null
          grade: string | null
          difficulty: string | null
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          type?: 'mcq' | 'true_false' | 'short' | 'matching' | 'essay'
          body: string
          image_path?: string | null
          options?: Json | null
          correct?: Json | null
          marks?: number
          topic?: string | null
          grade?: string | null
          difficulty?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          type?: 'mcq' | 'true_false' | 'short' | 'matching' | 'essay'
          body?: string
          image_path?: string | null
          options?: Json | null
          correct?: Json | null
          marks?: number
          topic?: string | null
          grade?: string | null
          difficulty?: string | null
          created_at?: string
        }
      }
      exams: {
        Row: {
          id: string
          teacher_id: string
          group_id: string | null
          grade: string | null
          title: string
          duration_min: number
          opens_at: string | null
          closes_at: string | null
          shuffle: boolean
          results_released: boolean
          public_token: string
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          group_id?: string | null
          grade?: string | null
          title: string
          duration_min?: number
          opens_at?: string | null
          closes_at?: string | null
          shuffle?: boolean
          results_released?: boolean
          public_token?: string
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          group_id?: string | null
          grade?: string | null
          title?: string
          duration_min?: number
          opens_at?: string | null
          closes_at?: string | null
          shuffle?: boolean
          results_released?: boolean
          public_token?: string
          created_at?: string
        }
      }
      exam_questions: {
        Row: {
          exam_id: string
          question_id: string
          position: number
          marks_override: number | null
        }
        Insert: {
          exam_id: string
          question_id: string
          position?: number
          marks_override?: number | null
        }
        Update: {
          exam_id?: string
          question_id?: string
          position?: number
          marks_override?: number | null
        }
      }
      submissions: {
        Row: {
          id: string
          teacher_id: string
          exam_id: string
          student_id: string
          started_at: string
          submitted_at: string | null
          score: number | null
          max_score: number | null
        }
        Insert: {
          id?: string
          teacher_id: string
          exam_id: string
          student_id: string
          started_at?: string
          submitted_at?: string | null
          score?: number | null
          max_score?: number | null
        }
        Update: {
          id?: string
          teacher_id?: string
          exam_id?: string
          student_id?: string
          started_at?: string
          submitted_at?: string | null
          score?: number | null
          max_score?: number | null
        }
      }
      answers: {
        Row: {
          submission_id: string
          question_id: string
          answer: Json | null
          is_correct: boolean | null
          marks_awarded: number | null
        }
        Insert: {
          submission_id: string
          question_id: string
          answer?: Json | null
          is_correct?: boolean | null
          marks_awarded?: number | null
        }
        Update: {
          submission_id?: string
          question_id?: string
          answer?: Json | null
          is_correct?: boolean | null
          marks_awarded?: number | null
        }
      }
      message_log: {
        Row: {
          id: string
          teacher_id: string
          student_id: string | null
          kind: 'absence' | 'result' | 'custom'
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          student_id?: string | null
          kind: 'absence' | 'result' | 'custom'
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          student_id?: string | null
          kind?: 'absence' | 'result' | 'custom'
          body?: string
          created_at?: string
        }
      }
    }
    Views: {
      student_absences: {
        Row: {
          teacher_id: string
          student_id: string
          session_date: string
          occurrence_id: string
        }
      }
    }
  }
}
