import React, { useState, useEffect, useRef } from 'react';
import type { Supplier } from '../types';
import ThemeToggle from './ThemeToggle';

interface AppHeaderProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSupplierChange: (id: string) => void;
  isLoading: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ 
  suppliers, 
  selectedSupplierId, 
  onSupplierChange, 
  isLoading 
}) => {
  const [inputText, setInputText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = suppliers.find(s => s.id === selectedSupplierId);
    setInputText(selected ? selected.name : '');
  }, [selectedSupplierId, suppliers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        const selected = suppliers.find(s => s.id === selectedSupplierId);
        setInputText(selected ? selected.name : '');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedSupplierId, suppliers]);

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(inputText.toLowerCase())
  );

  return (
    <header className="bg-white dark:bg-card dark:border-b dark:border-border shadow-sm flex-shrink-0">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-primary">Đối Chiếu Công Nợ Phải Trả</h1>
        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-80" ref={dropdownRef}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (!isDropdownOpen) setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder={isLoading ? 'Đang tải NCC...' : 'Tìm kiếm và chọn NCC...'}
              className="w-full bg-slate-50 dark:bg-input border border-slate-300 dark:border-border text-slate-900 dark:text-foreground text-sm rounded-lg focus:ring-2 focus:ring-primary focus:border-primary block p-2.5"
              disabled={isLoading}
            />
            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-card rounded-md shadow-lg max-h-60 overflow-auto border border-slate-200 dark:border-border">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map(s => (
                    <div
                      key={s.id}
                      onClick={() => {
                        onSupplierChange(s.id);
                        setIsDropdownOpen(false);
                      }}
                      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-primary/20 p-2.5 text-sm"
                    >
                      {s.name}
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 text-sm text-slate-500 dark:text-muted-foreground">Không tìm thấy nhà cung cấp.</div>
                )}
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
