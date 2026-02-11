import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

export function NavItem({ icon: Icon, label, active, badge, to, onBeforeNavigate, testId }) {
  const handleClick = (event) => {
    if (!onBeforeNavigate) return
    const allowed = onBeforeNavigate()
    if (allowed === false) {
      event.preventDefault()
    }
  }

  return (
    <Link
      to={to}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      data-testid={testId}
      className={cn(
        'nav-pill w-full flex items-center gap-3 px-4 py-2.5 rounded-full transition-ui text-[11px] font-semibold group no-underline',
        active ? 'nav-pill-active text-slate-100' : 'text-slate-400 hover:text-slate-200'
      )}
    >
      <Icon
        size={20}
        className={cn('', active ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300')}
        aria-hidden="true"
      />
      <span className="font-display uppercase tracking-[0.26em] text-[11px] leading-none">
        {label}
      </span>

      {badge && (
        <span
          className={cn(
            'ml-auto tag-chip tag-chip-muted tabular-nums',
            active ? 'text-slate-100' : 'text-slate-300'
          )}
        >
          {badge}
        </span>
      )}
      {!active && !badge && (
        <ChevronRight
          size={14}
          className="ml-auto opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0 transition-ui"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}
