import { useState } from 'react';
import { iconButton, inputBase, primaryButton, secondaryButton, successButton } from '../ui';

interface EditableListProps {
  items: string[];
  onUpdate: (items: string[]) => void;
  label: string;
}

export default function EditableList({ items, onUpdate, label }: EditableListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onUpdate([...items, newItem.trim()]);
      setNewItem('');
      setIsAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = editValue;
      onUpdate(updated);
      setEditingIndex(null);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
        <button onClick={() => setIsAdding(true)} className={successButton}>
          + Add
        </button>
      </div>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition hover:border-blue-200">
            {editingIndex === index ? (
              <div className="flex w-full items-center gap-3">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={inputBase}
                  autoFocus
                />
                <button onClick={handleSaveEdit} className={primaryButton}>Save</button>
                <button onClick={() => setEditingIndex(null)} className={secondaryButton}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="text-sm text-slate-800">{item}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(index)} className={iconButton} title="Edit">
                    ✏️
                  </button>
                  <button
                    onClick={() => handleRemove(index)}
                    className={`${iconButton} text-red-500 hover:bg-red-50 hover:text-red-600`}
                    title="Remove"
                  >
                    🗑️
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {isAdding && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 md:flex-row md:items-center">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`New ${label.toLowerCase().replace(/s$/, '')}`}
            className={inputBase}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className={primaryButton}>Add</button>
            <button onClick={() => setIsAdding(false)} className={secondaryButton}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
