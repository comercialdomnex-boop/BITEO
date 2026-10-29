import { BusinessHours, DayOfWeek, DaySchedule, TimePeriod } from '../types/store';

const MINUTES_IN_DAY = 24 * 60;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/** JS Date#getDay() index -> DayOfWeek key */
const DAY_BY_INDEX: DayOfWeek[] = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
];

export function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = (value ?? '').split(':').map(part => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * Resolves a period into an absolute minute window starting at its own day.
 * When `close` is not after `open` the period crosses midnight and the closing
 * bound is pushed to the next day (e.g. "18:00" -> "02:00" becomes 1560).
 */
function resolvePeriodWindow(period: TimePeriod): { start: number; end: number } {
  const start = parseTimeToMinutes(period.open);
  const rawEnd = parseTimeToMinutes(period.close);
  const end = rawEnd <= start ? rawEnd + MINUTES_IN_DAY : rawEnd;
  return { start, end };
}

export interface ScheduleEvaluation {
  isOpen: boolean;
  statusLabel: string;
  detailLabel: string;
  closesAt?: string;
  nextOpenDay?: DayOfWeek;
  nextOpenTime?: string;
}

function findSchedule(
  hours: BusinessHours,
  day: DayOfWeek
): DaySchedule | undefined {
  return hours.schedule.find(schedule => schedule.day === day);
}

/**
 * Evaluates the business hours for a given instant, correctly handling periods
 * that cross midnight (a Monday "18:00" -> "02:00" period keeps Tuesday 01:00
 * open).
 */
export function evaluateSchedule(
  hours: BusinessHours,
  date: Date = new Date()
): ScheduleEvaluation {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const today = DAY_BY_INDEX[date.getDay()];
  const yesterday = DAY_BY_INDEX[(date.getDay() + 6) % 7];

  // A period opened yesterday may still be running on today's early hours.
  const yesterdaySchedule = findSchedule(hours, yesterday);
  if (yesterdaySchedule?.isOpen) {
    for (const period of yesterdaySchedule.periods) {
      const { end } = resolvePeriodWindow(period);
      if (end > MINUTES_IN_DAY && currentMinutes < end - MINUTES_IN_DAY) {
        return {
          isOpen: true,
          statusLabel: 'ABERTO AGORA',
          detailLabel: `Fecha às ${period.close}`,
          closesAt: period.close,
        };
      }
    }
  }

  const todaySchedule = findSchedule(hours, today);

  if (todaySchedule?.isOpen) {
    for (const period of todaySchedule.periods) {
      const { start, end } = resolvePeriodWindow(period);
      if (currentMinutes >= start && currentMinutes < end) {
        return {
          isOpen: true,
          statusLabel: 'ABERTO AGORA',
          detailLabel: `Fecha às ${period.close}`,
          closesAt: period.close,
        };
      }
    }
  }

  const nextOpening = findNextOpening(hours, date);
  if (nextOpening) {
    const { day, time } = nextOpening;
    const detailLabel =
      day === today
        ? `Abre hoje às ${time}`
        : `Abre ${DAY_LABELS[day].toLowerCase()} às ${time}`;
    return {
      isOpen: false,
      statusLabel: 'FECHADO',
      detailLabel,
      nextOpenDay: day,
      nextOpenTime: time,
    };
  }

  return {
    isOpen: false,
    statusLabel: 'FECHADO',
    detailLabel: 'Fechado no momento',
  };
}

function findNextOpening(
  hours: BusinessHours,
  from: Date
): { day: DayOfWeek; time: string } | null {
  const fromMinutes = from.getHours() * 60 + from.getMinutes();

  for (let offset = 0; offset < 8; offset += 1) {
    const day = DAY_BY_INDEX[(from.getDay() + offset) % 7];
    const schedule = findSchedule(hours, day);
    if (!schedule?.isOpen) continue;

    for (const period of schedule.periods) {
      const { start } = resolvePeriodWindow(period);
      if (offset === 0 && start <= fromMinutes) continue;
      return { day, time: period.open };
    }
  }

  return null;
}

/**
 * Canonical availability signal for a store: the schedule alone is never
 * enough. The operational switch and the publication flag must also be on.
 */
export function isStoreEffectivelyOpen(
  hours: BusinessHours,
  options: {
    acceptingOrders: boolean;
    isPublished: boolean;
    date?: Date;
  }
): boolean {
  if (!options.acceptingOrders || !options.isPublished) return false;
  return evaluateSchedule(hours, options.date).isOpen;
}