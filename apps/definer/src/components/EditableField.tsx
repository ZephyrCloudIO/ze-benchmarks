import { useState } from 'react';
import { iconButton, inputBase, primaryButton, secondaryButton, textareaBase } from '../ui';

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
      <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
        {label && <label className="text-sm font-semibold text-slate-800">{label}</label>}
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={textareaBase}
            rows={4}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={inputBase}
            autoFocus
          />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={handleSave} className={primaryButton}>
            Save
          </button>
          <button onClick={handleCancel} className={secondaryButton}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {label && <label className="text-sm font-semibold text-slate-800">{label}</label>}
      <div className="flex items-start gap-3">
        <span className="flex-1 text-sm text-slate-800">
          {value ? value : <span className="italic text-slate-400">(empty)</span>}
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className={iconButton}
          title="Edit"
        >
          ✏️
        </button>
      </div>
    </div>
  );
}
