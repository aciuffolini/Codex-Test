/**
 * Task Template Registry
 * Central registry for all farm task templates
 */

import { TaskTemplate } from "../schemas/task";
import { FieldVisitTemplate } from "./fieldVisit";
import { PastureRotationTemplate } from "./pastureRotation";
import { BunkManagementTemplate } from "./bunkManagement";

/**
 * All available task templates
 */
export const taskTemplates: Record<string, TaskTemplate> = {
  field_visit: FieldVisitTemplate,
  pasture_rotation: PastureRotationTemplate,
  bunk_management: BunkManagementTemplate,
};

/**
 * Get a template by ID
 */
export function getTemplate(templateId: string): TaskTemplate | undefined {
  return taskTemplates[templateId];
}

/**
 * Get all available templates
 */
export function getAllTemplates(): TaskTemplate[] {
  return Object.values(taskTemplates);
}

/**
 * Register a new template (for future extensibility)
 */
export function registerTemplate(template: TaskTemplate): void {
  taskTemplates[template.id] = template;
}


