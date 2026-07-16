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

export type ViewName = 'dashboard-pmo' | 'dashboard-ejecutivo' | 'alta-proyecto' | 'gastos' | 'hitos' | 'capacity' | 'riesgos' | 'cambios' | 'lecciones' | 'documentation' | 'perfil' | 'team-management' | 'cierre-fiscal';

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
export interface DBTeamMember { id: string; name: string; role: string; email?: string; capacity_id?: string; }
export interface DBCapacityAssignment { id: string; member_id: string; user_email?: string; type: any; project_id: string | null; date?: string; week_start?: string; hours: number; observations?: string; }
export interface DBDocSection { id: string; title: string; parent_id: string | null; order: number; }
export interface DBDocLink { id: string; section_id: string; title: string; url: string; description?: string; created_at: string; }
