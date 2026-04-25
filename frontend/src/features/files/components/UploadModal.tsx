import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, File as FileIcon, X, FolderPlus, FolderUp, FileUp, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/features/auth/store';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFolderId?: string | null;
}

// ─── Upload Content ───────────────────────────────────────────────────────────

const UploadContent = ({ onClose, activeFolderId }: { onClose: () => void; activeFolderId?: string | null }) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { id: projectId } = useParams();
  const queryClient = useQueryClient();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) setFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (!files.length) {
      toast({ variant: 'destructive', title: 'No files selected', description: 'Please select at least one file.' });
      return;
    }
    if (!projectId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Project ID is missing.' });
      return;
    }

    setIsUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        if (activeFolderId) formData.append('folderId', activeFolderId);
        // Do NOT set Content-Type manually — Axios sets it with the correct boundary
        await apiClient.post(`/projects/${projectId}/files/upload`, formData);
      }
      toast({
        variant: 'success',
        title: 'Upload Successful',
        description: `${files.length} file${files.length > 1 ? 's' : ''} uploaded to vault.`,
      });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      setFiles([]);
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.response?.data?.error?.message ?? 'Failed to upload. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  return (
    <>
      <div
        className={`mt-2 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors ${
          dragActive
            ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
            : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${dragActive ? 'text-brand-500' : 'text-surface-400'}`} />
        <p className="text-surface-600 dark:text-surface-300 font-medium mb-1 text-sm text-center">
          Drag files here, or use the buttons below
        </p>
        <p className="text-surface-400 text-xs text-center mb-5">PDF, Image, Spreadsheet — up to 50 MB</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 text-[13px] font-medium shadow-sm transition-all disabled:opacity-50"
          >
            <FileUp className="w-4 h-4 text-surface-500" /> File upload
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 text-[13px] font-medium shadow-sm transition-all disabled:opacity-50"
          >
            <FolderUp className="w-4 h-4 text-surface-500" /> Folder upload
          </button>
        </div>

        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileChange} disabled={isUploading} />
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          // @ts-ignore
          webkitdirectory=""
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[12px] font-bold uppercase tracking-wider text-surface-400">
            {files.length} file{files.length > 1 ? 's' : ''} selected
          </p>
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
            {files.map(file => (
              <div
                key={file.name}
                className="flex items-center gap-3 p-3 border border-surface-200 dark:border-surface-700 rounded-lg bg-surface-50 dark:bg-surface-800/50"
              >
                <FileIcon className="w-7 h-7 text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{file.name}</p>
                  <p className="text-xs text-surface-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {!isUploading && (
                  <button onClick={() => removeFile(file.name)} className="p-1.5 text-surface-400 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100 dark:border-surface-800">
            <Button variant="ghost" onClick={onClose} disabled={isUploading} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-6"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
              ) : (
                'Upload to Vault'
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────

export const UploadModal = ({ isOpen, onClose, activeFolderId }: UploadModalProps) => (
  <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-w-md bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl rounded-2xl">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold tracking-tight">Upload to Vault</DialogTitle>
      </DialogHeader>
      <UploadContent onClose={onClose} activeFolderId={activeFolderId} />
    </DialogContent>
  </Dialog>
);

// ─── Create Project Dialog ────────────────────────────────────────────────────

export const CreateProjectDialog = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Enter a folder name', description: 'Folder name cannot be empty.' });
      return;
    }

    // Auto-generate case number from name + timestamp
    const caseNumber = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 12)
      + '-' + Date.now().toString().slice(-4);

    setIsCreating(true);
    try {
      const res = await apiClient.post('/projects', { name: name.trim(), caseNumber });
      const project = res.data.data;

      toast({ variant: 'success', title: 'Folder created', description: `"${project.name}" is ready.` });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      setName('');
      onClose();

      const base = user?.isMasterAdmin ? '/admin' : '/app';
      navigate(`${base}/projects/${project.id}/files`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to create folder',
        description: error.response?.data?.error?.message ?? 'Something went wrong.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => { setName(''); onClose(); };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-sm bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-brand-600" /> New folder
          </DialogTitle>
        </DialogHeader>

        <div className="pt-2">
          <Input
            placeholder="Untitled folder"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isCreating}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="h-11"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-100 dark:border-surface-800 mt-2">
          <Button variant="ghost" onClick={handleClose} disabled={isCreating} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-6"
          >
            {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Project Picker Dialog (for upload from sidebar when no project is open) ──

const ProjectPickerDialog = ({
  isOpen,
  onClose,
  mode,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: 'file' | 'folder';
}) => {
  const [projects, setProjects] = useState<{ id: string; name: string; caseNumber: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    apiClient
      .get('/projects')
      .then(res => setProjects(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const handleSelect = (projectId: string) => {
    // Navigate into the project first, then open upload modal
    const base = user?.isMasterAdmin ? '/admin' : '/app';
    onClose();
    navigate(`${base}/projects/${projectId}/files`);
    // Small delay so the route renders before the modal opens
    setTimeout(() => {
      setSelectedProjectId(projectId);
      setUploadOpen(true);
    }, 150);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-sm bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
              {mode === 'folder'
                ? <><FolderUp className="w-5 h-5 text-brand-600" /> Select project to upload folder</>
                : <><FileUp className="w-5 h-5 text-brand-600" /> Select project to upload file</>
              }
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-surface-500 -mt-1">Choose which project to upload into:</p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-surface-400" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-surface-400 py-4 text-center">No projects found. Create one first.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto mt-1">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-surface-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                    <FolderPlus className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-900 group-hover:text-brand-700 truncate">{p.name}</p>
                    <p className="text-xs text-surface-400">Case #{p.caseNumber}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-surface-100 mt-2">
            <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload modal opens after navigation */}
      {uploadOpen && selectedProjectId && (
        <UploadModal isOpen={uploadOpen} onClose={() => { setUploadOpen(false); setSelectedProjectId(''); }} />
      )}
    </>
  );
};

// ─── Drive-style "+ New" Sidebar Trigger ─────────────────────────────────────

export const NewDropdownTrigger = ({ children }: { children: React.ReactNode }) => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { id: projectId } = useParams();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Hidden folder input — triggers OS folder picker directly
  const folderInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Handle folder selected from OS picker — upload all files inside it
  const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (!selectedFiles.length) return;

    if (!projectId) {
      // No project context — show project picker first
      setPickerOpen(true);
      e.target.value = '';
      return;
    }

    // Upload each file from the folder sequentially
    let successCount = 0;
    let failCount = 0;

    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        await apiClient.post(`/projects/${projectId}/files/upload`, formData);
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast({
        variant: 'success',
        title: 'Folder uploaded',
        description: `${successCount} file${successCount > 1 ? 's' : ''} uploaded from folder.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    } else {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'No files could be uploaded from the folder.' });
    }

    // Reset input so same folder can be re-selected
    e.target.value = '';
  };

  const handleUploadSelect = (mode: 'file' | 'folder') => {
    if (mode === 'folder') {
      if (!projectId && user?.isMasterAdmin) {
        // Admin on projects list — show project picker first, then folder upload
        setPickerOpen(true);
      } else if (projectId) {
        // Inside a project — open OS folder picker directly
        folderInputRef.current?.click();
      }
      return;
    }

    // File upload
    if (projectId) {
      setUploadOpen(true);
    } else if (user?.isMasterAdmin) {
      setPickerOpen(true);
    }
  };

  return (
    <>
      {/* Hidden folder input — opens OS folder picker, no UI shown */}
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        multiple
        // @ts-ignore — webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        onChange={handleFolderSelected}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 p-1.5 rounded-xl shadow-premium border-surface-200">

          {/* New folder — opens Create Project dialog (admin only) */}
          {user?.isMasterAdmin && (
            <DropdownMenuItem
              className="py-2.5 px-3 rounded-lg cursor-pointer text-[14px] font-medium text-surface-700 hover:text-surface-900 bg-surface-50 hover:bg-surface-100"
              onSelect={() => setCreateProjectOpen(true)}
            >
              <FolderPlus className="w-4 h-4 mr-3 text-surface-500" />
              New folder
              <span className="ml-auto text-[10px] text-surface-400 font-mono">Alt+C F</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            className="py-2.5 px-3 rounded-lg cursor-pointer text-[14px] font-medium text-surface-700 hover:text-surface-900"
            onSelect={() => handleUploadSelect('file')}
          >
            <FileUp className="w-4 h-4 mr-3 text-surface-500" />
            File / Folder upload
            <span className="ml-auto text-[10px] text-surface-400 font-mono">Alt+C U</span>
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>

      {/* Direct file upload (already inside a project) */}
      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* Create project dialog */}
      <CreateProjectDialog isOpen={createProjectOpen} onClose={() => setCreateProjectOpen(false)} />

      {/* Project picker — only for file upload when not inside a project */}
      <ProjectPickerDialog
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="file"
      />
    </>
  );
};
