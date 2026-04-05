/**
 * Field Visit Task Template
 * For crop issues, pest management, field observations
 */

import { z } from "zod";
import { TaskTemplate, TaskField } from "../schemas/task";

export const FieldVisitFieldsSchema = z.object({
  field_id: z.string().trim().optional(),
  crop: z.string().trim().optional(),
  issue: z.string().trim().optional(),
  severity: z.coerce.number().int().min(1).max(5).default(3),
});

export type FieldVisitFields = z.infer<typeof FieldVisitFieldsSchema>;

export const FieldVisitTemplate = {
  id: 'field_visit',
  name: 'Field Visit',
  description: 'Record crop issues, pest damage, field observations',
  icon: '🌾',
  
  schema: FieldVisitFieldsSchema,
  
  // Note: severity default is now in schema (z.coerce.number().default(3))
  // This keeps defaults in one place (schema)
  defaults: {},
  
  fields: [
    {
      key: 'field_id',
      label: 'Field ID',
      type: 'text',
      placeholder: 'e.g., Field 7, Lote Norte',
      helpText: 'Identifier for the field or lot',
    },
    {
      key: 'crop',
      label: 'Crop',
      type: 'text',
      placeholder: 'e.g., Corn, Soybean, Wheat',
      helpText: 'Type of crop in this field',
    },
    {
      key: 'issue',
      label: 'Issue',
      type: 'textarea',
      placeholder: 'Describe the issue observed',
      helpText: 'Pest damage, disease, nutrient deficiency, etc.',
    },
    {
      key: 'severity',
      label: 'Severity',
      type: 'number',
      required: false,
      validation: { min: 1, max: 5 },
      helpText: '1 = Minor, 5 = Critical',
    },
  ] satisfies TaskField[],
  
  exportConfig: {
    csvColumns: ['id', 'createdAt', 'field_id', 'crop', 'issue', 'severity', 'note', 'lat', 'lon'],
    jsonTransform: (record) => {
      // Use createdAt as primary timestamp
      const createdAt = record.createdAt ?? (record as any).ts ?? Date.now();
      return {
        ...record,
        formatted_date: new Date(createdAt).toISOString(),
        formatted_created: new Date(createdAt).toISOString(),
      };
    },
  },
  
  ragConfig: {
    embeddingFields: ['field_id', 'crop', 'issue', 'note', 'photo_caption', 'audio_transcript'],
    generateEmbeddingText: (record) => {
      const parts = [];
      if (record.field_id) parts.push(`Field: ${record.field_id}`);
      if (record.crop) parts.push(`Crop: ${record.crop}`);
      if (record.issue) parts.push(`Issue: ${record.issue}`);
      if (record.note) parts.push(`Notes: ${record.note}`);
      // Use != null to handle 0 values correctly (if severity could be 0)
      if (record.severity != null) parts.push(`Severity: ${record.severity}/5`);
      if (record.photo_caption) parts.push(`Photo: ${record.photo_caption}`);
      if (record.audio_transcript) parts.push(`Audio: ${record.audio_transcript}`);
      return parts.join('. ');
    },
  },
} satisfies TaskTemplate;

