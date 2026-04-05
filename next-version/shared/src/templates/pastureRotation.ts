/**
 * Pasture Rotation Task Template
 * For rotational grazing management, paddock state tracking
 */

import { z } from "zod";
import { TaskTemplate, TaskField } from "../schemas/task";

export const PastureRotationFieldsSchema = z.object({
  paddock_id: z.string().trim(),
  event_type: z.enum([
    'MOVE_IN',
    'MOVE_OUT',
    'CONDITION_CHECK',
    'MARK_READY',
    'WEATHER_EVENT',
    'MAINTENANCE_START',
    'MAINTENANCE_END',
    'PHOTO_RECORD',
    'VET_VISIT',
    'SUPPLEMENT',
    'NOTE',
  ]).default('NOTE'),
  from_state: z.enum(['GRAZING', 'RESTING', 'RECOVERING', 'READY', 'RESERVED', 'MAINTENANCE']).optional(),
  to_state: z.enum(['GRAZING', 'RESTING', 'RECOVERING', 'READY', 'RESERVED', 'MAINTENANCE']).optional(),
  animal_count: z.coerce.number().int().min(0).optional(),
  animal_type: z.enum(['cattle', 'sheep', 'goats', 'mixed']).optional(),
  forage_height_cm: z.coerce.number().min(0).optional(),
  forage_quality: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  ground_cover_percent: z.coerce.number().min(0).max(100).optional(),
  weather_conditions: z.string().trim().optional(),
});

export type PastureRotationFields = z.infer<typeof PastureRotationFieldsSchema>;

export const PastureRotationTemplate = {
  id: 'pasture_rotation',
  name: 'Pasture Rotation',
  description: 'Track rotational grazing, paddock states, and animal movements',
  icon: '🐄',
  
  schema: PastureRotationFieldsSchema,
  
  // Note: event_type default is now in schema (z.enum().default('NOTE'))
  defaults: {},
  
  fields: [
    {
      key: 'paddock_id',
      label: 'Paddock ID',
      type: 'text',
      required: true,
      placeholder: 'e.g., Paddock Norte, Lote 7',
      helpText: 'Identifier for the paddock',
    },
    {
      key: 'event_type',
      label: 'Event Type',
      type: 'select',
      required: true,
      options: [
        { value: 'MOVE_IN', label: 'Move Animals In' },
        { value: 'MOVE_OUT', label: 'Move Animals Out' },
        { value: 'CONDITION_CHECK', label: 'Condition Check' },
        { value: 'MARK_READY', label: 'Mark as Ready' },
        { value: 'WEATHER_EVENT', label: 'Weather Event' },
        { value: 'PHOTO_RECORD', label: 'Photo Record' },
        { value: 'NOTE', label: 'General Note' },
      ],
    },
    {
      key: 'from_state',
      label: 'From State',
      type: 'select',
      options: [
        { value: 'GRAZING', label: 'Grazing' },
        { value: 'RESTING', label: 'Resting' },
        { value: 'RECOVERING', label: 'Recovering' },
        { value: 'READY', label: 'Ready' },
        { value: 'RESERVED', label: 'Reserved' },
        { value: 'MAINTENANCE', label: 'Maintenance' },
      ],
    },
    {
      key: 'to_state',
      label: 'To State',
      type: 'select',
      options: [
        { value: 'GRAZING', label: 'Grazing' },
        { value: 'RESTING', label: 'Resting' },
        { value: 'RECOVERING', label: 'Recovering' },
        { value: 'READY', label: 'Ready' },
        { value: 'RESERVED', label: 'Reserved' },
        { value: 'MAINTENANCE', label: 'Maintenance' },
      ],
    },
    {
      key: 'animal_count',
      label: 'Animal Count',
      type: 'number',
      validation: { min: 0 },
      helpText: 'Number of animals (for move events)',
    },
    {
      key: 'animal_type',
      label: 'Animal Type',
      type: 'select',
      options: [
        { value: 'cattle', label: 'Cattle' },
        { value: 'sheep', label: 'Sheep' },
        { value: 'goats', label: 'Goats' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    {
      key: 'forage_height_cm',
      label: 'Forage Height (cm)',
      type: 'number',
      validation: { min: 0 },
      helpText: 'Height of forage/grass in centimeters',
    },
    {
      key: 'forage_quality',
      label: 'Forage Quality',
      type: 'select',
      options: [
        { value: 'excellent', label: 'Excellent' },
        { value: 'good', label: 'Good' },
        { value: 'fair', label: 'Fair' },
        { value: 'poor', label: 'Poor' },
      ],
    },
    {
      key: 'ground_cover_percent',
      label: 'Ground Cover (%)',
      type: 'number',
      validation: { min: 0, max: 100 },
      helpText: 'Percentage of ground covered by vegetation',
    },
  ] satisfies TaskField[],
  
  exportConfig: {
    csvColumns: [
      'id', 'ts', 'createdAt', 'paddock_id', 'event_type', 'from_state', 'to_state',
      'animal_count', 'animal_type', 'forage_height_cm', 'forage_quality',
      'ground_cover_percent', 'note', 'lat', 'lon',
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
    embeddingFields: ['paddock_id', 'event_type', 'note', 'forage_quality'],
    generateEmbeddingText: (record) => {
      const parts = [];
      if (record.paddock_id) parts.push(`Paddock: ${record.paddock_id}`);
      if (record.event_type) parts.push(`Event: ${record.event_type}`);
      if (record.from_state && record.to_state) {
        parts.push(`State change: ${record.from_state} → ${record.to_state}`);
      }
      if (record.animal_count != null) parts.push(`${record.animal_count} ${record.animal_type || 'animals'}`);
      if (record.forage_height_cm != null) parts.push(`Forage height: ${record.forage_height_cm}cm`);
      if (record.forage_quality) parts.push(`Quality: ${record.forage_quality}`);
      if (record.note) parts.push(`Notes: ${record.note}`);
      return parts.join('. ');
    },
  },
} satisfies TaskTemplate;

