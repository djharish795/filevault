import React, { useState } from 'react';
import { Folder, MoreVertical, Users, Edit, Share, Trash2, Settings, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/features/auth/store';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { ShareModal } from '@/features/permissions/components/ShareModal';

interface ProjectItem {
  id: string;
  name: string;
  caseNumber: string;
  memberCount: number;
  updatedAt: string;
}

export const ProjectCard = ({ project }: { project: ProjectItem }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Dialog states
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(project.name);
  const [editCase, setEditCase] = useState(project.caseNumber);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleProjectClick = () => {
    const base = user?.isMasterAdmin ? '/admin' : '/app';
    navigate(`${base}/projects/${project.id}/files`);
  };

  // ─── Edit Project ─────────────────────────────────────────────────────────────

  const handleEditSave = async () => {
    if (!editName.trim() || !editCase.trim()) return;
    setIsSaving(true);
    try {
      await apiClient.patch(`/projects/${project.id}`, {
        name: editName.trim(),
        caseNumber: editCase.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ variant: 'success', title: 'Project updated', description: `"${editName}" saved.` });
      setEditOpen(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err.response?.data?.error?.message ?? 'Could not update project.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete Project ───────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/projects/${project.id}`);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ variant: 'success', title: 'Project deleted', description: `"${project.name}" has been removed.` });
      setDeleteOpen(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err.response?.data?.error?.message ?? 'Could not delete project.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* ─── Card Row ─────────────────────────────────────────────────────────── */}
      <div
        onClick={handleProjectClick}
        className="w-full flex items-center justify-between p-4 rounded-xl border border-surface-200/80 bg-white dark:bg-surface-900 dark:border-surface-800/80 hover:shadow-premium hover:-translate-y-[1px] hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-200 cursor-pointer group mb-3 shadow-soft"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-surface-50 to-surface-100 border border-surface-200 dark:from-surface-800 dark:to-surface-900 dark:border-surface-700 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
            <Folder className="text-brand-500 dark:text-brand-400 w-5 h-5 fill-brand-100 dark:fill-brand-900/30" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-surface-900 dark:text-surface-50 tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {project.name}
            </h3>
            <p className="text-[13px] text-surface-500 mt-0.5 font-medium">Case #{project.caseNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-1.5 text-[13px] text-surface-500 font-medium bg-surface-50 border border-surface-200/60 dark:bg-surface-800/40 dark:border-surface-700/50 px-2.5 py-1 rounded-md shadow-sm">
            <Users className="w-3.5 h-3.5 text-surface-400" /> {project.memberCount} members
          </div>
          <div className="hidden sm:block text-[13px] text-surface-400 font-medium">
            {typeof project.updatedAt === 'string' && project.updatedAt.includes('T')
              ? project.updatedAt.split('T')[0]
              : project.updatedAt}
          </div>

          {/* 3-dot context menu */}
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-all focus:opacity-100 data-[state=open]:opacity-100"
                onClick={e => e.stopPropagation()}
              >
                <MoreVertical className="w-5 h-5 text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-premium">

              {/* Edit — admin only */}
              {user?.isMasterAdmin && (
                <DropdownMenuItem
                  className="cursor-pointer py-2.5 px-3 text-[14px] font-medium"
                  onClick={e => { e.stopPropagation(); setIsMenuOpen(false); setEditName(project.name); setEditCase(project.caseNumber); setEditOpen(true); }}
                >
                  <Edit className="w-4 h-4 mr-3 text-surface-500" /> Edit Project
                </DropdownMenuItem>
              )}

              {/* Share Access — opens real ShareModal */}
              <DropdownMenuItem
                className="cursor-pointer py-2.5 px-3 text-[14px] font-medium"
                onClick={e => { e.stopPropagation(); setIsMenuOpen(false); setShareOpen(true); }}
              >
                <Share className="w-4 h-4 mr-3 text-surface-500" /> Share Access
              </DropdownMenuItem>

              {/* Project Settings — navigate into project */}
              <DropdownMenuItem
                className="cursor-pointer py-2.5 px-3 text-[14px] font-medium"
                onClick={e => { e.stopPropagation(); setIsMenuOpen(false); handleProjectClick(); }}
              >
                <Settings className="w-4 h-4 mr-3 text-surface-500" /> Open Project
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              {/* Delete — admin only */}
              {user?.isMasterAdmin && (
                <DropdownMenuItem
                  className="cursor-pointer py-2.5 px-3 text-[14px] font-medium text-red-600 focus:bg-red-50 focus:text-red-700"
                  onClick={e => { e.stopPropagation(); setIsMenuOpen(false); setDeleteOpen(true); }}
                >
                  <Trash2 className="w-4 h-4 mr-3" /> Delete Project
                </DropdownMenuItem>
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ─── Share Modal ──────────────────────────────────────────────────────── */}
      {shareOpen && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          fileName={project.name}
          projectId={project.id}
        />
      )}

      {/* ─── Edit Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={open => !open && setEditOpen(false)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4 text-brand-600" /> Edit Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-surface-700">Project Name</label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                disabled={isSaving}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-surface-700">Case Number</label>
              <Input
                value={editCase}
                onChange={e => setEditCase(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-100 mt-4">
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={isSaving} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={isSaving || !editName.trim() || !editCase.trim()}
              className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-6"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Dialog ────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={open => !open && setDeleteOpen(false)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Project
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-surface-600 pt-2">
            Are you sure you want to delete <strong>"{project.name}"</strong>?
            This will permanently remove all files and member access. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-100 mt-4">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={isDeleting} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-6"
            >
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : 'Delete Project'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
