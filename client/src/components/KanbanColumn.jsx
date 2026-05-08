import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import KanbanCard from './KanbanCard';
import AddApplicationForm from './AddApplicationForm';

export default function KanbanColumn({ column, cards, onCardClick, onCreate }) {
  const [showAdd, setShowAdd] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col min-w-[292px] w-[292px] rounded-[var(--radius-xl)] border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3.5 border-b"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'color-mix(in srgb, var(--color-bg-card) 35%, transparent)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/10"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="text-[13px] font-semibold tracking-tight truncate" style={{ color: 'var(--color-text-primary)' }}>
            {column.label}
          </h3>
          <span
            className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md shrink-0 min-w-[1.5rem] text-center"
            style={{
              backgroundColor: 'var(--color-bg-hover)',
              color: 'var(--color-text-muted)',
            }}
          >
            {cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-xl font-light leading-none cursor-pointer transition-transform hover:scale-105 active:scale-95"
          style={{
            color: '#faf8ff',
            background: 'linear-gradient(180deg, var(--color-accent-bright) 0%, var(--color-accent) 100%)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.2) inset',
          }}
          title="Add application to this column"
          aria-label={`Add application to ${column.label}`}
        >
          +
        </button>
      </div>

      <div
        className="flex-1 flex flex-col gap-3 px-3 py-3 overflow-y-auto transition-colors min-h-[120px] rounded-b-[var(--radius-xl)]"
        style={{
          backgroundColor: isOver ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
        }}
      >
        {showAdd && (
          <AddApplicationForm
            defaultStatus={column.id}
            onSubmit={(data) => {
              onCreate(data);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}
        {cards.map((card) => (
          <KanbanCard key={card.id} app={card} onClick={() => onCardClick(card)} />
        ))}
      </div>
    </div>
  );
}
