import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectDetails } from '@/hooks/useProjects';
import { useAuthStore } from '@/features/auth/store';
import { useQueryClient } from '@tanstack/react-query';
import { FileCard } from '@/features/files/components/FileCard';
import { FileShareModal } from '@/features/files/components/FileShareModal';
import { UploadModal } from '@/features/files/components/UploadModal';
import { ShareModal } from '@/features/permissions/components/ShareModal';
import { FolderShareModal } from '@/features/permissions/components/FolderShareModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, UploadCloud, Loader2, CheckSquare, X, Share2, FolderPlus,
  Folder, Trash2, HardDrive, MessageSquare, Send, Paperclip, File as FileIcon,
  Image as ImageIcon, FileText, Download, User
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  folderId: string;
  senderId: string;
  senderName: string;
  messageType: 'text' | 'file' | 'system';
  text?: string;
  attachment?: {
    fileId: string;
    fileName: string;
    mimeType: string;
    size: number;
  };
  createdAt: string;
}

// ─── Loading fallback ─────────────────────────────────────────────────────────

const LoadingFallback = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex items-center justify-center h-64">
    <div className="flex items-center gap-3 text-surface-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  </div>
);

// ─── Main workspace page ──────────────────────────────────────────────────────

export const UserWorkspacePage = () => {
  const { id } = useParams();
  const { data: project, isLoading, error } = useProjectDetails(id!);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [folderShareOpen, setFolderShareOpen] = useState(false);
  const [projectShareOpen, setProjectShareOpen] = useState(false);
  const [folderToShare, setFolderToShare] = useState<{ id: string; name: string } | null>(null);

  // ─── Nested folder state ──────────────────────────────────────────────────────
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Fetch direct children of currentFolderId (or root folders if null)
  const fetchFolders = async () => {
    if (!id) return;
    try {
      const url = activeFolderId
        ? `/folders/${activeFolderId}/children`
        : `/folders/root/${id}`;
      const res = await apiClient.get(url);
      setFolders(res.data.data.folders ?? []);
    } catch {
      setFolders([]);
    }
  };

  useEffect(() => { fetchFolders(); }, [id, activeFolderId]);

  // Navigate into a folder
  const openFolder = (folder: { id: string; name: string }) => {
    setBreadcrumb(prev => [...prev, folder]);
    setActiveFolderId(folder.id);
  };

  // Navigate back to a breadcrumb level
  const navigateTo = (index: number) => {
    if (index === -1) {
      setBreadcrumb([]);
      setActiveFolderId(null);
    } else {
      const crumb = breadcrumb[index];
      setBreadcrumb(prev => prev.slice(0, index + 1));
      setActiveFolderId(crumb.id);
    }
  };

  // Create folder at current level (admin only)
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !id) return;
    setIsCreatingFolder(true);
    try {
      await apiClient.post('/folders', {
        name: newFolderName.trim(),
        projectId: id,
        parentId: activeFolderId || undefined,
      });
      setNewFolderName('');
      setNewFolderOpen(false);
      fetchFolders();
      toast({ variant: 'success', title: 'Subfolder created', description: `"${newFolderName.trim()}" is ready.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to create subfolder', description: err.response?.data?.error?.message ?? 'Something went wrong' });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // ─── Selection mode for bulk share ────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [shareQueue, setShareQueue] = useState<string[]>([]);

  const toggleSelection = (file: any) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(file.id) ? next.delete(file.id) : next.add(file.id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedFiles(new Set());
    setShareQueue([]);
  };

  const startBulkShare = () => setShareQueue(Array.from(selectedFiles));

  // Bulk delete (admin only)
  const handleBulkDelete = async () => {
    if (!id || selectedFiles.size === 0) return;
    if (!confirm(`Delete ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}? This cannot be undone.`)) return;

    const ids = Array.from(selectedFiles);
    let deleted = 0;
    for (const fileId of ids) {
      try {
        await apiClient.delete(`/projects/${id}/files/${fileId}`);
        deleted++;
      } catch { /* skip failed */ }
    }

    toast({ variant: 'success', title: 'Files deleted', description: `${deleted} file${deleted > 1 ? 's' : ''} removed.` });
    queryClient.invalidateQueries({ queryKey: ['projects', id] });
    exitSelectionMode();
  };

  const handleShareModalClose = () => {
    setShareQueue(prev => {
      const next = prev.slice(1);
      if (next.length === 0) exitSelectionMode();
      return next;
    });
  };

  const currentShareFileId = shareQueue[0] ?? null;
  const currentShareFile = currentShareFileId
    ? (project?.files ?? []).find((f: any) => f.id === currentShareFileId)
    : null;

  if (isLoading) return <LoadingFallback message="Loading vault documents..." />;
  if (error) throw new Error(`Failed to load project: ${error.message}`);
  if (!project) throw new Error('Project not found or access denied');

  // Filter files by active folder
  const visibleFiles = activeFolderId
    ? (project.files ?? []).filter((f: any) => f.folderId === activeFolderId)
    : (project.files ?? []).filter((f: any) => !f.folderId);

  // Check if user has upload permission (admin always can, regular users need explicit permission)
  const canUpload = user?.isMasterAdmin || project.permissions?.can_upload;
  const isAdmin = user?.isMasterAdmin;

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 tracking-tight">
            {project.name || 'Project'}
          </h1>
          <p className="text-sm text-surface-400 mt-0.5 font-medium">
            Case #{project.caseNumber || 'N/A'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <span className="text-sm text-surface-500 font-medium mr-1">
                {selectedFiles.size} selected
              </span>
              {selectedFiles.size > 0 && (
                <Button
                  onClick={startBulkShare}
                  className="rounded-full px-4 gap-2 bg-brand-600 hover:bg-brand-700 text-white"
                >
                  <Share2 className="w-4 h-4" /> Share Access
                </Button>
              )}
              {selectedFiles.size > 0 && isAdmin && (
                <Button
                  onClick={handleBulkDelete}
                  className="rounded-full px-4 gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
              <Button
                variant="outline"
                onClick={exitSelectionMode}
                className="rounded-full px-4 gap-2"
              >
                <X className="w-4 h-4" /> Cancel
              </Button>
            </>
          ) : (
            <>
              {project.files && project.files.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setSelectionMode(true)}
                  className="rounded-full px-4 gap-2 border-surface-200"
                >
                  <CheckSquare className="w-4 h-4" /> Select Files
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setNewFolderOpen(true)}
                  className="rounded-full px-4 gap-2 border-surface-200"
                >
                  <FolderPlus className="w-4 h-4" /> New Subfolder
                </Button>
              )}
              {isAdmin && (
                <>
                  {activeFolderId && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFolderToShare({
                          id: activeFolderId,
                          name: breadcrumb[breadcrumb.length - 1]?.name || 'Subfolder'
                        });
                        setFolderShareOpen(true);
                      }}
                      className="rounded-full px-4 gap-2 border-surface-200"
                    >
                      <Share2 className="w-4 h-4" /> Share Access
                    </Button>
                  )}
                  {!activeFolderId && (
                    <Button
                      variant="outline"
                      onClick={() => setProjectShareOpen(true)}
                      className="rounded-full px-4 gap-2 border-surface-200"
                    >
                      <Share2 className="w-4 h-4" /> Share Access
                    </Button>
                  )}
                </>
              )}
              {canUpload && (
                <Button
                  onClick={() => setIsUploadOpen(true)}
                  className="rounded-full shadow-md px-5 gap-2 bg-brand-600 hover:bg-brand-700 text-white"
                >
                  <Plus className="w-4 h-4" /> Upload File
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Breadcrumb navigation ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap text-sm">
        <button
          onClick={() => navigateTo(-1)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
            !activeFolderId
              ? 'bg-surface-100 text-brand-700 font-semibold'
              : 'text-surface-500 hover:bg-surface-50'
          }`}
        >
          <HardDrive className="w-4 h-4" /> Root
        </button>
        {breadcrumb.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <span className="text-surface-300">/</span>
            <button
              onClick={() => navigateTo(idx)}
              className={`px-2 py-1 rounded-md transition-colors ${
                idx === breadcrumb.length - 1 ? 'bg-surface-100 text-brand-700 font-semibold' : 'text-surface-500 hover:bg-surface-50'
              }`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* ── Subfolders at current level ───────────────────────────────────── */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <h3 className="text-[10px] uppercase font-bold text-surface-400 tracking-wider mr-2">Subfolders</h3>
          {folders.map(f => (
            <div key={f.id} className="flex items-center bg-white border border-surface-200 rounded-xl hover:border-brand-300 hover:shadow-sm transition-all overflow-hidden group">
              <button
                onClick={() => openFolder(f)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium outline-none"
              >
                <Folder className="w-4 h-4 text-brand-500" /> {f.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs: Files | Chat ────────────────────────────────────────────── */}
      <Tabs defaultValue="files" className="flex-1 flex flex-col">
        <TabsList className="w-fit mb-4">
          <TabsTrigger value="files" className="gap-2">
            <FileIcon className="w-4 h-4" /> Files
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2" disabled={!activeFolderId}>
            <MessageSquare className="w-4 h-4" /> Chat
          </TabsTrigger>
        </TabsList>

        {/* ── Files Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="files" className="flex-1 flex flex-col mt-0">
          {visibleFiles.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-4">
              {visibleFiles.map((f: any) => (
                <FileCard
                  key={f.id}
                  file={f}
                  onDelete={() => queryClient.invalidateQueries({ queryKey: ['projects', id] })}
                  selectionMode={selectionMode}
                  isSelected={selectedFiles.has(f.id)}
                  onSelect={toggleSelection}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 rounded-2xl">
              <div className="text-center">
                <UploadCloud className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                <p className="text-surface-400 text-sm font-medium">
                  {activeFolderId ? 'No files in this subfolder' : 'No files uploaded yet'}
                </p>
                {canUpload && (
                  <p className="text-surface-300 text-xs mt-1">
                    Click "Upload File" to add documents to this vault
                  </p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Chat Tab (only available inside subfolders) ───────────────────── */}
        <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
          {activeFolderId ? (
            <ChatTab folderId={activeFolderId} projectId={id!} />
          ) : (
            <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 rounded-2xl">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                <p className="text-surface-400 text-sm font-medium">
                  Chat is available inside subfolders
                </p>
                <p className="text-surface-300 text-xs mt-1 max-w-xs mx-auto">
                  Navigate into a subfolder to access its private chat
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── New Subfolder Dialog (admin only) ─────────────────────────────── */}
      {isAdmin && (
        <Dialog open={newFolderOpen} onOpenChange={open => !open && setNewFolderOpen(false)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FolderPlus className="w-4 h-4 text-brand-600" /> New subfolder
              </DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Subfolder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              disabled={isCreatingFolder}
              autoFocus
              className="mt-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => setNewFolderOpen(false)}
                disabled={isCreatingFolder}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white"
              >
                {isCreatingFolder ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canUpload && (
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          activeFolderId={activeFolderId}
        />
      )}

      {currentShareFile && (
        <FileShareModal
          isOpen={true}
          onClose={handleShareModalClose}
          fileId={currentShareFile.id}
          fileName={currentShareFile.name}
        />
      )}

      {folderShareOpen && folderToShare && (
        <FolderShareModal
          isOpen={folderShareOpen}
          onClose={() => {
            setFolderShareOpen(false);
            setFolderToShare(null);
          }}
          folderName={folderToShare.name}
          folderId={folderToShare.id}
          projectId={id!}
        />
      )}

      {projectShareOpen && !activeFolderId && (
        <ShareModal
          isOpen={projectShareOpen}
          onClose={() => setProjectShareOpen(false)}
          fileName={project.name || 'Project'}
          projectId={id!}
        />
      )}
    </div>
  );
};

// ─── Chat Tab Component ───────────────────────────────────────────────────────

const ChatTab = ({ folderId, projectId }: { folderId: string; projectId: string }) => {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages for this folder
  const loadMessages = async () => {
    setIsLoading(true);
    try {
      console.log(`📨 Loading messages for folder: ${folderId}`);
      const res = await apiClient.get(`/folders/${folderId}/messages`);
      console.log(`✅ Loaded ${res.data.data.messages?.length ?? 0} messages`);
      setMessages(res.data.data.messages ?? []);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      console.error(`❌ Failed to load messages for folder ${folderId}:`, err.response?.data || err.message);
      // Only show toast for non-404 errors (404 means no messages yet, which is fine)
      if (err.response?.status !== 404) {
        toast({
          variant: 'destructive',
          title: 'Failed to load chat',
          description: err.response?.data?.error?.message ?? 'Could not load messages',
        });
      }
      // Set empty messages array even on error
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [folderId]);

  // Send text message
  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;
    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      console.log(`📤 Sending message to folder ${folderId}:`, text);
      const res = await apiClient.post(`/folders/${folderId}/messages`, {
        messageType: 'text',
        text,
      });
      console.log(`✅ Message sent successfully:`, res.data.data.message);
      setMessages(prev => [...prev, res.data.data.message]);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      console.error(`❌ Failed to send message:`, err.response?.data || err.message);
      toast({
        variant: 'destructive',
        title: 'Failed to send message',
        description: err.response?.data?.error?.message ?? 'Could not send message',
      });
      setMessageText(text); // restore message
    } finally {
      setIsSending(false);
    }
  };

  const avatarColor = (name: string) => {
    const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (mimeType.includes('image')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    return <FileIcon className="w-5 h-5 text-surface-500" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-surface-200 rounded-2xl bg-white overflow-hidden">
      {/* ── Messages area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-surface-300" />
            </div>
            <p className="text-surface-600 font-semibold">No messages yet</p>
            <p className="text-surface-400 text-sm mt-1 max-w-xs">
              Messages here are private to this folder. Start the conversation.
            </p>
          </div>
        ) : (
          <>
            {messages.map(msg => {
              const isMe = msg.senderId === user?.id;
              const isSystem = msg.messageType === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <p className="text-xs text-surface-400 bg-surface-50 px-3 py-1 rounded-full">
                      {msg.text}
                    </p>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full ${avatarColor(msg.senderName)} text-white flex items-center justify-center font-semibold text-xs shrink-0`}>
                    {msg.senderName.charAt(0)}
                  </div>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-surface-600">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <span className="text-[10px] text-surface-400">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>

                    {msg.messageType === 'text' ? (
                      <div
                        className={`px-4 py-2.5 rounded-2xl ${
                          isMe
                            ? 'bg-brand-600 text-white'
                            : 'bg-surface-100 text-surface-900'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text}
                        </p>
                      </div>
                    ) : msg.attachment ? (
                      <div className="flex items-center gap-3 px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl">
                        {getFileIcon(msg.attachment.mimeType)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-900 truncate">
                            {msg.attachment.fileName}
                          </p>
                          <p className="text-xs text-surface-400">
                            {formatFileSize(msg.attachment.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // Download file
                            apiClient
                              .get(`/projects/${projectId}/files/${msg.attachment!.fileId}/download`, {
                                responseType: 'blob',
                              })
                              .then(res => {
                                const url = window.URL.createObjectURL(new Blob([res.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', msg.attachment!.fileName);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                window.URL.revokeObjectURL(url);
                              })
                              .catch(() => {
                                toast({
                                  variant: 'destructive',
                                  title: 'Download failed',
                                  description: 'Could not download file',
                                });
                              });
                          }}
                          className="p-1.5 hover:bg-surface-100 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4 text-surface-500" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Message composer ───────────────────────────────────────────────── */}
      <div className="border-t border-surface-200 p-4 bg-surface-50">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Input
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message..."
              disabled={isSending}
              className="pr-10 resize-none"
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-surface-100 rounded-lg transition-colors"
              disabled={isSending}
            >
              <Paperclip className="w-4 h-4 text-surface-400" />
            </button>
          </div>
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 gap-2"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" /> Send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
