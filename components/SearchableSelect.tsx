import React, { useState, useRef, useEffect } from 'react';

interface Option {
    id: string;
    label: string;
}

interface SearchableSelectProps {
    options: string[] | Option[];
    value: string | string[] | null | undefined;
    onChange: (value: any) => void;
    placeholder?: string;
    multiple?: boolean;
    label?: string;
    className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Seleccionar...',
    multiple = false,
    label,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const normalizedOptions: Option[] = options.map(opt =>
        typeof opt === 'string' ? { id: opt, label: opt } : opt
    );

    const searchLower = (searchTerm || '').toLowerCase().trim();
    const filteredOptions = normalizedOptions.filter(opt => {
        const label = String(opt?.label || '').toLowerCase();
        return label.includes(searchLower);
    });

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (option: Option) => {
        if (multiple) {
            const currentValues = Array.isArray(value) ? value : [];
            if (currentValues.includes(option.id)) {
                onChange(currentValues.filter(v => v !== option.id));
            } else {
                onChange([...currentValues, option.id]);
            }
        } else {
            onChange(option.id);
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    const getDisplayLabel = () => {
        if (multiple) {
            const currentValues = Array.isArray(value) ? value : [];
            if (currentValues.length === 0) return placeholder;
            if (currentValues.length === 1) return normalizedOptions.find(o => o.id === currentValues[0])?.label || currentValues[0];
            return `${currentValues.length} seleccionados`;
        } else {
            if (!value) return placeholder;
            return normalizedOptions.find(o => o.id === value)?.label || (value as string);
        }
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{label}</label>}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="input-field w-full cursor-pointer flex justify-between items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 min-h-[40px]"
            >
                <span className="truncate">{getDisplayLabel()}</span>
                <i className={`fas fa-chevron-down text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-h-64 overflow-hidden flex flex-col">
                    <div className="p-2 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <div className="relative">
                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                            <input
                                autoFocus
                                type="text"
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => {
                                const isSelected = multiple
                                    ? (Array.isArray(value) && value.includes(opt.id))
                                    : value === opt.id;

                                return (
                                    <div
                                        key={opt.id}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-between ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(opt);
                                        }}
                                    >
                                        <span className="truncate">{opt.label}</span>
                                        {isSelected && <i className="fas fa-check text-xs"></i>}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center italic">
                                No se encontraron resultados
                            </div>
                        )}
                    </div>
                    {multiple && (Array.isArray(value) && value.length > 0) && (
                        <div className="p-2 border-t dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">{value.length} seleccionados</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange([]);
                                }}
                                className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase"
                            >
                                Limpiar
                            </button>
                        </div>
                    )}
                </div>
            )}

            {multiple && Array.isArray(value) && value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {value.map(val => {
                        const opt = normalizedOptions.find(o => o.id === val);
                        return (
                            <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-full border border-indigo-200 dark:border-indigo-800">
                                {opt?.label || val}
                                <button
                                    onClick={() => onChange(value.filter(v => v !== val))}
                                    className="hover:text-red-500 transition-colors"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
