import React, { createContext, useContext, useEffect, useState } from 'react';
import { Project, Risk, Change, CapacityData, TeamMember, Expense, ViewName, LessonLearned, Milestone, DocumentationSection, DocumentationLink, DBProject, DBMilestone, DBOC, DBRisk, DBChange, DBLesson, DBExpense, DBTeamMember, DBCapacityAssignment, DBDocSection, DBDocLink } from './types';
import { generateUUID } from './utils/helpers';
import { supabase } from './utils/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AppContextType {
  user: User | null;
  session: Session | null;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  risks: Risk[];
  setRisks: React.Dispatch<React.SetStateAction<Risk[]>>;
  changes: Change[];
  setChanges: React.Dispatch<React.SetStateAction<Change[]>>;
  lessons: LessonLearned[];
  setLessons: React.Dispatch<React.SetStateAction<LessonLearned[]>>;
  milestones: Milestone[];
  setMilestones: React.Dispatch<React.SetStateAction<Milestone[]>>;
  capacityData: CapacityData;
  setCapacityData: React.Dispatch<React.SetStateAction<CapacityData>>;
  team: TeamMember[];
  setTeam: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  docSections: DocumentationSection[];
  setDocSections: React.Dispatch<React.SetStateAction<DocumentationSection[]>>;
  docLinks: DocumentationLink[];
  setDocLinks: React.Dispatch<React.SetStateAction<DocumentationLink[]>>;
  currentView: ViewName;
  setCurrentView: (view: ViewName) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  signOut: () => Promise<void>;
  executiveFilters: { status: string | null; vendor: string | null; vertical: string | null; segment: string | null };
  setExecutiveFilters: React.Dispatch<React.SetStateAction<{ status: string | null; vendor: string | null; vertical: string | null; segment: string | null }>>;
  currentUserMember: TeamMember | null;
  refreshData: () => Promise<void>;
  fetchCapacityOnly: (startDate: string, endDate: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Data states - intially empty, loaded from DB
  const [projects, setProjects] = useState<Project[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [capacityData, setCapacityData] = useState<CapacityData>({ assignments: [] });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [docSections, setDocSections] = useState<DocumentationSection[]>([]);
  const [docLinks, setDocLinks] = useState<DocumentationLink[]>([]);

  const [currentView, setCurrentView] = useState<ViewName>('dashboard-pmo');
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
  const [toasts, setToasts] = useState<Array<{ id: number, msg: string, type: 'info' | 'success' | 'error' }>>([]);
  const [executiveFilters, setExecutiveFilters] = useState({
    status: null as string | null,
    vendor: null as string | null,
    vertical: null as string | null,
    segment: null as string | null
  });

  const currentUserMember = React.useMemo(() => {
    if (!user || team.length === 0) return null;
    // Match by email provided in Auth vs Team table
    return team.find(t => t.email?.toLowerCase() === user.email?.toLowerCase()) || null;
  }, [user, team]);

  // Auth & Data Loading
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    }).catch((err) => {
      console.error('Session check failed:', err);
    }).finally(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setProjects([]);
        setRisks([]);
        setChanges([]);
        setLessons([]);
        setMilestones([]);
        setExpenses([]);
        // keep team defaults or clear
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data when User is present
    const refreshData = async () => {
      if (!user) return;
      try {
        // Projects
        const { data: projectsData, error: pError } = await supabase.from('projects').select('*');
        if (projectsData) {
          const { data: milestones } = await supabase.from('milestones').select('*');
          const { data: ocs } = await supabase.from('ocs').select('*');

          const mappedProjects: Project[] = projectsData.map((p: DBProject) => ({
            id: p.id,
            name: p.name,
            clientName: p.client_name,
            pm: p.pm,
            opportunityNumber: p.opportunity_number,
            status: p.status,
            startDate: p.start_date,
            theoreticalEndDate: p.theoretical_end_date,
            realEndDate: p.real_end_date,
            progress: p.progress,
            budget: p.budget || {},
            hwValue: p.hw_value,
            servicesValue: p.services_value,
            hwCost: p.hw_cost,
            servicesCost: p.services_cost,
            cm: p.cm,
            valuesComments: p.values_comments,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            documentationLink: p.documentation_link,
            healthStatus: p.health_status || 'Auto',
            dateChangeHistory: p.date_change_history || [],
            statusHistory: p.status_history || [],
            vendors: p.vendors || [],
            thirdPartyServices: p.third_party_services,
            thirdPartyProvider: p.third_party_provider,
            vertical: p.vertical,
            segment: p.segment,
            priority: p.priority,
            initialRealValues: p.initial_real_values || {},
            aiSummary: p.ai_summary,
            milestones: milestones?.filter((m: DBMilestone) => m.project_id === p.id).map((m: DBMilestone) => ({
              id: m.id,
              projectId: m.project_id,
              description: m.description,
              amount: m.amount,
              date: m.date,
              realDate: m.real_date || undefined,
              dateChangeHistory: m.date_change_history || [],
              receivedAmount: m.received_amount,
              isReceived: m.is_received,
              currency: m.currency,
              ocId: m.oc_id,
              ocPosition: m.oc_position,
              receivedPercentage: m.received_percentage,
              parentId: m.parent_id,
              createdAt: m.created_at
            })) || [],
            ocs: ocs?.filter((oc: DBOC) => oc.project_id === p.id).map((o: DBOC) => ({
              id: o.id,
              description: o.description,
              amount: o.amount
            })) || []
          }));
          setProjects(mappedProjects);

          // Update global milestones state too
          if (milestones) {
            setMilestones(milestones.map((m: DBMilestone) => ({
              id: m.id,
              projectId: m.project_id,
              description: m.description,
              amount: m.amount,
              date: m.date,
              realDate: m.real_date || undefined,
              dateChangeHistory: m.date_change_history || [],
              receivedAmount: m.received_amount,
              isReceived: m.is_received,
              currency: m.currency,
              ocId: m.oc_id,
              ocPosition: m.oc_position,
              receivedPercentage: m.received_percentage,
              parentId: m.parent_id,
              createdAt: m.created_at
            })));
          }
        }

        // Risks
        const { data: risksData } = await supabase.from('risks').select('*');
        if (risksData) {
          setRisks(risksData.map((r: DBRisk) => ({
            id: r.id,
            projectId: r.project_id,
            description: r.description,
            probability: r.probability,
            impact: r.impact,
            isProblem: r.is_problem,
            isMitigated: r.is_mitigated || false,
            plan: r.plan,
            date: r.date,
            createdAt: r.created_at
          })));
        }

        // Changes
        const { data: changesData } = await supabase.from('changes').select('*');
        if (changesData) {
          setChanges(changesData.map((c: DBChange) => ({
            id: c.id,
            projectId: c.project_id,
            description: c.description,
            type: c.type,
            date: c.date,
            registrationNumber: c.registration_number,
            createdAt: c.created_at
          })));
        }

        // Lessons Learned
        const { data: lessonsData } = await supabase.from('lessons_learned').select('*');
        if (lessonsData) {
          setLessons(lessonsData.map((l: DBLesson) => ({
            id: l.id,
            projectId: l.project_id,
            description: l.description,
            category: l.category,
            impact: l.impact,
            createdAt: l.created_at
          })));
        }

        // Expenses
        const { data: expensesData } = await supabase.from('expenses').select('*');
        if (expensesData) {
          setExpenses(expensesData.map((e: DBExpense) => ({
            id: e.id,
            projectId: e.project_id,
            date: e.date,
            category: e.category,
            amount: e.amount,
            description: e.description,
            createdAt: e.created_at
          })));
        }

        // Team Members
        const { data: teamData } = await supabase.from('team_members').select('*');
        if (teamData) {
          // If Lucas Le Favi was previously renamed to include "368" in the database,
          // restore it to "Lucas Le Favi" to prevent split(' ')[0] issues in charts.
          const lucasWith368 = teamData.find((t: DBTeamMember) => 
            t.name.toLowerCase().includes('lucas le favi') && t.name.includes('368')
          );
          if (lucasWith368) {
            const restoredName = lucasWith368.name.replace(/^368\s*-\s*/i, '');
            supabase
              .from('team_members')
              .update({ name: restoredName })
              .eq('id', lucasWith368.id)
              .then(({ error }) => {
                if (error) {
                  console.error("Error restoring Lucas Le Favi name:", error);
                } else {
                  console.log("Restored Lucas Le Favi name successfully to:", restoredName);
                  refreshData();
                }
              });
          }

          setTeam(teamData.map((t: DBTeamMember) => ({
            id: t.id,
            name: t.name,
            role: t.role,
            email: t.email || '',
            capacity_id: t.capacity_id || undefined,
            is_active: t.is_active !== false
          })));
        } else {
          // Fallback if table empty (first run)
          setTeam([{ id: user.id, name: user.email || 'Usuario', role: 'PM', email: user.email || '' }]);
        }

        // Fetch last 3 months for Dashboard and initial view
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const startStr = threeMonthsAgo.toISOString().split('T')[0];
        
        const { data: capacityAssignments, error: cError } = await supabase
          .from('capacity_assignments')
          .select('*')
          .or(`date.gte.${startStr},week_start.gte.${startStr}`)
          .order('date', { ascending: false });

        if (capacityAssignments) {
          setCapacityData({
            assignments: capacityAssignments.map((a: DBCapacityAssignment) => {
                const rawObs = a.observations || '';
                const isExtra = rawObs.startsWith('[IS_EXTRA] ');
                return {
                    id: a.id,
                    memberId: a.member_id || a.user_email,
                    type: a.type,
                    projectId: a.project_id,
                    date: (a.date || a.week_start || '').split('T')[0],
                    hours: a.hours,
                    observations: isExtra ? rawObs.replace('[IS_EXTRA] ', '') : rawObs,
                    isExtra
                };
            })
          });
        }

        // Documentation Sections
        const { data: sectionsData } = await supabase.from('documentation_sections').select('*').order('order', { ascending: true });
        if (sectionsData) {
          setDocSections(sectionsData.map((s: DBDocSection) => ({
            id: s.id,
            title: s.title,
            parentId: s.parent_id,
            order: s.order
          })));
        }

        // Documentation Links
        const { data: linksData } = await supabase.from('documentation_links').select('*');
        if (linksData) {
          setDocLinks(linksData.map((l: DBDocLink) => ({
            id: l.id,
            sectionId: l.section_id,
            title: l.title,
            url: l.url,
            description: l.description,
            createdAt: l.created_at
          })));
        }

      } catch (e) {
        console.error('Error fetching data:', e);
        showToast('Error cargando datos', 'error');
      } finally {
        setLoading(false);
      }
    };

    const fetchCapacityOnly = async (startDate: string, endDate: string) => {
      if (!user) return;
      try {
        let query = supabase
          .from('capacity_assignments')
          .select('*')
          .order('date', { ascending: false })
          .gte('date', startDate)
          .lte('date', endDate);

        const { data, error } = await query;
        if (error) throw error;

        if (data) {
          setCapacityData({
            assignments: data.map((a: DBCapacityAssignment) => {
                const rawObs = a.observations || '';
                const isExtra = rawObs.startsWith('[IS_EXTRA] ');
                return {
                    id: a.id,
                    memberId: a.member_id || a.user_email,
                    type: a.type,
                    projectId: a.project_id,
                    date: (a.date || a.week_start || '').split('T')[0],
                    hours: a.hours,
                    observations: isExtra ? rawObs.replace('[IS_EXTRA] ', '') : rawObs,
                    isExtra
                };
            })
          });
        }
      } catch (e) {
        console.error('Error fetching capacity:', e);
      }
    };

    useEffect(() => {
        refreshData();
    }, [user]);


  // Theme
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AppContext.Provider value={{
      user, session,
      projects, setProjects, risks, setRisks, changes, setChanges, lessons, setLessons,
      milestones, setMilestones,
      capacityData, setCapacityData, team, setTeam, expenses, setExpenses,
      docSections, setDocSections, docLinks, setDocLinks,
      currentView, setCurrentView, showToast, darkMode, toggleDarkMode, signOut,
      executiveFilters, setExecutiveFilters, currentUserMember, refreshData,
      fetchCapacityOnly
    }}>
      {loading ? (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-dark-bg">
          <div className="text-xl font-semibold text-gray-600 dark:text-gray-300">
            <i className="fas fa-circle-notch fa-spin mr-3"></i>
            Cargando...
          </div>
        </div>
      ) : children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`min-w-[300px] p-4 rounded-lg text-white shadow-lg flex items-center transition-all transform translate-x-0 ${t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
            <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : t.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-3`}></i>
            <span className="font-medium">{t.msg}</span>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};