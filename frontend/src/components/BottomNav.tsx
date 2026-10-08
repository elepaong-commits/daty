import { NavLink } from 'react-router'

const ITEMS = [
  { to: '/', emoji: '🗺️', label: '메인' },
  { to: '/calendar', emoji: '📅', label: '캘린더' },
  { to: '/albums', emoji: '🖼️', label: '앨범' },
]

export function BottomNav() {
  return (
    <nav className="flex shrink-0 border-t border-sand bg-white pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
      {ITEMS.map(({ to, emoji, label }) => (
        <NavLink key={to} to={to} end className="flex flex-1 flex-col items-center gap-1">
          {({ isActive }) => (
            <>
              <span
                className={`flex h-8 items-center justify-center rounded-full text-[20px] leading-none ${
                  isActive ? 'w-[70.4px] bg-brand-soft' : 'w-16 opacity-60'
                }`}
              >
                {emoji}
              </span>
              <span className={`text-[11px] leading-normal font-semibold ${isActive ? 'text-brand' : 'text-faint'}`}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
