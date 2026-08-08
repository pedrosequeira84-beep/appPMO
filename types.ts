export interface Project {
  id: string;
  name: string;
  clientName: string;
  pm: string;
  opportunityNumber: string;
  status: 'En ejecución' | 'Intervención temprana' | 'Soporte' | 'Finalizado' | 'Cancelado' | 'POC';
  priority?: 1 | 2 | 3 | 4 | 5;
  startDate: string;
  theoreticalEndDate: string;
  realEndDate?: string;
  progress: number;
  budget: Record<string, number>;
  milestones: Milestone[];
  ocs: OC[];
  createdAt: string;
  hwValue?: number;
  servicesValue?: number;
  ocValue?: number;
  hwCost?: number;
  servicesCost?: number;
  cm?: number;
  valuesComments?: string;
  updatedAt?: string;
  documentationLink?: string;
  healthStatus: 'Auto' | 'Verde' | 'Amarillo' | 'Rojo';
  dateChangeHistory?: DateChangeHistoryEntry[];
  statusHistory?: ProjectStatusUpdate[];
  vendors?: string[];
  thirdPartyServices?: boolean;
  thirdPartyProvider?: string;
  vertical?: string;
  segment?: string;
  initialRealValues?: Record<string, number>;
  aiSummary?: string;
}

export const SEGMENTS = [
  "Banca & Finanzas",
  "Comercial & Educación",
  "Expo",
  "Fuerzas Federales",
  "Gobierno",
  "Interior Litoral",
  "Interior NOS",
  "Recursos Naturales",
  "Telcos & Media",
  "Municipios y PBA y Desarrollo de negocios",
  "SMB",
  "BAU - GOBIERNO",
  "BAU - OIL & GAS TELCOS",
  "BAU - BANCA Y EMPRESA"
];

export const VERTICALS = [
  "Cloud Aeros",
  "Cloud AI",
  "Cloud AWS",
  "Cloud otros SVS",
  "Colaboración",
  "Observabilidad",
  "Ciberseguridad",
  "BAU-Conectividad",
  "BAU-Datacenter",
  "BAU-Comunicaciones",
  "BAU-IoT",
  "HVAC",
  "Energía"
];

export const VENDORS = [
  "Amazon",
  "Cambium",
  "Cisco",
  "Dell",
  "Google",
  "Huawei",
  "Motorola",
  "Oracle",
  "Otra marca",
  "BDCOM",
  "Fortinet",
  "CheckPoint",
  "Vicarius",
  "Sohos",
  "Cyrebro",
  "Quest",
  "Vaio",
  "Positivo",
  "BGH TP SP",
  "Denwa",
  "AppDynamics",
  "Avigilon",
  "Microsoft",
  "XFusion",
  "Nutanix",
  "Commvault",
  "Huawei DP",
  "Lenovo",
  "HPE"
];

export interface DateChangeHistoryEntry {
  id: string;
  previousDate: string | null;
  newDate: string;
  changeIds: string[];
  changedAt: string;
}

export interface ProjectStatusUpdate {
  id: string;
  status: string;
  createdAt: string;
  createdBy?: string;
  type?: 'Técnico' | 'PMO';
}

export interface Milestone {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  date: string;
  realDate?: string;
  dateChangeHistory?: DateChangeHistoryEntry[];
  receivedAmount: number;
  isReceived: boolean;
  currency: string;
  ocId?: string;
  ocPosition?: string;
  receivedPercentage?: number;
  parentId?: string;
  createdAt?: string;
  comments?: string;
}

export interface OC {
  id: string;
  description: string;
  amount: number;
}

export interface Expense {
  id: string;
  projectId: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface Risk {
  id: string;
  projectId: string;
  description: string;
  probability: 'Baja' | 'Media' | 'Alta';
  impact: 'Bajo' | 'Medio' | 'Alto';
  isProblem: boolean;
  isMitigated: boolean;
  createdAt: string;
  plan?: string;
  date?: string;
}

export interface Change {
  id: string;
  projectId: string;
  description: string;
  type: 'Facturable' | 'No Facturable';
  date: string;
  registrationNumber?: string;
  createdAt: string;
}

export interface LessonLearned {
  id: string;
  projectId: string;
  description: string;
  category: string;
  impact: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  capacity_id?: string;
  is_active?: boolean;
  isExternal?: boolean;
  sdRole?: 'administrador' | 'responsable' | null;
}

export interface DocumentationSection {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
}

export interface DocumentationLink {
  id: string;
  sectionId: string;
  title: string;
  url: string;
  description?: string;
  createdAt: string;
}

export interface CapacityAssignment {
  id: string;
  memberId: string;
  type: 'project' | 'sp-bau' | 'tableros-reportes' | 'gestion-general' | 'reuniones' | 'capacitaciones' | 'licencias' | 'preventiva-poc' | 'consultoria' | 'logistica' | 'facturacion';
  projectId: string | null;
  date: string;
  hours: number;
  observations: string;
  isExtra?: boolean;
  source?: string;
  sdTimeEntryId?: string | null;
}

export interface CapacityData {
  assignments: CapacityAssignment[];
}

export interface DashboardFilters {
  status: string | null;
  vendor: string | null;
  vertical: string | null;
  segment: string | null;
}

export type ViewName = 'dashboard-pmo' | 'dashboard-ejecutivo' | 'alta-proyecto' | 'gastos' | 'hitos' | 'capacity' | 'riesgos' | 'cambios' | 'lecciones' | 'documentation' | 'perfil' | 'team-management' | 'cierre-fiscal' | 'operaciones-sd';

export const COST_CATEGORIES = [
  "1-Costos Comerciales",
  "10-Productos - Materiales (HW/SW) Solución Principal",
  "11-Servicios Propios - Horas de PM",
  "12-Servicios Propios - Horas Ingenieros",
  "13-Servicios Soporte y Mantenimiento (MO Propia)",
  "14-Viáticos",
  "15-Servicios de Terceros",
  "16-Garantías / Soporte técnico Vendors",
  "17-Productos - Materiales (HW/SW) Solución Complementaria"
];

// Raw DB Row Types from Supabase
export interface DBProject { id: string; name: string; client_name: string; pm: string; opportunity_number: string; status: any; start_date: string; theoretical_end_date: string; real_end_date?: string; progress: number; budget: any; hw_value: number; services_value: number; hw_cost: number; services_cost: number; cm: number; values_comments?: string; created_at: string; updated_at?: string; documentation_link?: string; health_status: any; date_change_history: any; status_history: any; vendors: any; third_party_services?: boolean; third_party_provider?: string; vertical?: string; segment?: string; priority?: 1 | 2 | 3 | 4 | 5; initial_real_values: any; ai_summary?: string; }
export interface DBMilestone { id: string; project_id: string; description: string; amount: number; date: string; real_date?: string; date_change_history?: any; received_amount: number; is_received: boolean; currency: string; oc_id?: string; oc_position?: string; received_percentage?: number; parent_id?: string; created_at?: string; }
export interface DBOC { id: string; project_id: string; description: string; amount: number; }
export interface DBRisk { id: string; project_id: string; description: string; probability: any; impact: any; is_problem: boolean; is_mitigated?: boolean; plan?: string; date?: string; created_at: string; }
export interface DBChange { id: string; project_id: string; description: string; type: any; date: string; registration_number?: string; created_at: string; }
export interface DBLesson { id: string; project_id: string; description: string; category: string; impact: string; created_at: string; }
export interface DBExpense { id: string; project_id: string; date: string; category: string; amount: number; description: string; created_at: string; }
export interface DBTeamMember { id: string; name: string; role: string; email?: string; capacity_id?: string; is_active?: boolean; is_external?: boolean; sd_role?: string | null; }
export interface DBCapacityAssignment { id: string; member_id: string; user_email?: string; type: any; project_id: string | null; date?: string; week_start?: string; hours: number; observations?: string; source?: string; sd_time_entry_id?: string | null; }
export interface DBDocSection { id: string; title: string; parent_id: string | null; order: number; }
export interface DBDocLink { id: string; section_id: string; title: string; url: string; description?: string; created_at: string; }

// ---------------------------------------------------------------------------
// Operaciones S&D
// ---------------------------------------------------------------------------

export const SD_WORK_TYPES = [
  'proyecto', 'cambio', 'incidente', 'problema', 'solicitud',
  'mantenimiento', 'implementacion', 'mejora', 'documentacion'
] as const;
export type SDWorkType = typeof SD_WORK_TYPES[number];

export const SD_WORK_TYPE_LABELS: Record<SDWorkType, string> = {
  proyecto: 'Proyecto',
  cambio: 'Cambio',
  incidente: 'Incidente',
  problema: 'Problema',
  solicitud: 'Solicitud',
  mantenimiento: 'Mantenimiento',
  implementacion: 'Implementación',
  mejora: 'Mejora',
  documentacion: 'Documentación'
};

export type SDTaskStatus = 'backlog' | 'in_progress' | 'done';
export type SDPriority = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type SDSeverity = 'Baja' | 'Media' | 'Alta' | 'Crítica';

export interface SDTask {
  id: string;
  code: string;
  projectId: string;
  parentTaskId: string | null;
  workType: SDWorkType;
  title: string;
  description?: string;
  assigneeMemberId: string | null;
  status: SDTaskStatus;
  plannedDate: string | null;
  commitmentDate: string | null;
  estimatedHours: number | null;
  priority: SDPriority | null;
  severity: SDSeverity | null;
  tags: string[];
  vendorSupportRequired: boolean;
  vendorName?: string | null;
  vendorTicketNumber?: string | null;
  progressPercent: number;
  progressManualOverride: boolean;
  blocked: boolean;
  blockedReason?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface SDChecklistItem {
  id: string;
  taskId: string;
  label: string;
  isDone: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface SDChecklistTemplateItem {
  id: string;
  workType: SDWorkType;
  label: string;
  sortOrder: number;
}

export interface SDTimeEntry {
  id: string;
  taskId: string;
  memberId: string;
  date: string;
  hours: number;
  comment?: string | null;
  capacityAssignmentId?: string | null;
  createdAt: string;
}

export interface SDDateHistoryEntry {
  id: string;
  taskId: string;
  previousDate: string | null;
  newDate: string;
  memberId?: string | null;
  reason: string;
  changedAt: string;
}

export interface SDDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  createdAt: string;
}

export interface SDBlock {
  id: string;
  taskId: string;
  description: string;
  createdBy?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface SDComment {
  id: string;
  taskId: string;
  memberId?: string | null;
  body: string;
  createdAt: string;
}

export interface SDAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  uploadedBy?: string | null;
  uploadedAt: string;
}

export interface SDExternalAccess {
  id: string;
  memberId: string;
  projectId: string;
  taskId: string | null;
  grantedBy?: string | null;
  grantedAt: string;
}

export interface SDAuditEntry {
  id: string;
  taskId: string;
  memberId?: string | null;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export const SD_NOTIFICATION_TYPES = [
  'assignment', 'date_change', 'comment', 'block', 'vendor_support', 'due_soon', 'dependency_resolved'
] as const;
export type SDNotificationType = typeof SD_NOTIFICATION_TYPES[number];

export interface SDNotification {
  id: string;
  memberId: string;
  type: SDNotificationType;
  taskId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export type SDRiskLevel = 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
export type SDCompliance = 'Cumplida' | 'En Riesgo' | 'Incumplida' | 'Sin Compromiso';

// Raw DB Row Types
export interface DBSDTask { id: string; code: string; project_id: string; parent_task_id?: string | null; work_type: string; title: string; description?: string; assignee_member_id: string | null; status: string; planned_date: string | null; commitment_date: string | null; estimated_hours: number | null; priority: string | null; severity: string | null; tags: string[] | null; vendor_support_required: boolean; vendor_name?: string | null; vendor_ticket_number?: string | null; progress_percent: number; progress_manual_override: boolean; blocked: boolean; blocked_reason?: string | null; created_by?: string | null; created_at: string; updated_at: string; started_at?: string | null; completed_at?: string | null; }
export interface DBSDChecklistItem { id: string; task_id: string; label: string; is_done: boolean; sort_order: number; created_at: string; }
export interface DBSDChecklistTemplateItem { id: string; work_type: string; label: string; sort_order: number; }
export interface DBSDTimeEntry { id: string; task_id: string; member_id: string; date: string; hours: number; comment?: string | null; capacity_assignment_id?: string | null; created_at: string; }
export interface DBSDDateHistoryEntry { id: string; task_id: string; previous_date: string | null; new_date: string; member_id?: string | null; reason: string; changed_at: string; }
export interface DBSDDependency { id: string; task_id: string; depends_on_task_id: string; created_at: string; }
export interface DBSDBlock { id: string; task_id: string; description: string; created_by?: string | null; created_at: string; resolved_at?: string | null; resolved_by?: string | null; }
export interface DBSDComment { id: string; task_id: string; member_id?: string | null; body: string; created_at: string; }
export interface DBSDAttachment { id: string; task_id: string; file_name: string; file_url: string; uploaded_by?: string | null; uploaded_at: string; }
export interface DBSDExternalAccess { id: string; member_id: string; project_id: string; task_id: string | null; granted_by?: string | null; granted_at: string; }
export interface DBSDAuditEntry { id: string; task_id: string; member_id?: string | null; field_name: string; old_value: string | null; new_value: string | null; changed_at: string; }
export interface DBSDNotification { id: string; member_id: string; type: string; task_id: string | null; message: string; is_read: boolean; created_at: string; }
