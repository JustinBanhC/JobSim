import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function KanbanCard({ app, onClick, isDragging }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: String(app.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
    backgroundColor: 'var(--color-bg-card)',
    borderColor: 'var(--color-border)',
    boxShadow: 'var(--shadow-card)',
  };

  const stale = daysSince(app.date_updated) >= 7;
  const activeStatuses = ['applied', 'screen_scheduled', 'interviewing'];
  const needsFollowUp = stale && activeStatuses.includes(app.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        group rounded-[var(--radius-lg)] border p-4 cursor-grab active:cursor-grabbing
        transition-all duration-200
        hover:border-black/12 dark:hover:border-white/12
        hover:shadow-[var(--shadow-md)]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
        ${isDragging ? 'shadow-[var(--shadow-md)] scale-[1.02] z-10 ring-2 ring-[var(--color-accent-muted)]' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight truncate leading-snug" style={{ color: 'var(--color-text-primary)' }}>
            {app.company}
          </p>
          <p className="text-[13px] mt-1 font-normal leading-snug truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {app.role}
          </p>
        </div>
        {needsFollowUp && (
          <span
            className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
            style={{
              backgroundColor: 'rgba(251, 191, 36, 0.12)',
              color: '#fbbf24',
              border: '1px solid rgba(251, 191, 36, 0.25)',
            }}
          >
            Follow up
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3.5 flex-wrap">
        {app.source && (
          <span
            className="text-[11px] font-semibold px-2 py-1 rounded-md"
            style={{
              backgroundColor: 'var(--color-accent-soft)',
              color: 'var(--color-accent-bright)',
            }}
          >
            {app.source}
          </span>
        )}
        {app.date_applied && (
          <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {new Date(app.date_applied).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {app.location && (
          <span className="text-[11px] font-medium truncate max-w-[150px]" style={{ color: 'var(--color-text-muted)' }}>
            {app.location}
          </span>
        )}
      </div>
    </div>
  );
}
