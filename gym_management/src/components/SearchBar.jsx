import React from 'react';
import { Search } from 'lucide-react';

export function SearchBar({ value, onChange, placeholder = 'Search...', onSearch }) {
  return (
    <div className="search-bar">
      <Search size={18} className="search-icon" />
      <input
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSearch) onSearch();
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

