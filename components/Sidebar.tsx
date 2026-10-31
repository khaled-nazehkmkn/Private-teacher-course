'use client'

import React from 'react'
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  ClipboardCheck,
  AlertTriangle,
  CalendarClock,
  BookOpen,
  BarChart3,
  FileText,
  MessageSquare,
  ShieldAlert,
  LogOut,
  X,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  badge?: number
  adminOnly?: boolean
}

interface SidebarProps {
  activeTab: string
  onSelectTab: (tab: string) => void
  isOpen: boolean
  onClose: () => void
  teacherName: string
  subject: string
  isAdmin: boolean
  onLogout: () => void
  absenceAlertsCount?: number
  pendingMakeupsCount?: number
}

export function Sidebar({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  teacherName,
  subject,
  isAdmin,
  onLogout,
  absenceAlertsCount = 0,
  pendingMakeupsCount = 0,
}: SidebarProps) {
  const navItems: NavItem[] = [
    { id: 'الرئيسية', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'المجموعات', label: 'المجموعات', icon: Users },
    { id: 'الطلاب', label: 'الطلاب', icon: GraduationCap },
    { id: 'الحضور والغياب', label: 'الحضور والغياب', icon: ClipboardCheck },
    {
      id: 'الغياب والتنبيهات',
      label: 'الغياب والتنبيهات',
      icon: AlertTriangle,
      badge: absenceAlertsCount > 0 ? absenceAlertsCount : undefined,
    },
    {
      id: 'الحصص التعويضية',
      label: 'الحصص التعويضية',
      icon: CalendarClock,
      badge: pendingMakeupsCount > 0 ? pendingMakeupsCount : undefined,
    },
    { id: 'بنك الأسئلة', label: 'بنك الأسئلة', icon: BookOpen },
    { id: 'الاختبارات', label: 'الاختبارات', icon: BarChart3 },
    { id: 'التقارير', label: 'التقارير', icon: FileText },
    { id: 'سجل الرسائل', label: 'سجل الرسائل', icon: MessageSquare },
  ]

  if (isAdmin) {
    navItems.push({
      id: 'المشرف العام',
      label: 'المشرف العام (Admin)',
      icon: ShieldAlert,
      adminOnly: true,
    })
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-64 flex-col justify-between border-l border-[#e6ebf2] bg-white p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div>
          {/* Logo and App Title */}
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-[#153b68] text-white shadow-md">
                <GraduationCap className="size-6" />
              </div>
              <div>
                <h1 className="text-base font-black text-[#153b68]">معلّم</h1>
                <p className="text-[11px] text-slate-400">إدارة الدروس الخصوصية</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              لوحة التحكم
            </p>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id)
                    onClose()
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                    isActive
                      ? 'bg-[#153b68] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`size-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#153b68]/10 text-xs font-black text-[#153b68]">
                {teacherName?.charAt(0) || 'م'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">
                  {teacherName || 'الأستاذ'}
                </p>
                <p className="truncate text-[10px] text-slate-400">{subject || 'مدرس المادة'}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              title="تسجيل الخروج"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
