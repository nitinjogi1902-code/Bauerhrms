import { useEffect, useState } from "react";
import {
  formatDate,
  getDateInputPlaceholder,
  toISODate,
} from "./dateUtils";
import "./DateField.css";

export default function DateField({
  value = "",
  onChange,
  name,
  id,
  className = "",
  placeholder,
  disabled = false,
  required = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!editing) {
      setDraft(value ? formatDate(value) : "");
    }
  }, [value, editing]);

  const commit = (raw) => {
    const text = String(raw || "").trim();

    if (!text) {
      onChange?.({ target: { name, value: "" } });
      setEditing(false);
      return;
    }

    const iso = toISODate(text);

    if (!iso) {
      return;
    }

    onChange?.({ target: { name, value: iso } });
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        id={id}
        name={name}
        type="text"
        className={`hrsync-date-input ${className}`}
        value={draft}
        placeholder={placeholder || getDateInputPlaceholder()}
        disabled={disabled}
        required={required}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === "Escape") {
            setDraft(value ? formatDate(value) : "");
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div className={`hrsync-date-field ${className}`}>
      <button
        type="button"
        className={`hrsync-date-display ${value ? "" : "is-empty"}`}
        disabled={disabled}
        onClick={() => {
          setDraft(value ? formatDate(value) : "");
          setEditing(true);
        }}
      >
        {value ? formatDate(value) : placeholder || getDateInputPlaceholder()}
      </button>

      <input
        type="date"
        className="hrsync-native-date-picker"
        value={value || ""}
        disabled={disabled}
        required={required}
        tabIndex={-1}
        onChange={(e) => {
          onChange?.({ target: { name, value: e.target.value } });
        }}
      />
    </div>
  );
}
