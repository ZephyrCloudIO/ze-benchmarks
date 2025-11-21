import { useState } from 'react';
import '../styles/EditableField.css';

interface EditableFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  multiline?: boolean;
  label?: string;
}

export default function EditableField({ value, onSave, multiline = false, label }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="editable-field editing">
        {label && <label className="field-label">{label}</label>}
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="field-input"
            rows={4}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="field-input"
            autoFocus
          />
        )}
        <div className="field-actions">
          <button onClick={handleSave} className="btn-save">
            Save
          </button>
          <button onClick={handleCancel} className="btn-cancel">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editable-field">
      {label && <label className="field-label">{label}</label>}
      <div className="field-display">
        <span className="field-value">{value || '(empty)'}</span>
        <button
          onClick={() => setIsEditing(true)}
          className="btn-edit"
          title="Edit"
        >
          ✏️
        </button>
      </div>
    </div>
  );
}
