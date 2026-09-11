"use client";

import { useRef, useState, type ReactNode } from "react";
import type { CityResult } from "@/app/api/cities/route";

interface CitySearchProps {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (city: CityResult) => void;
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
}

/** A text field that suggests cities from the database but still accepts any name. */
export function CitySearch({ id, label, value, onChange, onPick, placeholder, required, hint }: CitySearchProps) {
  const [results, setResults] = useState<CityResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestRequest = useRef(0);

  function handleChange(text: string) {
    onChange(text);
    clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const request = ++latestRequest.current;
      const response = await fetch(`/api/cities?q=${encodeURIComponent(text)}`);
      if (!response.ok || request !== latestRequest.current) return;
      setResults(((await response.json()) as { results: CityResult[] }).results);
      setOpen(true);
    }, 200);
  }

  const listId = `${id}-suggestions`;
  const showList = open && results.length > 0;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
      />
      {showList && (
        <ul id={listId} className="suggestions" role="listbox">
          {results.map((city, i) => (
            <li key={`${city.name}-${city.lat}-${city.lng}-${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                // Keep focus in the input so blur doesn't close the list before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(city);
                  setOpen(false);
                }}
              >
                {city.name}
                <span>{city.countryName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
