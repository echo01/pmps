import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ClipboardPlus, Eye, ListTree, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { planningApi, PlanningDashboard, PlanningPlan, PlanningTask, TaskPayload, TaskType } from '../../api/planning.api';
import { productionLotsApi } from '../../api/productionLots.api';
import { usersApi } from '../../api/users.api';
import { can } from '../../auth/permission';
import { useAuth } from '../../auth/useAuth';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingPanel } from '../../components/common/LoadingPanel';
import { MasterDataFormModal } from '../../components/master-data/MasterDataFormModal';

const today = new Date().toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function localPlanDatetime(date: string, time: string) {
  return `${date}T${time}`;
}

const initialPlanForm = {
  lot_id: '',
  plan_name: '',
  priority: 'NORMAL',
  planned_start_datetime: localPlanDatetime(today, '08:00'),
  planned_end_datetime: localPlanDatetime(today, '17:00'),
  owner_user_id: '',
  remark: '',
  create_default_tasks: true,
};

const initialTaskForm = {
  task_type: 'QC_INSPECTION' as TaskType,
  task_name: 'QC Inspection',
  assigned_user_id: '',
  planned_start_datetime: '',
  planned_end_datetime: '',
  task_status: 'PLANNED',
  source_type: 'QC',
  remark: '',
};

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  const kebabCase = normalized.replace(/_/g, '-');
  return normalized === kebabCase ? normalized : `${normalized} ${kebabCase}`;
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function datetimeText(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

type CalendarEvent = PlanningDashboard['calendar_events'][number];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function linkForTask(plan: PlanningPlan, task: PlanningTask) {
  if (task.source_type === 'QC' || task.task_type.startsWith('QC')) {
    return `/qc/inspection/lots/${plan.lot_id}`;
  }
  if (task.source_type === 'QA' || task.task_type.startsWith('QA')) {
    return `/qa/sampling/lots/${plan.lot_id}`;
  }
  if (task.source_type === 'REPORT' || task.task_type === 'REPORT_READY') {
    return `/reports/lots/${plan.lot_id}`;
  }
  return `/production-lots/${plan.lot_id}`;
}

function PlanningCalendar({
  events,
  onOpenEvent,
  onMoveEvent,
  onDatesChange,
  canManage,
}: {
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onMoveEvent: (event: CalendarEvent, start: Date, end: Date | null, revert: () => void) => void;
  onDatesChange: (dateFrom: string, dateTo: string) => void;
  canManage: boolean;
}) {
  const calendarEvents = useMemo(() => {
    return events
      .filter((event) => event.start)
      .map((event) => ({
        id: String(event.id),
        title: event.title,
        start: event.start || undefined,
        end: event.end || undefined,
        allDay: false,
        classNames: statusClass(event.derived_status).split(' ').map((item) => `planning-fc-${item}`),
        extendedProps: {
          planningEvent: event,
          status: event.derived_status,
        },
      }));
  }, [events]);

  return (
    <section className="planningCalendar">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'today prev,next',
          center: 'title',
          right: 'timeGridDay,timeGridWeek,dayGridMonth',
        }}
        buttonText={{
          today: 'Today',
          day: 'Day',
          week: 'Week',
          month: 'Month',
        }}
        events={calendarEvents}
        editable={canManage}
        eventStartEditable={canManage}
        eventDurationEditable={canManage}
        droppable={false}
        eventDisplay="block"
        dayMaxEvents={4}
        height="auto"
        nowIndicator
        allDaySlot={false}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        datesSet={(info) => {
          const visibleEnd = addDays(info.end, -1);
          onDatesChange(localDateKey(info.start), localDateKey(visibleEnd));
        }}
        eventClick={(info) => {
          const event = info.event.extendedProps.planningEvent as CalendarEvent | undefined;
          if (event) onOpenEvent(event);
        }}
        eventDrop={(info) => {
          const event = info.event.extendedProps.planningEvent as CalendarEvent | undefined;
          if (!event || !info.event.start) {
            info.revert();
            return;
          }
          onMoveEvent(event, info.event.start, info.event.end, info.revert);
        }}
        eventResize={(info) => {
          const event = info.event.extendedProps.planningEvent as CalendarEvent | undefined;
          if (!event || !info.event.start) {
            info.revert();
            return;
          }
          onMoveEvent(event, info.event.start, info.event.end, info.revert);
        }}
        eventContent={(arg) => {
          const event = arg.event.extendedProps.planningEvent as CalendarEvent | undefined;
          const start = arg.event.start;
          return (
            <div className="planningFcEvent">
              <span>{arg.event.title}</span>
              <small>{start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} - {event?.derived_status || arg.event.extendedProps.status}</small>
            </div>
          );
        }}
      />
    </section>
  );
}

export function PlanningDashboardPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = can('PlanningManage', user?.permissions || []) || (user?.roles || []).includes('ADMIN');
  const [view, setView] = useState<'waterfall' | 'calendar'>('waterfall');
  const [filters, setFilters] = useState({
    search: '',
    model_code: '',
    lot_number: '',
    status: '',
    date_from: today,
    date_to: nextWeek,
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanningPlan | null>(null);
  const [selectedTask, setSelectedTask] = useState<PlanningTask | null>(null);
  const [planForm, setPlanForm] = useState(initialPlanForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [localError, setLocalError] = useState<string | null>(null);

  const dashboard = useQuery({
    queryKey: ['planning-dashboard', appliedFilters],
    queryFn: () => planningApi.getDashboard({
      ...appliedFilters,
      search: appliedFilters.search || undefined,
      model_code: appliedFilters.model_code || undefined,
      lot_number: appliedFilters.lot_number || undefined,
      status: appliedFilters.status || undefined,
      date_from: appliedFilters.date_from || undefined,
      date_to: appliedFilters.date_to || undefined,
    }),
  });

  const lots = useQuery({
    queryKey: ['planning-lots', appliedFilters],
    queryFn: () => productionLotsApi.getProductionLots({
      page: 1,
      page_size: 100,
      search: appliedFilters.search || undefined,
      model_code: appliedFilters.model_code || undefined,
      lot_number: appliedFilters.lot_number || undefined,
      status: undefined,
      date_from: appliedFilters.date_from || undefined,
      date_to: appliedFilters.date_to || undefined,
    }),
  });

  const users = useQuery({
    queryKey: ['planning-users'],
    queryFn: () => usersApi.getUsers({ active: true }),
  });

  const createPlanMutation = useMutation({
    mutationFn: () => planningApi.createPlan({
      lot_id: Number(planForm.lot_id),
      plan_name: planForm.plan_name.trim(),
      priority: planForm.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
      planned_start_date: planForm.planned_start_datetime.slice(0, 10),
      planned_end_date: planForm.planned_end_datetime.slice(0, 10),
      planned_start_datetime: fromDatetimeLocal(planForm.planned_start_datetime) || undefined,
      planned_end_datetime: fromDatetimeLocal(planForm.planned_end_datetime) || undefined,
      owner_user_id: planForm.owner_user_id ? Number(planForm.owner_user_id) : null,
      remark: planForm.remark.trim() || null,
      create_default_tasks: planForm.create_default_tasks,
    }),
    onSuccess: () => {
      setPlanModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['planning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['planning-lots'] });
    },
  });

  const saveTaskMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlan) throw new Error('Select a plan first');
      const payload: TaskPayload = {
        task_type: taskForm.task_type as TaskType,
        task_name: taskForm.task_name.trim(),
        assigned_user_id: taskForm.assigned_user_id ? Number(taskForm.assigned_user_id) : null,
        planned_start_datetime: fromDatetimeLocal(taskForm.planned_start_datetime),
        planned_end_datetime: fromDatetimeLocal(taskForm.planned_end_datetime),
        task_status: taskForm.task_status as TaskPayload['task_status'],
        source_type: taskForm.source_type as TaskPayload['source_type'],
        source_id: selectedPlan.lot_id,
        remark: taskForm.remark.trim() || null,
      };

      return selectedTask
        ? planningApi.updateTask(selectedTask.id, payload)
        : planningApi.createTask(selectedPlan.id, payload);
    },
    onSuccess: () => {
      setTaskModalOpen(false);
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['planning-dashboard'] });
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      plannedStart,
      plannedEnd,
    }: {
      taskId: number;
      plannedStart: string;
      plannedEnd: string;
    }) => planningApi.updateTask(taskId, {
      planned_start_datetime: plannedStart,
      planned_end_datetime: plannedEnd,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-dashboard'] });
    },
  });

  const unplannedLots = useMemo(() => {
    const plannedLotIds = new Set((dashboard.data?.plans || []).map((plan) => plan.lot_id));
    return (lots.data?.rows || []).filter((lot) => !plannedLotIds.has(lot.id));
  }, [dashboard.data?.plans, lots.data?.rows]);

  function openCreatePlan() {
    setPlanForm(initialPlanForm);
    setLocalError(null);
    setPlanModalOpen(true);
  }

  function openCreatePlanForLot(lot: { id: number; lot_number: string; production_date?: string | null }) {
    const startDate = lot.production_date || today;
    setPlanForm({
      ...initialPlanForm,
      lot_id: String(lot.id),
      plan_name: `${lot.lot_number} Test Plan`,
      planned_start_datetime: localPlanDatetime(startDate, '08:00'),
      planned_end_datetime: localPlanDatetime(startDate, '17:00'),
    });
    setLocalError(null);
    setPlanModalOpen(true);
  }

  function submitPlan() {
    if (!planForm.lot_id) return setLocalError('Lot is required');
    if (!planForm.plan_name.trim()) return setLocalError('Plan name is required');
    if (!planForm.planned_start_datetime || !planForm.planned_end_datetime) return setLocalError('Planned start and end are required');
    if (planForm.planned_end_datetime <= planForm.planned_start_datetime) return setLocalError('Planned end must be after start');
    setLocalError(null);
    createPlanMutation.mutate();
  }

  function openTask(plan: PlanningPlan, task?: PlanningTask) {
    setSelectedPlan(plan);
    setSelectedTask(task || null);
    if (task) {
      setTaskForm({
        task_type: task.task_type,
        task_name: task.task_name,
        assigned_user_id: task.assigned_user_id ? String(task.assigned_user_id) : '',
        planned_start_datetime: toDatetimeLocal(task.planned_start_datetime),
        planned_end_datetime: toDatetimeLocal(task.planned_end_datetime),
        task_status: task.task_status,
        source_type: task.source_type || 'LOT',
        remark: task.remark || '',
      });
    } else {
      setTaskForm(initialTaskForm);
    }
    setTaskModalOpen(true);
  }

  function submitTask() {
    if (!taskForm.task_name.trim()) return setLocalError('Task name is required');
    if (taskForm.planned_start_datetime && taskForm.planned_end_datetime && taskForm.planned_end_datetime < taskForm.planned_start_datetime) {
      return setLocalError('Task planned end must be after start');
    }
    setLocalError(null);
    saveTaskMutation.mutate();
  }

  function moveCalendarEvent(event: CalendarEvent, start: Date, end: Date | null, revert: () => void) {
    if (!canManage) {
      revert();
      return;
    }

    const previousStart = event.start ? new Date(event.start) : start;
    const previousEnd = event.end ? new Date(event.end) : new Date(previousStart.getTime() + 60 * 60 * 1000);
    const durationMs = Math.max(previousEnd.getTime() - previousStart.getTime(), 30 * 60 * 1000);
    const nextEnd = end || new Date(start.getTime() + durationMs);

    if (nextEnd.getTime() <= start.getTime()) {
      revert();
      setLocalError('Task planned end must be after start');
      return;
    }

    moveTaskMutation.mutate(
      {
        taskId: event.id,
        plannedStart: start.toISOString(),
        plannedEnd: nextEnd.toISOString(),
      },
      {
        onError: () => {
          revert();
        },
      }
    );
  }

  function syncCalendarRange(dateFrom: string, dateTo: string) {
    setFilters((current) => (
      current.date_from === dateFrom && current.date_to === dateTo
        ? current
        : { ...current, date_from: dateFrom, date_to: dateTo }
    ));
    setAppliedFilters((current) => (
      current.date_from === dateFrom && current.date_to === dateTo
        ? current
        : { ...current, date_from: dateFrom, date_to: dateTo }
    ));
  }

  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>Lot Test Planning</h1>
        </div>
        {canManage ? <button className="primaryButton" type="button" onClick={openCreatePlan}><Plus size={16} /> Create Plan</button> : null}
      </div>

      <form className="filters planningFilters" onSubmit={(event) => { event.preventDefault(); setAppliedFilters(filters); }}>
        <label>Search<input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Lot, plan, model" /></label>
        <label>Model<input value={filters.model_code} onChange={(event) => setFilters({ ...filters, model_code: event.target.value })} placeholder="All" /></label>
        <label>Lot<input value={filters.lot_number} onChange={(event) => setFilters({ ...filters, lot_number: event.target.value })} placeholder="All" /></label>
        <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option value="PLANNED">Planned</option><option value="IN_PROGRESS">In Progress</option><option value="WAITING_REVIEW">Waiting Review</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label>
        <label>From<input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} /></label>
        <label>To<input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} /></label>
        <label>View<select value={view} onChange={(event) => setView(event.target.value as 'waterfall' | 'calendar')}><option value="waterfall">Waterfall</option><option value="calendar">Calendar</option></select></label>
        <button className="primaryButton" type="submit">Search</button>
      </form>

      {dashboard.error ? <ErrorAlert error={dashboard.error} /> : null}
      {moveTaskMutation.error ? <ErrorAlert error={moveTaskMutation.error} /> : null}
      {dashboard.isLoading ? <LoadingPanel /> : null}

      {dashboard.data ? (
        <>
          <section className="summaryGrid planningSummary">
            <article className="metricCard"><span>Total Plans</span><strong>{dashboard.data.summary.total_plans}</strong></article>
            <article className="metricCard"><span>In Progress</span><strong>{dashboard.data.summary.in_progress}</strong></article>
            <article className="metricCard"><span>Delayed</span><strong>{dashboard.data.summary.delayed}</strong></article>
            <article className="metricCard"><span>Completed</span><strong>{dashboard.data.summary.completed}</strong></article>
            <article className="metricCard"><span>Waiting Review</span><strong>{dashboard.data.summary.waiting_review}</strong></article>
          </section>

          <div className="tabs">
            <button type="button" className={view === 'waterfall' ? 'active' : ''} onClick={() => setView('waterfall')}><ListTree size={16} /> Waterfall</button>
            <button type="button" className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} /> Calendar</button>
          </div>

          {unplannedLots.length ? (
            <section className="panel">
              <div className="sectionHeader">
                <div>
                  <h2>Lots waiting for plan</h2>
                  <p className="mutedText">Production lots in this date range that do not have a test plan yet.</p>
                </div>
              </div>
              <div className="tableScroll">
                <table>
                  <thead>
                    <tr><th>Lot</th><th>Model</th><th>Qty</th><th>Serials</th><th>Status</th><th>Production Date</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {unplannedLots.map((lot) => (
                      <tr key={lot.id}>
                        <td>{lot.lot_number}</td>
                        <td>{lot.model_code}</td>
                        <td>{lot.lot_qty}</td>
                        <td>{lot.serial_count}</td>
                        <td><span className={`badge ${lot.status.toLowerCase()}`}>{lot.status}</span></td>
                        <td>{dateText(lot.production_date)}</td>
                        <td>
                          <div className="rowActions planningRowActions">
                            {canManage ? <button className="primaryButton" type="button" onClick={() => openCreatePlanForLot(lot)}><Plus size={16} /> Plan</button> : null}
                            <Link className="textButton" to={`/production-lots/${lot.id}`}>Detail</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {dashboard.data.plans.length === 0 && unplannedLots.length === 0 ? <EmptyState /> : null}

          {view === 'waterfall' ? (
            <section className="planningBoard">
              {dashboard.data.plans.map((plan) => (
                <article className="planningCard" key={plan.id}>
                  <div className="planningCardHeader">
                    <div>
                      <strong>{plan.lot_number}</strong>
                      <span>{plan.model_code} | {plan.plan_code} | Owner: {plan.owner_full_name || plan.owner_username || '-'}</span>
                    </div>
                    <div className="chipList">
                      <span className={`badge ${plan.priority.toLowerCase()}`}>{plan.priority}</span>
                      <span className={`badge ${statusClass(plan.derived_status)}`}>{plan.derived_status}</span>
                    </div>
                  </div>
                  <div className="planningProgress">
                    <span>QC {plan.progress.qc_started}/{plan.progress.serial_total}</span>
                    <div><i style={{ width: `${plan.progress.qc_percent}%` }} /></div>
                    <span>QA {plan.progress.qa_started}/{plan.progress.serial_total}</span>
                    <div><i style={{ width: `${plan.progress.qa_percent}%` }} /></div>
                  </div>
                  <div className="waterfallSteps">
                    {plan.tasks.map((task) => (
                      <button
                        className={`waterfallStep ${statusClass(task.derived_status)}`}
                        type="button"
                        key={task.id}
                        title={task.status_source === 'WORKFLOW' ? `Synced from ${task.task_type.startsWith('QC') ? 'QC Inspection' : 'QA Sampling'}` : 'Planning task status'}
                        onClick={() => openTask(plan, task)}
                      >
                        <strong>{task.task_name}</strong>
                        <span>{task.derived_status}</span>
                        <small>{datetimeText(task.planned_start_datetime)}</small>
                      </button>
                    ))}
                  </div>
                  <div className="formActions">
                    <Link className="textButton" to={`/production-lots/${plan.lot_id}`}><Eye size={16} /> Open Lot</Link>
                    {canManage ? <button className="textButton" type="button" onClick={() => openTask(plan)}><ClipboardPlus size={16} /> Add Task</button> : null}
                    <Link className="textButton" to={`/qc/inspection/lots/${plan.lot_id}`}>Open QC</Link>
                    <Link className="textButton" to={`/qa/sampling/lots/${plan.lot_id}`}>Open QA</Link>
                    <Link className="textButton" to={`/reports/lots/${plan.lot_id}`}>Open Report</Link>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <PlanningCalendar
              events={dashboard.data.calendar_events}
              canManage={canManage}
              onOpenEvent={(event) => {
                const plan = dashboard.data.plans.find((item) => item.id === event.plan_id);
                const task = plan?.tasks.find((item) => item.id === event.id);
                if (plan && task) openTask(plan, task);
              }}
              onMoveEvent={moveCalendarEvent}
              onDatesChange={syncCalendarRange}
            />
          )}
        </>
      ) : null}

      <MasterDataFormModal open={planModalOpen} title="Create Lot Test Plan" submitLabel="Create Plan" saving={createPlanMutation.isPending} error={createPlanMutation.error || (localError ? new Error(localError) : null)} onClose={() => setPlanModalOpen(false)} onSubmit={submitPlan}>
        <div className="formGrid modalGrid">
          <label className="span2">Lot<select value={planForm.lot_id} onChange={(event) => setPlanForm({ ...planForm, lot_id: event.target.value })}><option value="">Select Lot</option>{lots.data?.rows.map((lot) => <option value={lot.id} key={lot.id}>{lot.lot_number} | {lot.model_code}</option>)}</select></label>
          <label className="span2">Plan Name<input value={planForm.plan_name} onChange={(event) => setPlanForm({ ...planForm, plan_name: event.target.value })} /></label>
          <label>Priority<select value={planForm.priority} onChange={(event) => setPlanForm({ ...planForm, priority: event.target.value })}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
          <label>Owner<select value={planForm.owner_user_id} onChange={(event) => setPlanForm({ ...planForm, owner_user_id: event.target.value })}><option value="">Unassigned</option>{users.data?.map((row) => <option value={row.id} key={row.id}>{row.full_name || row.username}</option>)}</select></label>
          <label>Start<input type="datetime-local" value={planForm.planned_start_datetime} onChange={(event) => setPlanForm({ ...planForm, planned_start_datetime: event.target.value })} /></label>
          <label>End<input type="datetime-local" value={planForm.planned_end_datetime} onChange={(event) => setPlanForm({ ...planForm, planned_end_datetime: event.target.value })} /></label>
          <label className="span2">Remark<input value={planForm.remark} onChange={(event) => setPlanForm({ ...planForm, remark: event.target.value })} /></label>
          <label className="checkRow"><input type="checkbox" checked={planForm.create_default_tasks} onChange={(event) => setPlanForm({ ...planForm, create_default_tasks: event.target.checked })} /> Create default tasks</label>
        </div>
      </MasterDataFormModal>

      <MasterDataFormModal open={taskModalOpen} title={selectedTask ? 'Edit Plan Task' : 'Add Plan Task'} submitLabel="Save Task" saving={saveTaskMutation.isPending} error={saveTaskMutation.error || (localError ? new Error(localError) : null)} onClose={() => setTaskModalOpen(false)} onSubmit={submitTask}>
        <div className="formGrid modalGrid">
          <label>Task Type<select value={taskForm.task_type} onChange={(event) => setTaskForm({ ...taskForm, task_type: event.target.value as TaskType })}><option value="QC_INSPECTION">QC Inspection</option><option value="QC_REVIEW">QC Review</option><option value="QC_APPROVE">QC Approve</option><option value="QA_SAMPLING">QA Sampling</option><option value="QA_REVIEW">QA Review</option><option value="QA_APPROVE">QA Approve</option><option value="REPORT_READY">Report Ready</option><option value="CUSTOM">Custom</option></select></label>
          <label>Task Name<input value={taskForm.task_name} onChange={(event) => setTaskForm({ ...taskForm, task_name: event.target.value })} /></label>
          <label>Assigned User<select value={taskForm.assigned_user_id} onChange={(event) => setTaskForm({ ...taskForm, assigned_user_id: event.target.value })}><option value="">Unassigned</option>{users.data?.map((row) => <option value={row.id} key={row.id}>{row.full_name || row.username}</option>)}</select></label>
          <label>
            Status
            {selectedTask?.status_source === 'WORKFLOW' ? (
              <span className="workflowStatusField">
                <span className={`badge ${statusClass(selectedTask.derived_status)}`}>{selectedTask.derived_status}</span>
                <small>Synced from {selectedTask.task_type.startsWith('QC') ? 'QC Inspection' : 'QA Sampling'}</small>
              </span>
            ) : (
              <select value={taskForm.task_status} onChange={(event) => setTaskForm({ ...taskForm, task_status: event.target.value })}>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_REVIEW">Waiting Review</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}
          </label>
          <label>Start<input type="datetime-local" value={taskForm.planned_start_datetime} onChange={(event) => setTaskForm({ ...taskForm, planned_start_datetime: event.target.value })} /></label>
          <label>End<input type="datetime-local" value={taskForm.planned_end_datetime} onChange={(event) => setTaskForm({ ...taskForm, planned_end_datetime: event.target.value })} /></label>
          <label>Link To<select value={taskForm.source_type} onChange={(event) => setTaskForm({ ...taskForm, source_type: event.target.value })}><option value="QC">QC Lot Page</option><option value="QA">QA Sampling Page</option><option value="REPORT">Report Detail</option><option value="LOT">Production Lot</option></select></label>
          <label>Open Link{selectedPlan && selectedTask ? <Link className="textButton" to={linkForTask(selectedPlan, selectedTask)}>Open Task Target</Link> : <span className="transactionHint">Save task first to open target.</span>}</label>
          <label className="span2">Remark<input value={taskForm.remark} onChange={(event) => setTaskForm({ ...taskForm, remark: event.target.value })} /></label>
        </div>
      </MasterDataFormModal>
    </div>
  );
}
