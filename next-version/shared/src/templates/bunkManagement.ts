/**
 * Bunk Management Task Template
 * For feed inventory, bunk monitoring, feed quality tracking
 */

import { z } from "zod";
import { TaskTemplate, TaskField } from "../schemas/task";

export const BunkManagementFieldsSchema = z.object({
  bunk_id: z.string().trim(),
  feed_type: z.string().trim().optional(),
  quantity_kg: z.coerce.number().min(0).optional(),
  quality_score: z.coerce.number().int().min(1).max(10).default(7),
  temperature_c: z.coerce.number().optional(),
  moisture_percent: z.coerce.number().min(0).max(100).optional(),
  mold_present: z.boolean().optional(),
  consumption_rate_kg_per_day: z.coerce.number().min(0).optional(),
  days_remaining: z.coerce.number().int().min(0).optional(),
  action_taken: z.string().trim().optional(),
});

export type BunkManagementFields = z.infer<typeof BunkManagementFieldsSchema>;

export const BunkManagementTemplate = {
  id: 'bunk_management',
  name: 'Bunk Management',
  description: 'Track feed inventory, bunk conditions, and feed quality',
  icon: '🌾',
  
  schema: BunkManagementFieldsSchema,
  
  // Note: quality_score default is now in schema (z.coerce.number().default(7))
  defaults: {},
  
  fields: [
    {
      key: 'bunk_id',
      label: 'Bunk ID',
      type: 'text',
      required: true,
      placeholder: 'e.g., Bunk 1, North Bunk',
      helpText: 'Identifier for the feed bunk',
    },
    {
      key: 'feed_type',
      label: 'Feed Type',
      type: 'text',
      placeholder: 'e.g., Corn silage, Hay, TMR',
      helpText: 'Type of feed in the bunk',
    },
    {
      key: 'quantity_kg',
      label: 'Quantity (kg)',
      type: 'number',
      validation: { min: 0 },
      helpText: 'Amount of feed remaining',
    },
    {
      key: 'quality_score',
      label: 'Quality Score',
      type: 'number',
      validation: { min: 1, max: 10 },
      helpText: '1 = Poor, 10 = Excellent',
    },
    {
      key: 'temperature_c',
      label: 'Temperature (°C)',
      type: 'number',
      helpText: 'Feed temperature (important for silage)',
    },
    {
      key: 'mold_present',
      label: 'Mold Present',
      type: 'boolean',
      helpText: 'Check if mold is visible',
    },
    {
      key: 'days_remaining',
      label: 'Days Remaining',
      type: 'number',
      validation: { min: 0 },
      helpText: 'Estimated days until bunk is empty',
    },
  ] satisfies TaskField[],
  
  exportConfig: {
    csvColumns: [
      'id', 'ts', 'createdAt', 'bunk_id', 'feed_type', 'quantity_kg', 'quality_score',
      'temperature_c', 'mold_present', 'days_remaining', 'note', 'lat', 'lon',
    ],
    jsonTransform: (record) => {
      const ts = (record.ts ?? (record as any).createdAt) as number | undefined;
      return {
        ...record,
        formatted_date: ts ? new Date(ts).toISOString() : null,
        formatted_created: (record as any).createdAt ? new Date((record as any).createdAt).toISOString() : null,
      };
    },
  },
  
  ragConfig: {
    embeddingFields: ['bunk_id', 'feed_type', 'quality_score', 'note'],
    generateEmbeddingText: (record) => {
      const parts = [];
      if (record.bunk_id) parts.push(`Bunk: ${record.bunk_id}`);
      if (record.feed_type) parts.push(`Feed: ${record.feed_type}`);
      if (record.quantity_kg != null) parts.push(`Quantity: ${record.quantity_kg}kg`);
      if (record.quality_score != null) parts.push(`Quality: ${record.quality_score}/10`);
      if (record.mold_present) parts.push('⚠️ Mold detected');
      if (record.note) parts.push(`Notes: ${record.note}`);
      return parts.join('. ');
    },
  },
} satisfies TaskTemplate;

