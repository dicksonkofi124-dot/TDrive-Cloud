import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { TelegramFile } from '../../types';

interface ShareModalProps {
    file: TelegramFile | null;
    isOpen: boolean;
    onClose: () => void;
    activeFolderId: number | null;
}

export function ShareModal({ file, isOpen, onClose, activeFolderId }: ShareModalProps) {
    const [copied, setCopied] = useState(false);
    const [shareLink, setShareLink] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const generateShareLink = async () => {
        if (!file) return;
        
        setLoading(true);
        try {
            // Generate a Telegram shareable link
            // Format: https://t.me/c/channel_id/message_id
            const link = `https://t.me/c/${Math.abs(activeFolderId || 0)}/${file.id}`;
            setShareLink(link);
        } catch (error) {
            console.error('Failed to generate share link:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const openInTelegram = () => {
        if (shareLink) {
            window.open(shareLink, '_blank');
        }
    };

    // Generate link when modal opens
    if (isOpen && file && !shareLink && !loading) {
        generateShareLink();
    }

    // Reset when modal closes
    if (!isOpen && shareLink) {
        setShareLink('');
        setCopied(false);
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-telegram-surface rounded-2xl p-6 max-w-md w-full border border-telegram-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-telegram-primary/10 rounded-full flex items-center justify-center">
                                    <Share2 className="w-5 h-5 text-telegram-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-telegram-text">Share File</h2>
                                    <p className="text-sm text-telegram-subtext">Generate a shareable link</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full hover:bg-telegram-bg flex items-center justify-center text-telegram-subtext hover:text-telegram-text transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* File Info */}
                        {file && (
                            <div className="mb-6 p-3 bg-telegram-bg rounded-lg">
                                <p className="font-medium text-telegram-text truncate">{file.name}</p>
                                <p className="text-sm text-telegram-subtext">{file.sizeStr}</p>
                            </div>
                        )}

                        {/* Share Link */}
                        <div className="space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-telegram-primary/30 border-t-telegram-primary rounded-full animate-spin" />
                                </div>
                            ) : shareLink ? (
                                <>
                                    <div className="flex items-center gap-2 p-3 bg-telegram-bg rounded-lg border border-telegram-border">
                                        <input
                                            type="text"
                                            value={shareLink}
                                            readOnly
                                            className="flex-1 bg-transparent text-sm text-telegram-text outline-none"
                                        />
                                        <button
                                            onClick={copyToClipboard}
                                            className="p-2 hover:bg-telegram-surface rounded-lg transition-colors"
                                            title={copied ? "Copied!" : "Copy link"}
                                        >
                                            {copied ? (
                                                <Check className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-telegram-subtext" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={copyToClipboard}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors"
                                        >
                                            <Copy className="w-4 h-4" />
                                            Copy Link
                                        </button>
                                        <button
                                            onClick={openInTelegram}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-telegram-bg border border-telegram-border rounded-lg hover:bg-telegram-surface transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* Note */}
                        <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <p className="text-xs text-blue-400">
                                Anyone with this link can view this file if they have access to the Telegram channel.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
