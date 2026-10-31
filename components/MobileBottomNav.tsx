'use client'

import React from 'react'
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  GraduationCap,
  Menu,
  AlertTriangle,
} from 'lucide-react'

interface Props {
  activeTab: string
  onSelectTab: (tab: string) => void
  onOpenSidebar: () => void
  absenceAlertsCount?: number
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenSidebar,
  absenceAlertsCount = 0,
}: Props) {
  const primaryTabs = [
    { id: 'الرئيسية', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'المجموعات', label: 'المجموعات', icon: Users },
    { id: 'الحضور والغياب', label: 'الحضور', icon: ClipboardCheck },
    { id: 'الطلاب', label: 'الطلاب', icon: GraduationCap },
  ]

  const isMoreActive = !primaryTabs.some((t) => t.id === activeTab)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-slate-200/80 bg-white/95 px-2 backdrop-blur-md lg:hidden">
      {primaryTabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-1 text-[11px] font-bold transition active:scale-95 ${
              isActive ? 'text-[#1d5ca8]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`grid size-7 place-items-center rounded-xl transition ${isActive ? 'bg-[#eaf2ff] text-[#1d5ca8]' : ''}`}>
              <Icon className="size-4" />
            </div>
            <span>{tab.label}</span>
          </button>
        )
      })}

      {/* More / Menu Drawer Toggle */}
      <button
        onClick={onOpenSidebar}
        className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1 text-[11px] font-bold transition active:scale-95 ${
          isMoreActive ? 'text-[#1d5ca8]' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <div className={`grid size-7 place-items-center rounded-xl transition ${isMoreActive ? 'bg-[#eaf2ff] text-[#1d5ca8]' : ''}`}>
          <Menu className="size-4" />
        </div>
        <span>المزيد</span>

        {absenceAlertsCount > 0 && (
          <span className="absolute top-1 right-3 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
        )}
      </button>
    </nav>
  )
}
