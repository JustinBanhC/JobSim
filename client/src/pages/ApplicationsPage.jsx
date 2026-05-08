import ApplicationsPipeline from '../components/ApplicationsPipeline';
import PageHeader from '../components/layout/PageHeader';
import { useApplications } from '../hooks/useApplications';

export default function ApplicationsPage() {
  const { applications, grouped, loading, error, refresh, create, update, move, remove } = useApplications();

  return (
    <>
      <PageHeader
        variant="dossier"
        eyebrow="Job applications"
        title="Pipeline"
        description="Dense index: filter on the server, sort in the client, change stage from the row control. Row opens the full dossier."
      />
      {error && (
        <div
          className="mx-5 md:mx-10 lg:mx-14 mt-4 p-3 border text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{
            borderColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
            backgroundColor: 'rgba(248,113,113,0.06)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
          />
          <p className="text-[10px] font-mono uppercase tracking-[0.28em]" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Loading…
          </p>
        </div>
      ) : (
        <ApplicationsPipeline
          applications={applications}
          grouped={grouped}
          onMove={move}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
          onFilter={refresh}
        />
      )}
    </>
  );
}
