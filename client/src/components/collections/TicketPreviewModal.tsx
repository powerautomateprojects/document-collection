import { X } from 'lucide-react'
import type { FieldType, FieldDisplayStyle, TableColumn } from '../../types'

interface BuilderField {
  _key: string
  fieldKey: string
  type: FieldType
  label: string
  subtitle: string
  page: number
  required: boolean
  options: string[]
  displayStyle: FieldDisplayStyle
  tableColumns: TableColumn[]
}

interface TicketPreviewModalProps {
  fields: BuilderField[]
  templateTitle: string
  templateDescription: string
  onClose: () => void
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: 'Short Text',
  date: 'Date',
  long_text: 'Long Text',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
  document: 'Document',
  attachment: 'Attachment',
  signature: 'Signature',
  confirmation: 'Confirmation',
  custom_table: 'Custom Table',
  rating: 'Rating (1–5)',
  comment: 'Comment (Read-only)',
  matrix_likert_scale: 'Matrix Likert Scale',
  location: 'Location',
}

function PreviewFieldCard({ field }: { field: BuilderField }) {
  const label = field.label.trim() || '(Untitled field)'
  const inputClass = 'w-full rounded border border-[#CBD5E1] dark:border-[#475569] bg-white dark:bg-[#111827] px-3 py-2 text-sm text-[#1E293B] dark:text-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-80'

  return (
    <div className="rounded border border-[#E2E8F0] dark:border-[#334155] bg-[#FAFAFA] dark:bg-[#0F172A] p-3 space-y-3">
      <div>
        <div className="text-sm font-semibold text-[#1E293B] dark:text-[#F1F5F9]">{label}{field.required ? ' *' : ''}</div>
        {field.subtitle && <div className="text-xs text-[#64748B] mt-1">{field.subtitle}</div>}
        <div className="mt-1 text-[11px] uppercase tracking-wide text-[#94A3B8]">{FIELD_TYPE_LABELS[field.type]}</div>
      </div>

      {field.type === 'comment' ? (
        <div
          className="rounded border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#111827] p-3 text-sm text-[#64748B] dark:text-[#CBD5E1]"
          dangerouslySetInnerHTML={{ __html: field.label || 'Comment preview' }}
        />
      ) : field.type === 'long_text' ? (
        <textarea className={inputClass} rows={3} disabled placeholder="Enter value…" />
      ) : field.type === 'date' ? (
        <input type="date" className={inputClass} disabled />
      ) : field.type === 'single_choice' ? (
        <select className={inputClass} disabled>
          <option value="">— select —</option>
          {(field.options ?? []).filter(option => option !== '__DCP_OTHER_OPTION__').map(option => (
            <option key={option} value={option}>{option || 'Option'}</option>
          ))}
        </select>
      ) : field.type === 'multiple_choice' ? (
        <div className="space-y-2">
          {(field.options ?? []).filter(option => option !== '__DCP_OTHER_OPTION__').map(option => (
            <label key={option} className="flex items-center gap-2 text-sm text-[#1E293B] dark:text-[#F1F5F9]">
              <input type="checkbox" disabled className="accent-[#2563EB]" />
              <span>{option || 'Option'}</span>
            </label>
          ))}
        </div>
      ) : field.type === 'rating' ? (
        <div className="flex items-center gap-1 flex-wrap">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              disabled
              className={['h-8 w-8 rounded text-sm font-semibold', n <= 3 ? 'bg-[#2563EB] text-white' : 'bg-[#E2E8F0] text-[#64748B] dark:bg-[#334155] dark:text-[#CBD5E1]'].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
      ) : field.type === 'confirmation' ? (
        <label className="flex items-center gap-2 text-sm text-[#1E293B] dark:text-[#F1F5F9]">
          <input type="checkbox" disabled className="accent-[#2563EB]" />
          I confirm
        </label>
      ) : field.type === 'custom_table' ? (
        <div className="overflow-x-auto rounded border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#111827]">
          <table className="min-w-full text-xs text-[#1E293B] dark:text-[#F1F5F9]">
            <thead className="bg-[#F8FAFC] dark:bg-[#0F172A] text-[#64748B]">
              <tr>{(field.tableColumns ?? []).map(column => <th key={column.name} className="border-b border-[#E2E8F0] dark:border-[#334155] px-2 py-1 text-left">{column.name || 'Column'}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{(field.tableColumns ?? []).map(column => <td key={column.name} className="border-b border-[#E2E8F0] dark:border-[#334155] px-2 py-2">—</td>)}</tr>
            </tbody>
          </table>
        </div>
      ) : field.type === 'matrix_likert_scale' ? (
        <div className="overflow-x-auto rounded border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#111827] p-2 text-xs">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-2 py-1 text-left text-[#64748B]">Rows</th>
                <th className="border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-2 py-1 text-left text-[#64748B]">Columns</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-[#E2E8F0] dark:border-[#334155] px-2 py-1 text-[#1E293B] dark:text-[#F1F5F9]">Sample row</td>
                <td className="border border-[#E2E8F0] dark:border-[#334155] px-2 py-1 text-[#64748B]">1 2 3 4 5</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <input className={inputClass} type="text" disabled placeholder="Enter value…" />
      )}
    </div>
  )
}

export default function TicketPreviewModal({
  fields,
  templateTitle,
  templateDescription,
  onClose,
}: TicketPreviewModalProps) {
  const visibleFields = fields.filter(field => field.label.trim() !== '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#334155] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1E293B] dark:text-[#F1F5F9]">Preview: {templateTitle || 'Untitled Ticket'}</h2>
            {templateDescription && <p className="mt-1 text-sm text-[#64748B]">{templateDescription}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1E293B] dark:hover:bg-[#0F172A] dark:hover:text-[#F1F5F9]"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-3">
          {visibleFields.length === 0 ? (
            <p className="text-sm text-[#64748B]">No fields are configured yet for this template.</p>
          ) : (
            visibleFields.map(field => <PreviewFieldCard key={field._key} field={field} />)
          )}
        </div>

        <div className="flex items-center justify-end border-t border-[#E2E8F0] dark:border-[#334155] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
