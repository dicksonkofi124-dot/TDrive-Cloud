import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

import { TelegramFile, BandwidthStats } from '../types';
import { formatBytes, isMediaFile, isPdfFile } from '../utils';

// Components
import { Sidebar } from './dashboard/Sidebar';
import { TopBar } from './dashboard/TopBar';
import { FileExplorer } from './dashboard/FileExplorer';
import { UploadQueue } from './dashboard/UploadQueue';
import { DownloadQueue } from './dashboard/DownloadQueue';
import { MoveToFolderModal } from './dashboard/MoveToFolderModal';
import { MediaPlayer } from './dashboard/MediaPlayer';
import { DragDropOverlay } from './dashboard/DragDropOverlay';
import { ExternalDropBlocker } from './dashboard/ExternalDropBlocker';
import { PdfViewer } from './dashboard/PdfViewer';

// Hooks
import { useTelegramConnection } from '../hooks/useTelegramConnection';
import { useFileOperations } from '../hooks/useFileOperations';
import { useFileUpload } from '../hooks/useFileUpload';
import { useFileDownload } from '../hooks/useFileDownload';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// ── CineHub Bridge Config ──────────────────────────────────────────────────────
// New bridge server URL (streaming server)
const CINEHUB_BRIDGE = 'https://cinehub-bridge.onrender.com';
// Old bridge server URL (TDrive share format - kept for reference/backward compat)
const OLD_BRIDGE = 'https://cinehub-bridge-server.onrender.com';

export function Dashboard({ onLogout }: { onLogout: () => void }) {
    const queryClient = useQueryClient();

    const {
        store, folders, activeFolderId, setActiveFolderId, isSyncing, isConnected,
        handleLogout, handleSyncFolders, handleCreateFolder, handleFolderDelete
    } = useTelegramConnection(onLogout);

    const [previewFile, setPreviewFile] = useState<TelegramFile | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<TelegramFile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [internalDragFileId, _setInternalDragFileId] = useState<number | null>(null);
    const internalDragRef = useRef<number | null>(null);

    // ── CineHub Share Modal State ──────────────────────────────────────────────
    const [shareModalFile, setShareModalFile] = useState<TelegramFile | null>(null);
    const [shareModalKey, setShareModalKey] = useState('');
    const [shareModalUrl, setShareModalUrl] = useState('');
    const [shareModalOpen, setShareModalOpen] = useState(false);

    const setInternalDragFileId = (id: number | null) => {
        internalDragRef.current = id;
        _setInternalDragFileId(id);
    };

    const [playingFile, setPlayingFile] = useState<TelegramFile | null>(null);
    const [pdfFile, setPdfFile] = useState<TelegramFile | null>(null);
    const [previewContextFiles, setPreviewContextFiles] = useState<TelegramFile[]>([]);
    const [previewContextIndex, setPreviewContextIndex] = useState(-1);

    useEffect(() => {
        if (store) {
            store.get<'grid' | 'list'>('viewMode').then((saved) => {
                if (saved) setViewMode(saved);
            });
        }
    }, [store]);

    useEffect(() => {
        if (store) {
            store.set('viewMode', viewMode).then(() => store.save());
        }
    }, [store, viewMode]);

    const { data: allFiles = [], isLoading, error } = useQuery({
        queryKey: ['files', activeFolderId],
        queryFn: () => invoke<any[]>('cmd_get_files', { folderId: activeFolderId }).then(res => res.map(f => ({
            ...f,
            sizeStr: formatBytes(f.size),
            type: f.icon_type || (f.name.endsWith('/') ? 'folder' : 'file')
        }))),
        enabled: !!store,
    });

    const displayedFiles = searchTerm.length > 2
        ? searchResults
        : allFiles.filter((f: TelegramFile) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const { data: bandwidth } = useQuery({
        queryKey: ['bandwidth'],
        queryFn: () => invoke<BandwidthStats>('cmd_get_bandwidth'),
        refetchInterval: 5000,
        enabled: !!store
    });

    const {
        handleDelete,
        handleBulkDelete, handleBulkDownload,
        handleBulkMove, handleDownloadFolder, handleGlobalSearch
    } = useFileOperations(activeFolderId, selectedIds, setSelectedIds, displayedFiles);

    const { uploadQueue, setUploadQueue, handleManualUpload, cancelAll: cancelUploads, cancelItem: cancelUploadItem, retryItem: retryUploadItem, isDragging } = useFileUpload(activeFolderId, store);
    const { downloadQueue, clearFinished: clearDownloads, cancelAll: cancelDownloads, cancelItem: cancelDownloadItem, retryItem: retryDownloadItem } = useFileDownload(store);

    const handleSelectAll = useCallback(() => {
        setSelectedIds(displayedFiles.map(f => f.id));
    }, [displayedFiles]);

    const handleKeyboardDelete = useCallback(() => {
        if (selectedIds.length > 0) {
            handleBulkDelete();
        }
    }, [selectedIds, handleBulkDelete]);

    const handleEscape = useCallback(() => {
        setSelectedIds([]);
        setSearchTerm('');
        setPreviewFile(null);
        setPlayingFile(null);
        setPdfFile(null);
        setShareModalOpen(false);
    }, []);

    const handleFocusSearch = useCallback(() => {
        const searchInput = document.querySelector('input[placeholder="Search files..."]') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }, []);

    const handleEnter = useCallback(() => {
        if (selectedIds.length === 1) {
            const selected = displayedFiles.find(f => f.id === selectedIds[0]);
            if (selected) {
                if (selected.type === 'folder') {
                    setActiveFolderId(selected.id);
                } else {
                    handlePreview(selected, displayedFiles);
                }
            }
        }
    }, [selectedIds, displayedFiles, setActiveFolderId]);

    useKeyboardShortcuts({
        onSelectAll: handleSelectAll,
        onDelete: handleKeyboardDelete,
        onEscape: handleEscape,
        onSearch: handleFocusSearch,
        onEnter: handleEnter,
        enabled: !previewFile && !playingFile && !pdfFile && !showMoveModal && !shareModalOpen
    });

    useEffect(() => {
        setSelectedIds([]);
        setShowMoveModal(false);
        setSearchTerm('');
        setSearchResults([]);
        setPreviewFile(null);
        setPlayingFile(null);
        setPdfFile(null);
        setPreviewContextFiles([]);
        setPreviewContextIndex(-1);
    }, [activeFolderId]);

    useEffect(() => {
        if (searchTerm.length <= 2) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            const results = await handleGlobalSearch(searchTerm);
            setSearchResults(results);
            setIsSearching(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handlePreview = (file: TelegramFile, orderedFiles?: TelegramFile[]) => {
        const contextFiles = (orderedFiles || displayedFiles).filter((f) => f.type !== 'folder');
        const contextIndex = contextFiles.findIndex((f) => f.id === file.id);
        setPreviewContextFiles(contextFiles);
        setPreviewContextIndex(contextIndex);

        const isMedia = isMediaFile(file.name);
        const isPdf = isPdfFile(file.name);

        if (isMedia) {
            setPlayingFile(file);
            setPreviewFile(null);
            setPdfFile(null);
        } else if (isPdf) {
            setPdfFile(file);
            setPreviewFile(null);
            setPlayingFile(null);
        } else {
            setPreviewFile(file);
            setPlayingFile(null);
            setPdfFile(null);
        }
    };

    // ── SHARE HANDLER (CineHub Bridge) ─────────────────────────────────────────
    const handleShare = async (file: TelegramFile) => {
        const messageId = file.message_id || file.id;
        const folderId = activeFolderId;

        // Suggest a movie key from the filename
        const suggestedKey = file.name
            .toLowerCase()
            .replace(/\.(mkv|mp4|avi|mov|webm|flv|wmv)$/i, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);

        setShareModalFile(file);
        setShareModalKey(suggestedKey);
        setShareModalUrl(`${CINEHUB_BRIDGE}/download/${suggestedKey}`);
        setShareModalOpen(true);
    };

    const handleShareConfirm = async () => {
        if (!shareModalFile) return;
        const messageId = shareModalFile.message_id || shareModalFile.id;
        const finalKey = shareModalKey.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const finalUrl = `${CINEHUB_BRIDGE}/download/${finalKey}`;

        try {
            await navigator.clipboard.writeText(finalUrl);
            toast.success('✅ CineHub link copied!', {
                description: `${finalKey} → ${finalUrl}`,
            });
            setShareModalOpen(false);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = finalUrl;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast.success('CineHub link copied!');
            setShareModalOpen(false);
        }
    };

    // ── DOWNLOAD HANDLER ───────────────────────────────────────────────────────
    const handleDownload = async (file: TelegramFile) => {
        try {
            const info = await invoke<any>('cmd_get_stream_info');
            if (!info || !info.base_url) throw new Error('Streaming server not ready');
            const folderParam = activeFolderId ?? 'home';
            const directLink = `${info.base_url}/download/${folderParam}/${file.id}?token=${info.token}`;
            const managerUrl = `https://cinehub-jet-ten.vercel.app/download.html?link=${encodeURIComponent(directLink)}`;
            window.open(managerUrl, '_blank');
            toast.success('Opening Download Manager', { description: file.name });
        } catch (error: any) {
            toast.error('Failed to open download manager', { description: error?.message });
        }
    };

    // ── RENAME HANDLER ─────────────────────────────────────────────────────────
    const handleRename = async (file: TelegramFile) => {
        const newName = prompt(`Rename "${file.name}" to:`, file.name);
        if (!newName || newName === file.name) return;
        try {
            await invoke('cmd_rename_file', {
                messageId: file.id,
                newName: newName,
                folderId: activeFolderId
            });
            queryClient.invalidateQueries({ queryKey: ['files', activeFolderId] });
            toast.success(`Renamed to "${newName}"`);
        } catch (error: any) {
            toast.error(`Rename failed: ${error}`);
        }
    };

    // ── DELETE HANDLER ─────────────────────────────────────────────────────────
    const handleDeleteFile = async (id: number) => {
        await handleDelete(id);
    };

    const navigatePreview = useCallback((step: 1 | -1) => {
        if (previewContextFiles.length === 0) return;
        const currentFileId = previewFile?.id ?? playingFile?.id ?? pdfFile?.id;
        if (!currentFileId) return;
        const currentIndex = previewContextFiles.findIndex((f) => f.id === currentFileId);
        if (currentIndex === -1) return;
        const nextIndex = (currentIndex + step + previewContextFiles.length) % previewContextFiles.length;
        const nextFile = previewContextFiles[nextIndex];
        if (!nextFile) return;
        setPreviewContextIndex(nextIndex);
        const isMedia = isMediaFile(nextFile.name);
        const isPdf = isPdfFile(nextFile.name);
        if (isMedia) { setPlayingFile(nextFile); setPreviewFile(null); setPdfFile(null); }
        else if (isPdf) { setPdfFile(nextFile); setPreviewFile(null); setPlayingFile(null); }
        else { setPreviewFile(nextFile); setPlayingFile(null); setPdfFile(null); }
    }, [previewContextFiles, previewFile, playingFile, pdfFile]);

    const handleNextPreview = useCallback(() => navigatePreview(1), [navigatePreview]);
    const handlePrevPreview = useCallback(() => navigatePreview(-1), [navigatePreview]);

    const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: number | null) => {
        e.preventDefault();
        e.stopPropagation();
        const dataTransferFileId = e.dataTransfer.getData('application/x-telegram-file-id');
        if (activeFolderId === targetFolderId) return;
        const fileId = internalDragRef.current || (dataTransferFileId ? parseInt(dataTransferFileId) : null);
        if (fileId) {
            try {
                const idsToMove = selectedIds.includes(fileId) ? selectedIds : [fileId];
                await invoke('cmd_move_files', { messageIds: idsToMove, sourceFolderId: activeFolderId, targetFolderId });
                queryClient.invalidateQueries({ queryKey: ['files', activeFolderId] });
                if (selectedIds.includes(fileId)) setSelectedIds([]);
                toast.success(`Moved ${idsToMove.length} file(s).`);
                setInternalDragFileId(null);
            } catch {
                toast.error('Failed to move file(s).');
            }
        }
    };

    const currentFolderName = activeFolderId === null
        ? 'Saved Messages'
        : folders.find(f => f.id === activeFolderId)?.name || 'Folder';

    const handleRootDragOver = (e: React.DragEvent) => {
        if (internalDragRef.current) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }
    };

    const handleRootDragEnter = (e: React.DragEvent) => {
        if (internalDragRef.current) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }
    };

    return (
        <div
            className="flex h-screen w-full overflow-hidden bg-telegram-bg relative"
            onClick={() => setSelectedIds([])}
            onDragOver={handleRootDragOver}
            onDragEnter={handleRootDragEnter}
        >
            <ExternalDropBlocker onUploadClick={handleManualUpload} />

            {/* ── CineHub Share Modal ──────────────────────────────────── */}
            {shareModalOpen && shareModalFile && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShareModalOpen(false)}>
                    <div className="bg-telegram-surface rounded-2xl p-6 max-w-md w-full border border-telegram-border" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-telegram-text mb-1">📎 Copy CineHub Link</h2>
                        <p className="text-sm text-telegram-subtext mb-4">This link will be used in the CineHub admin panel and on your website.</p>

                        <div className="p-3 bg-telegram-bg rounded-lg mb-4">
                            <p className="font-medium text-telegram-text truncate text-sm">{shareModalFile.name}</p>
                            <p className="text-xs text-telegram-subtext">Message ID: {shareModalFile.message_id || shareModalFile.id}</p>
                        </div>

                        <label className="text-xs text-telegram-subtext font-medium block mb-1">Movie Key (URL-friendly name)</label>
                        <input
                            type="text"
                            value={shareModalKey}
                            onChange={e => {
                                const k = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                                setShareModalKey(k);
                                setShareModalUrl(`${CINEHUB_BRIDGE}/download/${k}`);
                            }}
                            className="w-full bg-telegram-bg border border-telegram-border rounded-lg px-3 py-2 text-sm text-telegram-text outline-none focus:border-telegram-primary mb-3"
                            placeholder="e.g. gran-turismo-2023"
                        />

                        <label className="text-xs text-telegram-subtext font-medium block mb-1">Generated CineHub URL</label>
                        <div className="flex items-center gap-2 p-3 bg-telegram-bg rounded-lg border border-telegram-border mb-4">
                            <span className="flex-1 text-xs text-green-400 font-mono break-all">{shareModalUrl}</span>
                        </div>

                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                            <p className="text-xs text-yellow-400">
                                ⚠️ After copying, also add this movie key to your bridge server's <code>server.js</code> MOVIES registry with the message ID shown above.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleShareConfirm}
                                className="flex-1 bg-telegram-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-telegram-primary/90 transition-colors"
                            >
                                📋 Copy CineHub Link
                            </button>
                            <button
                                onClick={() => setShareModalOpen(false)}
                                className="px-4 bg-telegram-bg border border-telegram-border rounded-lg text-sm text-telegram-subtext hover:text-telegram-text transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showMoveModal && (
                    <MoveToFolderModal folders={folders} onClose={() => setShowMoveModal(false)} onSelect={handleBulkMove} activeFolderId={activeFolderId} key="move-modal" />
                )}
                {playingFile && (
                    <MediaPlayer file={playingFile} onClose={() => setPlayingFile(null)} onNext={handleNextPreview} onPrev={handlePrevPreview} currentIndex={previewContextIndex} totalItems={previewContextFiles.length} activeFolderId={activeFolderId} key="media-player" />
                )}
                {pdfFile && (
                    <PdfViewer file={pdfFile} onClose={() => setPdfFile(null)} onNext={handleNextPreview} onPrev={handlePrevPreview} currentIndex={previewContextIndex} totalItems={previewContextFiles.length} activeFolderId={activeFolderId} key="pdf-viewer" />
                )}
                {isDragging && internalDragFileId === null && <DragDropOverlay key="drag-drop-overlay" />}
            </AnimatePresence>

            <Sidebar
                folders={folders}
                activeFolderId={activeFolderId}
                setActiveFolderId={setActiveFolderId}
                onDrop={handleDropOnFolder}
                onDelete={handleFolderDelete}
                onCreate={handleCreateFolder}
                isSyncing={isSyncing}
                isConnected={isConnected}
                onSync={handleSyncFolders}
                onLogout={handleLogout}
                bandwidth={bandwidth || null}
            />

            <main className="flex-1 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setSelectedIds([]); }}>
                <TopBar
                    currentFolderName={currentFolderName}
                    selectedIds={selectedIds}
                    onShowMoveModal={() => setShowMoveModal(true)}
                    onBulkDownload={handleBulkDownload}
                    onBulkDelete={handleBulkDelete}
                    onDownloadFolder={handleDownloadFolder}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    isSearching={isSearching}
                    searchResultCount={displayedFiles.length}
                />
                {searchTerm.length > 2 && (
                    <div className="px-6 pt-4 pb-0">
                        <h2 className="text-sm font-medium text-telegram-subtext">
                            Search Results for <span className="text-telegram-primary">"{searchTerm}"</span>
                        </h2>
                    </div>
                )}
                <FileExplorer
                    files={displayedFiles}
                    loading={isLoading || isSearching}
                    error={error}
                    viewMode={viewMode}
                    selectedIds={selectedIds}
                    activeFolderId={activeFolderId}
                    onFileClick={(e, id) => {
                        e.stopPropagation();
                        if (e.metaKey || e.ctrlKey) {
                            setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
                        } else {
                            setSelectedIds([id]);
                        }
                    }}
                    onDelete={handleDeleteFile}
                    onDownload={handleDownload}
                    onPreview={handlePreview}
                    onShare={handleShare}
                    onRename={handleRename}
                    onManualUpload={handleManualUpload}
                    onSelectionClear={() => setSelectedIds([])}
                    onToggleSelection={(id) => {
                        setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
                    }}
                    onDrop={handleDropOnFolder}
                    onDragStart={(fileId) => setInternalDragFileId(fileId)}
                    onDragEnd={() => setInternalDragFileId(null)}
                />
            </main>

            <UploadQueue
                items={uploadQueue}
                onClearFinished={() => setUploadQueue(q => q.filter(i => i.status !== 'success' && i.status !== 'error' && i.status !== 'cancelled'))}
                onCancelAll={cancelUploads}
                onCancelItem={cancelUploadItem}
                onRetryItem={retryUploadItem}
            />
            <DownloadQueue
                items={downloadQueue}
                onClearFinished={clearDownloads}
                onCancelAll={cancelDownloads}
                onCancelItem={cancelDownloadItem}
                onRetryItem={retryDownloadItem}
            />
        </div>
    );
}
