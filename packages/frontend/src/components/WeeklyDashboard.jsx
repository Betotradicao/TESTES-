import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const DAY_LABELS = ['Sáb', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  // DD/MM/YYYY
  if (s.includes('/')) {
    const [d, m, y] = s.split('/');
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss (ISO)
  if (s.includes('-') && s.length >= 10) {
    const [y, m, d] = s.substring(0, 10).split('-');
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  // Date object or timestamp
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatCurrencyShort(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

function formatCurrency(value) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * WeeklyDashboard - Gráficos semanais de Entradas x Saídas
 */
export default function WeeklyDashboard({
  items = [],
  dateField,
  entradaFilter,
  saidaFilter,
  valueField,
  startDate,
  endDate,
  aggregated = false,
  onBarClick,
}) {
  const weeks = useMemo(() => {
    if (!items.length || !startDate || !endDate) return [];

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return [];

    // Find first Saturday <= start
    const firstSat = new Date(start);
    const dayOfWeek = firstSat.getDay();
    const diffToSat = dayOfWeek === 6 ? 0 : (dayOfWeek + 1);
    firstSat.setDate(firstSat.getDate() - diffToSat);

    const weeksList = [];
    let weekStart = new Date(firstSat);

    while (weekStart <= end) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      weeksList.push({
        start: new Date(weekStart),
        end: new Date(weekEnd),
        days: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          return { date: new Date(d), entradas: 0, saidas: 0, entradasBco: 0, saidasBco: 0 };
        }),
        totalEntradas: 0,
        totalSaidas: 0,
        totalEntradasBco: 0,
        totalSaidasBco: 0,
      });

      weekStart.setDate(weekStart.getDate() + 7);
    }

    // Populate data
    if (aggregated) {
      items.forEach(item => {
        const itemDate = parseDate(item[dateField]);
        if (!itemDate) return;

        const entVal = Math.abs(parseFloat(item.ENTRADAS) || 0);
        const saiVal = Math.abs(parseFloat(item.SAIDAS) || 0);
        const entBco = Math.abs(parseFloat(item.ENTRADAS_BCO) || 0);
        const saiBco = Math.abs(parseFloat(item.SAIDAS_BCO) || 0);

        for (const week of weeksList) {
          for (const day of week.days) {
            if (
              itemDate.getFullYear() === day.date.getFullYear() &&
              itemDate.getMonth() === day.date.getMonth() &&
              itemDate.getDate() === day.date.getDate()
            ) {
              day.entradas += entVal;
              day.saidas += saiVal;
              day.entradasBco += entBco;
              day.saidasBco += saiBco;
              week.totalEntradas += entVal;
              week.totalSaidas += saiVal;
              week.totalEntradasBco += entBco;
              week.totalSaidasBco += saiBco;
              return;
            }
          }
        }
      });
    } else {
      items.forEach(item => {
        const itemDate = parseDate(item[dateField]);
        if (!itemDate) return;

        const val = Math.abs(parseFloat(item[valueField]) || 0);
        const isEntrada = entradaFilter(item);
        const isSaida = saidaFilter(item);

        for (const week of weeksList) {
          for (const day of week.days) {
            if (
              itemDate.getFullYear() === day.date.getFullYear() &&
              itemDate.getMonth() === day.date.getMonth() &&
              itemDate.getDate() === day.date.getDate()
            ) {
              if (isEntrada) {
                day.entradas += val;
                week.totalEntradas += val;
              } else if (isSaida) {
                day.saidas += val;
                week.totalSaidas += val;
              }
              return;
            }
          }
        }
      });
    }

    // Mostrar todas as semanas do período (inclusive sem dados)
    return weeksList;
  }, [items, dateField, entradaFilter, saidaFilter, valueField, startDate, endDate, aggregated]);

  if (!weeks.length) return null;

  const hasBancoData = weeks.some(w => w.totalEntradasBco > 0 || w.totalSaidasBco > 0);

  const formatWeekRange = (week) => {
    const s = week.start;
    const e = week.end;
    const sd = String(s.getDate()).padStart(2, '0');
    const sm = String(s.getMonth() + 1).padStart(2, '0');
    const ed = String(e.getDate()).padStart(2, '0');
    const em = String(e.getMonth() + 1).padStart(2, '0');
    if (sm === em) return `${sd} a ${ed}/${sm}`;
    return `${sd}/${sm} a ${ed}/${em}`;
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-500">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
        <h3 className="text-base font-bold text-gray-700">Dashboards Semanais</h3>
        <span className="text-sm text-gray-400 ml-1">Sábado a Sexta</span>
      </div>

      <div className={`grid gap-3 ${weeks.length <= 4 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'}`}>
        {weeks.map((week, idx) => (
          <WeekChart key={idx} week={week} index={idx} label={formatWeekRange(week)} onBarClick={onBarClick} mode="sistema" />
        ))}
        <TotalCard weeks={weeks} mode="sistema" />
      </div>
    </div>
  );
}

function WeekChart({ week, index, label, onBarClick, mode = 'sistema' }) {
  const isBanco = mode === 'banco';
  const dayLabels = week.days.map((d, i) => {
    const dayNum = String(d.date.getDate());
    return [DAY_LABELS[i], dayNum];
  });

  const totalEnt = isBanco ? week.totalEntradasBco : week.totalEntradas;
  const totalSai = isBanco ? week.totalSaidasBco : week.totalSaidas;
  const hasData = totalEnt > 0 || totalSai > 0;
  const saldo = totalEnt - totalSai;

  const data = {
    labels: dayLabels,
    datasets: [
      {
        label: 'Entradas',
        data: week.days.map(d => isBanco ? d.entradasBco : d.entradas),
        backgroundColor: 'rgba(34, 197, 94, 0.85)',
        borderRadius: 4,
        barPercentage: 0.8,
        categoryPercentage: 0.75,
      },
      {
        label: 'Saídas',
        data: week.days.map(d => isBanco ? d.saidasBco : d.saidas),
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        borderRadius: 4,
        barPercentage: 0.8,
        categoryPercentage: 0.75,
      },
    ],
  };

  const handleClick = (event, elements) => {
    if (!onBarClick || !elements.length) return;
    const el = elements[0];
    const dayIndex = el.index;
    const datasetIndex = el.datasetIndex;
    const day = week.days[dayIndex];
    if (!day) return;
    const d = day.date;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const type = datasetIndex === 0 ? 'entrada' : 'saida';
    onBarClick(dateStr, type);
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    },
    onClick: handleClick,
    plugins: {
      legend: { display: false },
      tooltip: {
        titleFont: { size: 13 },
        bodyFont: { size: 13 },
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11, weight: 'bold' }, color: '#6b7280' },
      },
      y: {
        beginAtZero: true,
        suggestedMax: hasData ? undefined : 100,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { size: 11 },
          color: '#6b7280',
          callback: (v) => formatCurrencyShort(v),
          maxTicksLimit: 4,
        },
      },
    },
  };

  return (
    <div className={`border rounded-xl p-4 shadow-sm ${hasData ? 'border-gray-200 bg-gray-50/50' : 'border-gray-100 bg-gray-50/30 opacity-60'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-700">Semana {index + 1}</span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <div style={{ height: '160px' }}>
        <Bar data={data} options={options} />
      </div>
      {/* Footer: Entradas / Saídas / Saldo */}
      <div className="mt-2">
        {isBanco && (
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">🏦 Extrato Bancário</div>
        )}
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <td className="text-green-600 font-bold py-0.5">Entradas</td>
              <td className="text-green-700 font-black text-right py-0.5">{hasData ? formatCurrency(totalEnt) : '-'}</td>
            </tr>
            <tr>
              <td className="text-red-600 font-bold py-0.5">Saídas</td>
              <td className="text-red-700 font-black text-right py-0.5">{hasData ? formatCurrency(totalSai) : '-'}</td>
            </tr>
            <tr className={`border-t ${saldo >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <td className={`font-bold py-0.5 ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</td>
              <td className={`font-black text-right py-0.5 ${saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{hasData ? formatCurrency(saldo) : '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalCard({ weeks, mode = 'sistema' }) {
  const isBanco = mode === 'banco';
  const totalEntradas = weeks.reduce((s, w) => s + (isBanco ? w.totalEntradasBco : w.totalEntradas), 0);
  const totalSaidas = weeks.reduce((s, w) => s + (isBanco ? w.totalSaidasBco : w.totalSaidas), 0);
  const saldo = totalEntradas - totalSaidas;

  return (
    <div className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white flex flex-col justify-center gap-1.5">
      <div className="text-sm font-bold text-gray-700 text-center">Resumo do Mês</div>
      {isBanco && (
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">🏦 Extrato Bancário</div>
      )}
      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-center">
        <p className="text-[10px] text-green-600 font-semibold uppercase">Entradas</p>
        <p className="text-sm font-black text-green-700">{formatCurrency(totalEntradas)}</p>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-center">
        <p className="text-[10px] text-red-600 font-semibold uppercase">Saídas</p>
        <p className="text-sm font-black text-red-700">{formatCurrency(totalSaidas)}</p>
      </div>
      <div className={`${saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg px-3 py-1.5 text-center`}>
        <p className={`text-[10px] font-semibold uppercase ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Resultado</p>
        <p className={`text-base font-black ${saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(saldo)}</p>
      </div>
    </div>
  );
}
