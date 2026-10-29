import React from 'react';
import { StoreConfig, BusinessHours, DaySchedule, TimePeriod } from '../../../types';
import { evaluateSchedule } from '../../../utils/hours';
import { Clock, Plus, Trash2 } from 'lucide-react';

interface HoursTabProps {
  config: StoreConfig;
  onUpdateHours: (hours: BusinessHours) => void;
  onSaveNotice: (msg: string) => void;
}

export const HoursTab: React.FC<HoursTabProps> = ({
  config,
  onUpdateHours,
  onSaveNotice,
}) => {
  const { hours } = config;
  const liveStatus = evaluateSchedule(hours);

  const handleToggleDay = (dayIndex: number) => {
    const nextSchedule = [...hours.schedule];
    const day = nextSchedule[dayIndex];
    day.isOpen = !day.isOpen;

    // If opening and has no periods, add standard period
    if (day.isOpen && day.periods.length === 0) {
      day.periods.push({
        id: `p_${Date.now()}`,
        open: '11:00',
        close: '23:00',
      });
    }

    onUpdateHours({ ...hours, schedule: nextSchedule });
    onSaveNotice(`Horário de ${day.label} atualizado.`);
  };

  const handleAddPeriod = (dayIndex: number) => {
    const nextSchedule = [...hours.schedule];
    const day = nextSchedule[dayIndex];
    day.periods.push({
      id: `p_${Date.now()}_${Math.random()}`,
      open: '18:00',
      close: '23:00',
    });
    onUpdateHours({ ...hours, schedule: nextSchedule });
  };

  const handleRemovePeriod = (dayIndex: number, periodId: string) => {
    const nextSchedule = [...hours.schedule];
    const day = nextSchedule[dayIndex];
    day.periods = day.periods.filter(p => p.id !== periodId);
    if (day.periods.length === 0) {
      day.isOpen = false;
    }
    onUpdateHours({ ...hours, schedule: nextSchedule });
  };

  const handleUpdatePeriodTime = (
    dayIndex: number,
    periodId: string,
    field: 'open' | 'close',
    value: string
  ) => {
    const nextSchedule = [...hours.schedule];
    const day = nextSchedule[dayIndex];
    const period = day.periods.find(p => p.id === periodId);
    if (period) {
      period[field] = value;
      onUpdateHours({ ...hours, schedule: nextSchedule });
    }
  };

  return (
    <div className="space-y-6 text-zinc-200">
      {/* Live Status Banner */}
      <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              liveStatus.isOpen
                ? 'bg-emerald-400 shadow-md shadow-emerald-500 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                Status do Horário:{' '}
                <span
                  className={
                    liveStatus.isOpen ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {liveStatus.statusLabel}
                </span>
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{liveStatus.detailLabel}</p>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 text-right">
          O status final da loja também depende de aceitar pedidos e estar publicada
        </p>
      </div>

      {/* Weekly Schedule */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Grade Semanal de Atendimento
          </h3>
          <span className="text-[11px] text-zinc-500">
            Suporta múltiplos turnos (ex: almoço e jantar)
          </span>
        </div>

        <div className="divide-y divide-zinc-850 rounded-2xl bg-[#13161D] border border-zinc-800 overflow-hidden">
          {hours.schedule.map((day, dayIndex) => (
            <div key={day.day} className="p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleDay(dayIndex)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      day.isOpen ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        day.isOpen ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      day.isOpen ? 'text-white' : 'text-zinc-500'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {!day.isOpen && (
                    <span className="text-xs text-rose-400/90 font-medium">
                      Fechado o dia todo
                    </span>
                  )}
                  {day.isOpen && (
                    <button
                      type="button"
                      onClick={() => handleAddPeriod(dayIndex)}
                      className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1"
                      title="Adicionar segundo período (ex: jantar)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Turno</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Time Periods */}
              {day.isOpen && (
                <div className="pl-14 space-y-2">
                  {day.periods.map((period, pIndex) => (
                    <div
                      key={period.id}
                      className="flex items-center gap-2 text-xs flex-wrap"
                    >
                      <span className="text-zinc-500 font-mono text-[11px] w-12">
                        Turno {pIndex + 1}:
                      </span>

                      <div className="flex items-center gap-1.5 bg-[#0A0C0F] border border-zinc-800 rounded-xl px-2.5 py-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <input
                          type="time"
                          value={period.open}
                          onChange={e =>
                            handleUpdatePeriodTime(
                              dayIndex,
                              period.id,
                              'open',
                              e.target.value
                            )
                          }
                          className="bg-transparent text-white font-mono text-xs focus:outline-none"
                        />
                        <span className="text-zinc-500">às</span>
                        <input
                          type="time"
                          value={period.close}
                          onChange={e =>
                            handleUpdatePeriodTime(
                              dayIndex,
                              period.id,
                              'close',
                              e.target.value
                            )
                          }
                          className="bg-transparent text-white font-mono text-xs focus:outline-none"
                        />
                      </div>

                      {day.periods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePeriod(dayIndex, period.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                          title="Remover este turno"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
