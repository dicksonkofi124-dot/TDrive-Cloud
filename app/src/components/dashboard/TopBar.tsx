import { HardDrive, LayoutGrid, Sun, Moon, Search, X, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useRef, useEffect } from 'react';

interface TopBarProps {
    currentFolderName: string;
    selectedIds: number[];
    onShowMoveModal: () => void;
    onBulkDownload: () => void;
    onBulkDelete: () => void;
    onDownloadFolder: () => void;
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    isSearching?: boolean;
    searchResultCount?: number;
}

export function TopBar({
    currentFolderName, selectedIds, onShowMoveModal, onBulkDownload, onBulkDelete,
    onDownloadFolder, viewMode, setViewMode, searchTerm, onSearchChange,
    isSearching = false, searchResultCount = 0
}: TopBarProps) {
    const { theme, toggleTheme } = useTheme();
    const searchRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcut: Cmd+F / Ctrl+F focuses search
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <header
            className="h-14 border-b border-telegram-border flex items-center px-4 justify-between bg-telegram-surface/80 backdrop-blur-md sticky top-0 z-10"
            onClick={e => e.stopPropagation()}
        >
            {/* Left: Breadcrumb */}
            <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center text-sm text-telegram-subtext select-none shrink-0">
                    <span className="hover:text-telegram-text cursor-pointer transition-colors">Start</span>
                    <span className="mx-2">/</span>
                    <span className="text-telegram-text font-medium truncate max-w-[140px]">{currentFolderName}</span>
                </div>
            </div>

            {/* Center: Search */}
            <div className="flex-1 max-w-lg mx-4">
                <div className="relative">
                    {/* Search icon or spinner */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-telegram-subtext pointer-events-none">
                        {isSearching
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Search className="w-4 h-4" />
                        }
                    </div>

                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search all files… (⌘F)"
                        className="w-full bg-telegram-hover border border-telegram-border rounded-lg pl-9 pr-8 py-1.5 text-sm text-telegram-text placeholder:text-telegram-subtext focus:outline-none focus:border-telegram-primary/50 transition-colors"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />

                    {/* Clear button */}
                    {searchTerm && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-telegram-subtext hover:text-telegram-text transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Search result count badge */}
                {searchTerm.length > 2 && !isSearching && (
                    <div className="absolute mt-1 text-xs text-telegram-subtext px-1">
                        {searchResultCount === 0
                            ? 'No results found'
                            : `${searchResultCount} result${searchResultCount !== 1 ? 's' : ''} found`
                        }
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2 mr-4 animate-in fade-in slide-in-from-top-2">
                        <span className="text-xs text-telegram-subtext mr-2">{selectedIds.length} Selected</span>
                        <button
                            onClick={onShowMoveModal}
                            className="px-3 py-1.5 bg-telegram-primary/20 hover:bg-telegram-primary/30 text-telegram-primary rounded-md text-xs transition font-medium"
                        >
                            Move to...
                        </button>
                        <button
                            onClick={onBulkDownload}
                            className="px-3 py-1.5 bg-telegram-hover hover:bg-telegram-border rounded-md text-xs text-telegram-text transition"
                        >
                            Download
                        </button>
                        <button
                            onClick={onBulkDelete}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-xs transition"
                        >
                            Delete
                        </button>
                    </div>
                )}

                <button
                    onClick={onDownloadFolder}
                    className="p-2 hover:bg-telegram-hover rounded-md text-telegram-subtext hover:text-telegram-text transition group relative"
                    title="Download All Files"
                >
                    <HardDrive className="w-5 h-5" />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-telegram-surface border border-telegram-border px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        Download Folder
                    </span>
                </button>

                <button
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="p-2 hover:bg-telegram-hover rounded-md text-telegram-subtext hover:text-telegram-text transition relative group"
                    title="Toggle Layout"
                >
                    <LayoutGrid className="w-5 h-5" />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-telegram-surface border border-telegram-border px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        {viewMode === 'grid' ? 'List View' : 'Grid View'}
                    </span>
                </button>

                <div className="w-px h-6 bg-telegram-border mx-1" />

                <button
                    onClick={toggleTheme}
                    className="p-2 hover:bg-telegram-hover rounded-md text-telegram-subtext hover:text-telegram-text transition relative group"
                    title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-telegram-surface border border-telegram-border px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                </button>
            </div>
        </header>
    );
}
