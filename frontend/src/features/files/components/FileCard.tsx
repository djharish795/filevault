import React, { useState } from 'react';
import { File, Image, FileText, FileSpreadsheet, MoreVertical, Share, Download, Trash2, Edit2, Check, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { useParams } from 'react-router-dom';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { FileShareModal } from '@/features/files/components/FileShareModal';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size?: number;
  updatedAt: string;
  owner: string;
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
}

interface FileCardProps {
  file: FileItem;
  onShare: (f: FileItem) => void;
  onDelete?: (f: FileItem) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (f: FileItem) => void;
}

export const FileCard = ({ file, onDelete, selectionMode = false, isSelected = false, onSelect }: Omit<FileCardProps, 'onShare'> & { onShare?: (f: FileItem) => void }) => {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [renameOpen, setRenameOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [isRenaming, setIsRenaming] = useState(false);

  const getIcon = () => {
    if (file.type.includes('pdf')) return <FileText className="text-red-500 w-12 h-12" />;
    if (file.type.includes('image')) return <Image className="text-blue-500 w-12 h-12" />;
    if (file.type.includes('sheet')) return <FileSpreadsheet className="text-green-500 w-12 h-12" />;
    return <File className="text-slate-500 w-12 h-12" />;
  };

  const handleCardClick = () => {
    if (selectionMode && onSelect) onSelect(file);
  };

  // ─── Download via apiClient (sends auth token) ────────────────────────────────
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file.permissions.canDownload) {
      toast({ variant: 'destructive', title: 'Access Denied', description: "You don't have permission to download this file." });
      return;
    }
    try {
      const response = await apiClient.get(
        `/projects/${projectId}/files/${file.id}/download`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ variant: 'success', title: 'Download Started', description: `Downloading ${file.name}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Download Failed', description: error.response?.data?.error?.message || 'Failed to download file' });
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file.permissions.canDelete) {
      toast({ variant: 'destructive', title: 'Access Denied', description: "You don't have permission to delete this file." });
      return;
    }
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/projects/${projectId}/files/${file.id}`);
      toast({ variant: 'success', title: 'File Deleted', description: `${file.name} deleted.` });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      if (onDelete) onDelete(file);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.response?.data?.error?.message || 'Failed to delete file' });
    }
  };

  // ─── Rename ───────────────────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === file.name) { setRenameOpen(false); return; }
    setIsRenaming(true);
    try {
      await apiClient.patch(`/projects/${projectId}/files/${file.id}`, { name: newName.trim() });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast({ variant: 'success', title: 'Renamed', description: `File renamed to "${newName.trim()}"` });
      setRenameOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Rename Failed', description: error.response?.data?.error?.message || 'Failed to rename file' });
    } finally {
      setIsRenaming(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`w-56 h-auto flex flex-col rounded-xl border bg-white dark:bg-surface-900 transition-all duration-200 cursor-pointer group shadow-soft relative overflow-hidden
          ${selectionMode
            ? isSelected
              ? 'border-brand-500 ring-2 ring-brand-300 dark:ring-brand-700 shadow-md'
              : 'border-surface-200/80 dark:border-surface-800/80 hover:border-brand-300'
            : 'border-surface-200/80 dark:border-surface-800/80 hover:shadow-premium hover:-translate-y-[1px] hover:border-brand-200 dark:hover:border-brand-800'
          }`}
      >
        {/* Checkbox in selection mode */}
        {selectionMode && (
          <div className="absolute top-2 left-2 z-20">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected ? 'bg-brand-600 border-brand-600' : 'bg-white border-surface-300 dark:bg-surface-800 dark:border-surface-600'
            }`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
        )}

        <div className="p-4 pb-2 flex justify-between items-start">
          <div className={`flex gap-2 items-center text-sm font-medium text-surface-800 dark:text-surface-200 truncate pr-2 transition-transform duration-300 ${!selectionMode ? 'group-hover:scale-105' : ''} ${selectionMode ? 'ml-5' : ''}`}>
            {getIcon()}
          </div>

          {!selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-all touch-auto focus:opacity-100 z-10"
                onClick={e => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4 text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {/* Open — always visible */}
                <DropdownMenuItem onClick={handleDownload}>
                  <File className="mr-2 h-4 w-4" /> Open
                </DropdownMenuItem>

                {/* Download — always visible */}
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </DropdownMenuItem>

                {/* Rename — only admin/owner (canDelete = true means they own it) */}
                {file.permissions.canDelete && (
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); setNewName(file.name); setRenameOpen(true); }}>
                    <Edit2 className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                )}

                {/* Share — only admin/owner */}
                {file.permissions.canShare && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); setShareOpen(true); }}>
                      <Share className="mr-2 h-4 w-4" /> Share
                    </DropdownMenuItem>
                  </>
                )}

                {/* File Info — always visible */}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={e => { e.stopPropagation(); setInfoOpen(true); }}>
                  <Info className="mr-2 h-4 w-4" /> File information
                </DropdownMenuItem>

                {/* Delete — only admin/owner */}
                {file.permissions.canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:bg-red-50 dark:focus:bg-red-500/10 dark:text-red-400"
                      onClick={handleDelete}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="px-4 pb-2 pt-3 truncate text-[14px] font-semibold text-surface-900 dark:text-surface-50 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {file.name}
        </div>

        <div className="px-4 pb-4 pt-1 flex items-center justify-between text-[12px] font-medium text-surface-400">
          <div className="flex flex-col">
            <span>{file.updatedAt}</span>
            {file.size && <span className="text-[10px]">{formatFileSize(file.size)}</span>}
          </div>
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 ring-2 ring-white dark:ring-surface-900 shadow-sm flex items-center justify-center text-[9px] text-white font-bold tracking-wider" title={file.owner}>
            {file.owner.charAt(0)}
          </div>
        </div>
      </div>

      {/* ─── Rename Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={renameOpen} onOpenChange={open => !open && setRenameOpen(false)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Edit2 className="w-4 h-4 text-brand-600" /> Rename file
            </DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            disabled={isRenaming}
            autoFocus
            className="mt-2"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={isRenaming} className="rounded-xl">Cancel</Button>
            <Button onClick={handleRename} disabled={isRenaming || !newName.trim()} className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white">
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── File Info Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={infoOpen} onOpenChange={open => !open && setInfoOpen(false)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Info className="w-4 h-4 text-brand-600" /> File information
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-500 font-medium">Name</span>
              <span className="text-surface-900 font-semibold truncate max-w-[180px]">{file.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-500 font-medium">Type</span>
              <span className="text-surface-900">{file.type}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-500 font-medium">Size</span>
              <span className="text-surface-900">{formatFileSize(file.size)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-500 font-medium">Owner</span>
              <span className="text-surface-900">{file.owner}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-surface-500 font-medium">Modified</span>
              <span className="text-surface-900">{file.updatedAt}</span>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" onClick={() => setInfoOpen(false)} className="rounded-xl">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Share Modal (file-level, fresh per file) ───────────────────────────── */}
      {shareOpen && (
        <FileShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          fileId={file.id}
          fileName={file.name}
        />
      )}
    </>
  );
};
