import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Visit } from '@farm-visit/shared';

interface ConfirmFieldsModalProps {
  open: boolean;
  onClose: () => void;
  fields: Partial<Visit> | null;
  onSave: (fields: Partial<Visit>) => void;
  saving: boolean;
}

export function ConfirmFieldsModal({
  open,
  onClose,
  fields: initialFields,
  onSave,
  saving,
}: ConfirmFieldsModalProps) {
  const [fields, setFields] = useState<Partial<Visit>>(initialFields || {});

  useEffect(() => {
    if (initialFields) {
      setFields(initialFields);
    }
  }, [initialFields]);

  if (!open || !fields) return null;

  const handleSave = () => {
    onSave(fields);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="w-[min(720px,92vw)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-semibold">Confirm Field Visit Details</div>
              <div className="text-xs text-slate-500">Edit any value before saving</div>
            </div>
            <button onClick={onClose} className="text-slate-500 text-sm">
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Field ID</span>
              <input
                value={fields.field_id || ''}
                onChange={(e) => setFields({ ...fields, field_id: e.target.value })}
                placeholder="e.g., Field 12"
                className="rounded-md border border-slate-300 px-2 py-1"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Crop</span>
              <input
                value={fields.crop || ''}
                onChange={(e) => setFields({ ...fields, crop: e.target.value })}
                placeholder="e.g., corn"
                className="rounded-md border border-slate-300 px-2 py-1"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Issue</span>
              <input
                value={fields.issue || ''}
                onChange={(e) => setFields({ ...fields, issue: e.target.value })}
                placeholder="e.g., aphids"
                className="rounded-md border border-slate-300 px-2 py-1"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Severity (1-5)</span>
              <input
                type="number"
                min="1"
                max="5"
                value={fields.severity || ''}
                onChange={(e) =>
                  setFields({
                    ...fields,
                    severity: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="1-5"
                className="rounded-md border border-slate-300 px-2 py-1"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-slate-600">Note</span>
              <textarea
                value={fields.note || ''}
                onChange={(e) => setFields({ ...fields, note: e.target.value })}
                placeholder="Additional notes..."
                className="rounded-md border border-slate-300 px-2 py-1"
                rows={2}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Latitude</span>
              <input
                type="number"
                step="0.000001"
                value={fields.lat || ''}
                onChange={(e) =>
                  setFields({ ...fields, lat: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="rounded-md border border-slate-300 px-2 py-1"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Longitude</span>
              <input
                type="number"
                step="0.000001"
                value={fields.lon || ''}
                onChange={(e) =>
                  setFields({ ...fields, lon: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="rounded-md border border-slate-300 px-2 py-1"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fields.photo_present || false}
                onChange={(e) => setFields({ ...fields, photo_present: e.target.checked })}
                className="rounded"
              />
              <span className="text-slate-600">Photo Present</span>
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={handleSave}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Visit'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


