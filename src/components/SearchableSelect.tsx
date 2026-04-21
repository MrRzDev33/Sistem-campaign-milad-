import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Option {
  id: string;
  nama: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Pilih...", 
  label,
  required = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

  const filteredOptions = options.filter(opt => 
    opt.nama.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2" ref={containerRef}>
      {label && (
        <label className="text-sm font-semibold text-gray-700 ml-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-left flex items-center justify-between transition-all outline-none",
            isOpen ? "ring-2 ring-orange-500 border-transparent" : "hover:border-gray-300",
            !selectedOption && "text-gray-400"
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.nama : placeholder}
          </span>
          <ChevronDown className={cn("w-5 h-5 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 border-b border-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Cari..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      "w-full px-5 py-3 text-left text-sm hover:bg-orange-50 transition-colors",
                      value === option.id ? "bg-orange-50 text-orange-600 font-bold" : "text-gray-700"
                    )}
                  >
                    {option.nama}
                  </button>
                ))
              ) : (
                <div className="px-5 py-4 text-sm text-gray-400 text-center">
                  Tidak ada hasil ditemukan
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
