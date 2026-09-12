"use client";

interface CoordinateFieldsProps {
  /** Prefixes each field's id, so a page can hold more than one of these. */
  idPrefix: string;
  lat: string;
  lng: string;
  countryCode: string;
  onCoords: (lat: string, lng: string) => void;
  onCountryCode: (countryCode: string) => void;
}

/** Where a place sits: latitude, longitude and the country it counts as. */
export function CoordinateFields({ idPrefix, lat, lng, countryCode, onCoords, onCountryCode }: CoordinateFieldsProps) {
  return (
    <div className="form-row">
      <div className="field">
        <label htmlFor={`${idPrefix}-lat`}>Latitude</label>
        <input
          id={`${idPrefix}-lat`}
          className="input"
          inputMode="decimal"
          value={lat}
          onChange={(e) => onCoords(e.target.value, lng)}
          required
          placeholder="-9.2112"
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-lng`}>Longitude</label>
        <input
          id={`${idPrefix}-lng`}
          className="input"
          inputMode="decimal"
          value={lng}
          onChange={(e) => onCoords(lat, e.target.value)}
          required
          placeholder="-77.5466"
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-country`}>Country code</label>
        <input
          id={`${idPrefix}-country`}
          className="input"
          value={countryCode}
          onChange={(e) => onCountryCode(e.target.value.toUpperCase())}
          required
          maxLength={2}
          pattern="[A-Za-z]{2}"
          placeholder="PE"
        />
      </div>
    </div>
  );
}
