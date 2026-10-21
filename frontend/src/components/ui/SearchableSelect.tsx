// src/components/ui/SearchableSelect.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check, Plus } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  group?: string;
  colorSwatch?: string;
  avatarUri?: string;
}

interface SearchableSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
  error?: string;
  clearable?: boolean;
  actionButton?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '— Select —',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
  label,
  required,
  error,
  clearable = true,
  actionButton,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placeAbove: boolean;
  }>({
    top: 0,
    left: 0,
    width: 280,
    placeAbove: false,
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  );

  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownMaxHeight = 290;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < dropdownMaxHeight && rect.top > dropdownMaxHeight;

      const triggerWidth = rect.width;
      const width = Math.min(Math.max(triggerWidth, 260), window.innerWidth - 24);
      let left = rect.left;

      // Ensure dropdown does not overflow right side of window
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }
      if (left < 12) {
        left = 12;
      }

      setCoords({
        top: placeAbove ? rect.top : rect.bottom,
        left,
        width,
        placeAbove,
      });
    }
  }, []);

  // Update position when opening or scrolling
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 40);

      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, updatePosition]);

  // Click outside listener that accounts for both trigger and portaled menu
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter(
      (opt) =>
        String(opt?.label || '').toLowerCase().includes(query) ||
        (opt?.sublabel && String(opt.sublabel).toLowerCase().includes(query)) ||
        (opt?.group && String(opt.group).toLowerCase().includes(query)) ||
        (opt?.colorSwatch && String(opt.colorSwatch).toLowerCase().includes(query))
    );
  }, [options, search]);

  // Group options if any option has a group
  const grouped = useMemo(() => {
    const hasGroups = filteredOptions.some((o) => !!o.group);
    if (!hasGroups) return { ungrouped: filteredOptions };

    const map: Record<string, SelectOption[]> = {};
    filteredOptions.forEach((opt) => {
      const g = opt.group || 'Other';
      if (!map[g]) map[g] = [];
      map[g].push(opt);
    });
    return map;
  }, [filteredOptions]);

  const handleSelect = (val: string | number) => {
    onChange(String(val));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={`flex flex-col gap-1 relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-medium text-slate-600 flex items-center gap-0.5">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[34px] px-2.5 py-1.5 text-xs bg-white border rounded-md flex items-center justify-between gap-1.5 transition-all cursor-pointer select-none ${
          disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
            : isOpen
            ? 'border-brand-500 ring-2 ring-brand-100 shadow-sm'
            : error
            ? 'border-red-400'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex-1 min-w-0">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {selectedOption.avatarUri && (
                <img
                  src={selectedOption.avatarUri}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                />
              )}
              {selectedOption.colorSwatch && (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-xs"
                  style={{ backgroundColor: selectedOption.colorSwatch }}
                />
              )}
              <span className="font-semibold text-slate-800 truncate">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}

      {/* Dropdown Menu: Mobile Bottom Sheet or Desktop Popover */}
      {isOpen &&
        createPortal(
          isMobile ? (
            <div className="fixed inset-0 z-[99999] flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              {/* Tap backdrop to dismiss */}
              <div 
                className="fixed inset-0" 
                onClick={() => setIsOpen(false)} 
              />
              <div
                ref={dropdownRef}
                className="relative z-10 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[82vh] w-full border-t border-slate-200 overflow-hidden"
              >
                {/* Mobile Handle & Header */}
                <div className="flex flex-col items-center pt-2 pb-1.5 bg-slate-50 border-b border-slate-200 px-4 shrink-0">
                  <div className="w-10 h-1.5 rounded-full bg-slate-300 mb-2" />
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {label || placeholder}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Search Input */}
                <div className="p-3 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full text-sm bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-slate-800 placeholder:text-slate-400 font-medium"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Mobile Options List */}
                <div className="overflow-y-auto max-h-[52vh] p-2 divide-y divide-slate-100 pb-8 touch-scroll">
                  {filteredOptions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-medium">No matching results found</div>
                  ) : 'ungrouped' in grouped ? (
                    <>
                      {grouped.ungrouped.slice(0, 80).map((opt) => {
                        const isSelected = String(opt.value) === String(value);
                        return (
                          <div
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            className={`px-3 py-2.5 text-xs rounded-lg cursor-pointer flex items-center justify-between gap-2.5 transition-colors active:bg-slate-100 ${
                              isSelected
                                ? 'bg-brand-50 text-brand-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {opt.avatarUri && (
                                <img
                                  src={opt.avatarUri}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                                />
                              )}
                              {opt.colorSwatch && (
                                <span
                                  className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-xs"
                                  style={{ backgroundColor: opt.colorSwatch }}
                                />
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-xs font-semibold">{opt.label}</span>
                                {opt.sublabel && (
                                  <span className="text-[10px] text-slate-400 truncate mt-0.5">{opt.sublabel}</span>
                                )}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
                          </div>
                        );
                      })}
                      {grouped.ungrouped.length > 80 && (
                        <div className="px-3 py-2 text-[10px] text-slate-400 text-center bg-slate-50 border-t border-slate-100">
                          Showing first 80 matches. Type to filter results.
                        </div>
                      )}
                    </>
                  ) : (
                    Object.entries(grouped).map(([grp, items]) => (
                      <div key={grp} className="pt-2 first:pt-0">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-y border-slate-100/80">
                          {grp}
                        </div>
                        {items.slice(0, 50).map((opt) => {
                          const isSelected = String(opt.value) === String(value);
                          return (
                            <div
                              key={opt.value}
                              onClick={() => handleSelect(opt.value)}
                              className={`px-3 py-2.5 text-xs rounded-lg cursor-pointer flex items-center justify-between gap-2.5 transition-colors active:bg-slate-100 ${
                                isSelected
                                  ? 'bg-brand-50 text-brand-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {opt.avatarUri && (
                                  <img
                                    src={opt.avatarUri}
                                    alt=""
                                    className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                                  />
                                )}
                                {opt.colorSwatch && (
                                  <span
                                    className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-xs"
                                    style={{ backgroundColor: opt.colorSwatch }}
                                  />
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate text-xs font-semibold">{opt.label}</span>
                                  {opt.sublabel && (
                                    <span className="text-[10px] text-slate-400 truncate mt-0.5">{opt.sublabel}</span>
                                  )}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Mobile Action Button */}
                {actionButton && (
                  <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        actionButton.onClick();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition active:scale-[0.99]"
                    >
                      {actionButton.icon || <Plus className="w-4 h-4" />}
                      <span>{actionButton.label}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              ref={dropdownRef}
              style={{
                position: 'fixed',
                top: coords.placeAbove ? 'auto' : `${coords.top + 4}px`,
                bottom: coords.placeAbove ? `${window.innerHeight - coords.top + 4}px` : 'auto',
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                zIndex: 99999,
              }}
              className="bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col min-w-[280px] max-w-[90vw]"
            >
              {/* Search Bar */}
              <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full text-xs bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-slate-800 placeholder:text-slate-400 font-medium"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Options List */}
              <div className="max-h-64 overflow-y-auto p-1 divide-y divide-slate-50">
                {filteredOptions.length === 0 ? (
                  <div className="py-5 text-center text-xs text-slate-400">No matching results found</div>
                ) : 'ungrouped' in grouped ? (
                  <>
                    {grouped.ungrouped.slice(0, 80).map((opt) => {
                      const isSelected = String(opt.value) === String(value);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => handleSelect(opt.value)}
                          className={`px-3 py-2 text-xs rounded-md cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                            isSelected
                              ? 'bg-brand-50 text-brand-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {opt.avatarUri && (
                              <img
                                src={opt.avatarUri}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                              />
                            )}
                            {opt.colorSwatch && (
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-xs"
                                style={{ backgroundColor: opt.colorSwatch }}
                              />
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{opt.label}</span>
                              {opt.sublabel && (
                                <span className="text-[10px] text-slate-400 truncate mt-0.5">{opt.sublabel}</span>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                        </div>
                      );
                    })}
                    {grouped.ungrouped.length > 80 && (
                      <div className="px-3 py-1.5 text-[10px] text-slate-400 text-center bg-slate-50 border-t border-slate-100">
                        Showing first 80 of {grouped.ungrouped.length.toLocaleString()} matches. Type to narrow search.
                      </div>
                    )}
                  </>
                ) : (
                  Object.entries(grouped).map(([grp, items]) => (
                    <div key={grp} className="pt-2 first:pt-0">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-y border-slate-100/80">
                        {grp}
                      </div>
                      {items.slice(0, 50).map((opt) => {
                        const isSelected = String(opt.value) === String(value);
                        return (
                          <div
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            className={`px-3 py-2 text-xs rounded-md cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                              isSelected
                                ? 'bg-brand-50 text-brand-700 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {opt.avatarUri && (
                                <img
                                  src={opt.avatarUri}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                                />
                              )}
                              {opt.colorSwatch && (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-xs"
                                  style={{ backgroundColor: opt.colorSwatch }}
                                />
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{opt.label}</span>
                                {opt.sublabel && (
                                  <span className="text-[10px] text-slate-400 truncate mt-0.5">{opt.sublabel}</span>
                                )}
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Action Button (e.g. + Add Color) */}
              {actionButton && (
                <div className="p-1.5 border-t border-slate-100 bg-slate-50/70">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      actionButton.onClick();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-white hover:bg-brand-50 border border-brand-200 rounded-md transition-colors"
                  >
                    {actionButton.icon || <Plus className="w-3.5 h-3.5" />}
                    <span>{actionButton.label}</span>
                  </button>
                </div>
              )}
            </div>
          ),
          document.body
        )}
    </div>
  );
}
