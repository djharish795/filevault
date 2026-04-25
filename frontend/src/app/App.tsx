import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { UserLayout } from '../components/layout/UserLayout';
import { AdminLayout } from '../components/layout/AdminLayout';
import { Login } from '../features/auth/Login';
import { FileCard } from '../features/files/components/FileCard';
import { FileShareModal } from '../features/files/components/FileShareModal';
import { ProjectCard } from '../features/projects/components/ProjectCard';
import { UploadModal } from '../features/files/components/UploadModal';
import { UserManagementPage } from '../features/users/UserManagementPage';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Plus, UploadCloud, Loader2, CheckSquare, X, Share2, FolderPlus, Folder, Trash2, HardDrive } from 'lucide-react';
import { useProjects, useProjectDetails } from '../hooks/useProjects';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../features/auth/store';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { apiClient } from '../lib/apiClient';

// Loading fallback component
const LoadingFallback = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex items-center justify-center h-64">
    <div className="flex items-center gap-3 text-surface-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  </div>
);

const DashboardPage = () => {
  const { id } = useParams();
  const { data: project, isLoading, error } = useProjectDetails(id!);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // ─── Nested folder state ──────────────────────────────────────────────────────
  // currentFolderId = null means root; set = inside that folder
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  // Breadcrumb trail: [{id, name}, ...]
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

  // Navigate into a folder — push to breadcrumb
  const openFolder = (folder: { id: string; name: string }) => {
    setBreadcrumb(prev => [...prev, folder]);
    setActiveFolderId(folder.id);
  };

  // Navigate back to a breadcrumb level
  const navigateTo = (index: number) => {
    if (index === -1) {
      // Root
      setBreadcrumb([]);
      setActiveFolderId(null);
    } else {
      const crumb = breadcrumb[index];
      setBreadcrumb(prev => prev.slice(0, index + 1));
      setActiveFolderId(crumb.id);
    }
  };

  // Create folder at current level
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
      fetchFolders(); // refresh current level
    } catch {
      // run: npx prisma db push
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Selection mode for bulk share — one file at a time via FileShareModal
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

  // Bulk delete — admin only, deletes all selected files
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

  // Filter files by active folder (null = root)
  const visibleFiles = activeFolderId
    ? (project.files ?? []).filter((f: any) => f.folderId === activeFolderId)
    : (project.files ?? []).filter((f: any) => !f.folderId);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-100 tracking-tight">
            {project.name || 'Project'}
          </h1>
          <p className="text-sm text-surface-400 mt-0.5 font-medium">Case #{project.caseNumber || 'N/A'}</p>
        </div>

        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <span className="text-sm text-surface-500 font-medium mr-1">{selectedFiles.size} selected</span>
              {selectedFiles.size > 0 && (
                <Button
                  onClick={startBulkShare}
                  className="rounded-full px-4 gap-2 bg-brand-600 hover:bg-brand-700 text-white"
                >
                  <Share2 className="w-4 h-4" /> Share Access
                </Button>
              )}
              {selectedFiles.size > 0 && user?.isMasterAdmin && (
                <Button
                  onClick={handleBulkDelete}
                  className="rounded-full px-4 gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={exitSelectionMode} className="rounded-full px-4 gap-2">
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
              {user?.isMasterAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setNewFolderOpen(true)}
                  className="rounded-full px-4 gap-2 border-surface-200"
                >
                  <FolderPlus className="w-4 h-4" /> New Subfolder
                </Button>
              )}
              <Button
                onClick={() => setIsUploadOpen(true)}
                className="rounded-full shadow-md px-5 gap-2 bg-brand-600 hover:bg-brand-700 text-white"
              >
                <Plus className="w-4 h-4" /> Upload File
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Subfolder navigation trail (Breadcrumbs) */}
      <div className="flex items-center gap-2 mb-4 flex-wrap text-sm">
        <button
          onClick={() => navigateTo(-1)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
            !activeFolderId ? 'bg-surface-100 text-brand-700 font-semibold' : 'text-surface-500 hover:bg-surface-50'
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

      {/* Subfolders at current level */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <h3 className="text-[10px] uppercase font-bold text-surface-400 tracking-wider mr-2">Subfolders</h3>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => openFolder(f)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-sm font-medium hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <Folder className="w-4 h-4 text-brand-500" /> {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Files grid — filtered by active folder */}
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
        <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl">
          <div className="text-center">
            <UploadCloud className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-400 text-sm font-medium">
              {activeFolderId ? 'No files in this subfolder' : 'No files uploaded yet'}
            </p>
            <p className="text-surface-300 text-xs mt-1">Click "Upload File" to add documents to this vault</p>
          </div>
        </div>
      )}

      {/* New Subfolder Dialog */}
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
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)} disabled={isCreatingFolder} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={isCreatingFolder || !newFolderName.trim()} className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white">
              {isCreatingFolder ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} activeFolderId={activeFolderId} />

      {/* File-level share modal — opens per file, one at a time */}
      {currentShareFile && (
        <FileShareModal
          isOpen={true}
          onClose={handleShareModalClose}
          fileId={currentShareFile.id}
          fileName={currentShareFile.name}
        />
      )}
    </div>
  );
};

const ProjectsList = () => {
  const { user } = useAuthStore();
  const { data: projects, isLoading, error } = useProjects();
  const isOwner = user?.isMasterAdmin;

  if (isLoading) return <LoadingFallback message="Syncing workspace..." />;
  
  if (error) {
    throw new Error(`Failed to load projects: ${error.message}`);
  }

  return (
    <div className="flex flex-col h-full max-w-5xl">
      <h1 className="text-2xl font-normal text-surface-800 dark:text-surface-100 mb-6">{isOwner ? 'Master Workspace' : 'Assigned Cases'}</h1>
      {projects && projects.length > 0 ? (
        <div className="flex flex-col">
          {projects.map((p: any) => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-xl">
          <p className="text-surface-400">No active cases found.</p>
        </div>
      )}
    </div>
  );
};

const SharedWithMePage = () => {
  const { user } = useAuthStore();
  const { data: projects, isLoading, error } = useProjects();
  const isOwner = user?.isMasterAdmin;

  if (isLoading) return <LoadingFallback message="Filtering shared access..." />;
  
  if (error) {
    throw new Error(`Failed to load shared projects: ${error.message}`);
  }

  return (
    <div className="flex flex-col h-full max-w-5xl">
      <h1 className="text-2xl font-normal text-surface-800 dark:text-surface-100 mb-6">Shared with me</h1>
      {isOwner ? (
        <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-xl">
          <p className="text-surface-400">Admin accounts see all projects directly in 'Master Workspace'.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          <h3 className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">Projects</h3>
          {projects?.map((p: any) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
};

const GenericPage = ({ title }: { title: string }) => (
  <div className="flex flex-col h-full">
    <h1 className="text-2xl font-normal text-surface-800 dark:text-surface-100 mb-6">{title}</h1>
    <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-xl">
      <p className="text-surface-400">No items in {title.toLowerCase()} yet.</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const RootRedirector = () => {
    const { user } = useAuthStore();
    return user?.isMasterAdmin ? <Navigate to="/admin/projects" replace /> : <Navigate to="/app/shared" replace />;
};

export const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback message="Loading application..." />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><RootRedirector /></ProtectedRoute>} />
              
              <Route path="/app" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
                 <Route index element={<Navigate to="/app/shared" replace />} />
                 <Route path="projects" element={
                   <ErrorBoundary><ProjectsList /></ErrorBoundary>
                 } />
                 <Route path="projects/:id/files" element={
                   <ErrorBoundary><DashboardPage /></ErrorBoundary>
                 } />
                 {/* Alias routes — shared/recent cards navigate here, redirect to canonical path */}
                 <Route path="shared/:id/files" element={
                   <ErrorBoundary><DashboardPage /></ErrorBoundary>
                 } />
                 <Route path="recent/:id/files" element={
                   <ErrorBoundary><DashboardPage /></ErrorBoundary>
                 } />
                 <Route path="shared" element={
                   <ErrorBoundary><SharedWithMePage /></ErrorBoundary>
                 } />
                 <Route path="recent" element={<GenericPage title="Recent Documents" />} />
              </Route>

              <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                 <Route index element={<Navigate to="/admin/projects" replace />} />
                 <Route path="projects" element={
                   <ErrorBoundary><ProjectsList /></ErrorBoundary>
                 } />
                 <Route path="projects/:id/files" element={
                   <ErrorBoundary><DashboardPage /></ErrorBoundary>
                 } />
                 {/* Alias routes for admin too */}
                 <Route path="shared/:id/files" element={
                   <ErrorBoundary><DashboardPage /></ErrorBoundary>
                 } />
                 <Route path="recent/:id/files" element={
                   <ErrorBoundary><DashboardPage /></ErrorBoundary>
                 } />
                 <Route path="shared" element={
                   <ErrorBoundary><SharedWithMePage /></ErrorBoundary>
                 } />
                 <Route path="recent" element={<GenericPage title="Recent Activity" />} />
                 <Route path="starred" element={<GenericPage title="Starred / Priority" />} />
                 <Route path="users" element={
                   <ErrorBoundary><UserManagementPage /></ErrorBoundary>
                 } />
                 <Route path="roles" element={<GenericPage title="Global Roles" />} />
                 <Route path="audit" element={<GenericPage title="Security Audit Logs" />} />
                 <Route path="trash" element={<GenericPage title="Recycle Bin" />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
