import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical } from 'lucide-react';

export default function SortablePhotoItem({ photo, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="admin-image-item">
      {/* Drag Handle */}
      <div 
        className="admin-image-item__drag-handle" 
        {...attributes} 
        {...listeners}
      >
        <GripVertical size={16} />
      </div>

      <img 
        src={photo.thumbnailUrl || photo.imageUrl} 
        alt={photo.alt || ''} 
        onError={(e) => {
          if (e.target.src !== photo.imageUrl) {
            e.target.src = photo.imageUrl;
          }
        }}
      />
      
      <div className="admin-image-item__actions">
        <button
          className="admin-btn admin-btn--danger admin-btn--sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(photo);
          }}
          title="Delete Photo"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
