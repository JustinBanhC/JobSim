import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { COLUMNS } from '../hooks/useApplications';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import ApplicationModal from './ApplicationModal';

export default function KanbanBoard({ grouped, onMove, onCreate, onUpdate, onDelete }) {
  const [activeCard, setActiveCard] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function findColumn(id) {
    if (COLUMNS.find(c => c.id === id)) return id;
    for (const [status, cards] of Object.entries(grouped)) {
      if (cards.find(c => c.id === Number(id))) return status;
    }
    return null;
  }

  function handleDragStart(event) {
    const card = Object.values(grouped).flat().find(c => c.id === Number(event.active.id));
    setActiveCard(card || null);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = Number(active.id);
    const overColumn = findColumn(over.id);
    if (!overColumn) return;

    const overCards = grouped[overColumn] || [];
    let newPosition;

    if (COLUMNS.find(c => c.id === over.id)) {
      newPosition = overCards.length;
    } else {
      const overIndex = overCards.findIndex(c => c.id === Number(over.id));
      newPosition = overIndex >= 0 ? overIndex : overCards.length;
    }

    onMove(activeId, overColumn, newPosition);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6 px-4 md:px-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {COLUMNS.map(col => (
            <SortableContext
              key={col.id}
              items={grouped[col.id]?.map(c => String(c.id)) || []}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                column={col}
                cards={grouped[col.id] || []}
                onCardClick={setSelectedApp}
                onCreate={onCreate}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay>
          {activeCard && <KanbanCard app={activeCard} isDragging />}
        </DragOverlay>
      </DndContext>

      {selectedApp && (
        <ApplicationModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
