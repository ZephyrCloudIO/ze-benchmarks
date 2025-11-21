import { useState } from 'react';
import '../styles/EditableList.css';

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
    <div className="editable-list">
      <div className="list-header">
        <h4>{label}</h4>
        <button onClick={() => setIsAdding(true)} className="btn-add">
          + Add
        </button>
      </div>
      <ul className="list-items">
        {items.map((item, index) => (
          <li key={index} className="list-item">
            {editingIndex === index ? (
              <div className="list-item-edit">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <button onClick={handleSaveEdit} className="btn-save">Save</button>
                <button onClick={() => setEditingIndex(null)} className="btn-cancel">Cancel</button>
              </div>
            ) : (
              <>
                <span>{item}</span>
                <div className="list-item-actions">
                  <button onClick={() => handleEdit(index)} className="btn-edit" title="Edit">
                    ✏️
                  </button>
                  <button onClick={() => handleRemove(index)} className="btn-remove" title="Remove">
                    🗑️
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {isAdding && (
        <div className="list-add-form">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`New ${label.toLowerCase().replace(/s$/, '')}`}
            autoFocus
          />
          <button onClick={handleAdd} className="btn-save">Add</button>
          <button onClick={() => setIsAdding(false)} className="btn-cancel">Cancel</button>
        </div>
      )}
    </div>
  );
}
