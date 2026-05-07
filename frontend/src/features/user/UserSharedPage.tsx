import React from 'react';
import { HardDrive, Users, Clock } from 'lucide-react';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { useProjects } from '@/hooks/useProjects';
import { Loader2 } from 'lucide-react';

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const ProjectSkeleton = () => (
  <div className="w-full flex items-center justify-between p-4 rounded-xl border border-surface-200/80 bg-white shadow-soft mb-3 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-surface-100" />
      <div className="space-y-2">
        <div className="h-4 w-40 bg-surface-100 rounded" />
        <div className="h-3 w-24 bg-surface-100 rounded" />
      </div>
    </div>
    <div className="flex items-center gap-8">
      <div className="h-3 w-20 bg-surface-100 rounded" />
      <div className="h-3 w-16 bg-surface-100 rounded" />
    </div>
  </div>
);

// ─── Stat pill ────────────────────────────────────────────────────────────────

const StatPill = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) => (
  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-surface-200/80 rounded-xl shadow-soft">
    <div className="text-brand-500">{icon}</div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        {label}
      </p>
      <p className="text-[18px] font-bold text-surface-900 leading-tight">{value}</p>
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export const UserSharedPage = () => {
  const { data: projects, isLoading, error } = useProjects();

  if (error) {
    return (
      <div className="flex flex-col h-full max-w-5xl">
        <PageHeader projectCount={0} />
        <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 rounded-2xl mt-6">
          <div className="text-center">
            <p className="text-surface-500 font-medium">Failed to load projects.</p>
            <p className="text-surface-400 text-sm mt-1">
              {(error as any)?.message ?? 'Please check your connection and try again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const count = projects?.length ?? 0;

  return (
    <div className="flex flex-col h-full max-w-5xl">
      <PageHeader projectCount={count} />

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-8">
        <StatPill
          icon={<HardDrive className="w-4 h-4" />}
          label="Assigned Projects"
          value={isLoading ? '—' : count}
        />
        <StatPill
          icon={<Users className="w-4 h-4" />}
          label="Shared With Me"
          value={isLoading ? '—' : count}
        />
        <StatPill
          icon={<Clock className="w-4 h-4" />}
          label="Recent Activity"
          value="Today"
        />
      </div>

      {/* ── Section label ─────────────────────────────────────────────────── */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-3">
        Projects
      </p>

      {/* ── Project list ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <>
          <ProjectSkeleton />
          <ProjectSkeleton />
          <ProjectSkeleton />
        </>
      ) : count === 0 ? (
        <div className="flex flex-1 items-center justify-center border-2 border-dashed border-surface-200 rounded-2xl">
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center mx-auto mb-4">
              <HardDrive className="w-7 h-7 text-surface-300" />
            </div>
            <p className="text-surface-600 font-semibold text-base">No projects assigned yet</p>
            <p className="text-surface-400 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">
              Your admin will share project access with you. Check back soon.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {projects!.map((p: any) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Page header ──────────────────────────────────────────────────────────────

const PageHeader = ({ projectCount }: { projectCount: number }) => (
  <div className="mb-6">
    <h1 className="text-2xl font-semibold text-surface-900 tracking-tight">
      Shared with me
    </h1>
    <p className="text-sm text-surface-400 mt-1 font-medium">
      {projectCount > 0
        ? `You have access to ${projectCount} project${projectCount > 1 ? 's' : ''}`
        : 'Projects shared with you will appear here'}
    </p>
  </div>
);
