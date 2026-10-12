import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function WorkspacePagination({
  page,
  onChange,
  label,
}: {
  page: { page: number; pages: number; total: number; from: number; to: number };
  onChange: (page: number) => void;
  label: string;
}) {
  return (
    <div className="workspace-pagination" aria-label={`Navigasi halaman ${label}`}>
      <span>
        {page.from}–{page.to} dari {page.total} {label}
      </span>
      <div className="row">
        <button
          className="secondary"
          aria-label={`Halaman ${label} sebelumnya`}
          disabled={page.page <= 1}
          onClick={() => onChange(page.page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Halaman {page.page} / {page.pages}
        </span>
        <button
          className="secondary"
          aria-label={`Halaman ${label} berikutnya`}
          disabled={page.page >= page.pages}
          onClick={() => onChange(page.page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
