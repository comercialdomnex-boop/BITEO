import React from 'react';
import { StoreConfig, BusinessHours } from '../../../types';
import { evaluateSchedule } from '../../../utils/hours';
import { Clock } from 'lucide-react';

interface HoursTabProps {
  config: StoreConfig;
  onUpdateHours: (hours: BusinessHours) => void;
  onSaveNotice: (msg: string) => void;
}

export const HoursTab: React.FC<HoursTabProps> = ({
  config,
  onUpdateHours,
}) => {
  const { hours } = config;
  const liveStatus = evaluateSchedule(hours);

  const handleToggleDay = (dayIndex: number) => {
    const nextSchedule = hours.schedule.map((day, index) => index !== dayIndex ? day : {
      ...day,
      isOpen: !day.isOpen,
      periods: day.periods.length > 0 ? day.periods : [{
        id: `p_${Date.now()}`,
        open: '11:00',
        close: '23:00',
      }],
    });
    onUpdateHours({ ...hours, schedule: nextSchedule });
  };

  const handleUpdatePeriodTime = (
    dayIndex: number,
    field: 'open' | 'close',
    value: string
  ) => {
    if (!value) return;
    const nextSchedule = hours.schedule.map((day, index) => index !== dayIndex ? day : {
      ...day,
      // Legacy periods remain intact until the merchant explicitly edits this day.
      periods: [{ ...day.periods[0], [field]: value }],
    });
    onUpdateHours({ ...hours, schedule: nextSchedule });
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
            Um período de abertura e fechamento por dia
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

                </div>
              </div>

              {day.periods.length > 1 && (
                <p className="pl-14 text-xs text-amber-400">
                  Horários anteriores preservados: {day.periods.map(p => `${p.open} às ${p.close}`).join('; ')}.
                  {' '}Ao editar o horário deste dia, eles serão substituídos pelo período exibido abaixo.
                </p>
              )}

              {/* Time Periods */}
              {day.isOpen && (
                <div className="pl-14 space-y-2">
                  {day.periods.slice(0, 1).map(period => (
                    <div
                      key={period.id}
                      className="flex items-center gap-2 text-xs flex-wrap"
                    >
                      <span className="text-zinc-500 font-mono text-[11px] w-12">
                        Horário:
                      </span>

                      <div className="flex items-center gap-1.5 bg-[#0A0C0F] border border-zinc-800 rounded-xl px-2.5 py-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <input
                          type="time"
                          value={period.open}
                          onChange={e =>
                            handleUpdatePeriodTime(
                              dayIndex,
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
                              'close',
                              e.target.value
                            )
                          }
                          className="bg-transparent text-white font-mono text-xs focus:outline-none"
                        />
                      </div>


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
