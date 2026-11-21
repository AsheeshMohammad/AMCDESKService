'use client'

import { useEffect, useRef, useState } from 'react'
import type { ECharts, EChartsOption } from 'echarts'
import { money } from '@/lib/supabase'

export type ReportChartType = 'bar' | 'line' | 'pie' | 'donut' | 'bar3d' | 'line3d'

type Props = {
  categories: string[]
  values: number[]
  chartType: ReportChartType
  valueKind: 'count' | 'currency'
}

export default function ReportChart({ categories, values, chartType, valueKind }: Props) {
  const chartElement = useRef<HTMLDivElement>(null)
  const [chartFailure, setChartFailure] = useState<{ signature: string; message: string } | null>(null)
  const signature = `${chartType}:${valueKind}:${categories.join('|')}:${values.join('|')}`
  const chartError = chartFailure?.signature === signature ? chartFailure.message : ''

  useEffect(() => {
    let active = true
    let chart: ECharts | undefined
    let resize: (() => void) | undefined

    async function renderChart() {
      try {
        const echarts = await import('echarts')
        if (chartType.endsWith('3d')) await import('echarts-gl')
        if (!active || !chartElement.current) return

        chart = echarts.init(chartElement.current)
        const formatValue = (value: number) => valueKind === 'currency'
          ? money(value)
          : value.toLocaleString('en-IN')

        if (chartType === 'bar3d' || chartType === 'line3d') {
          const option = {
            animationDuration: 450,
            tooltip: {
              formatter: (params: { value?: number[] }) => {
                const [index, , value] = params.value ?? []
                return `${categories[index] ?? ''}<br />${formatValue(value ?? 0)}`
              },
            },
            xAxis3D: { type: 'category', data: categories, axisLabel: { color: '#64748b' } },
            yAxis3D: { type: 'category', data: [''], axisLabel: { color: '#64748b' } },
            zAxis3D: { type: 'value', name: valueKind === 'currency' ? 'INR' : 'Count', axisLabel: { color: '#64748b' } },
            grid3D: {
              boxWidth: 150,
              boxDepth: 36,
              viewControl: { projection: 'perspective', alpha: 24, beta: 32, autoRotate: false },
              light: { main: { intensity: 1.15 }, ambient: { intensity: 0.45 } },
            },
            series: [{
              type: chartType === 'bar3d' ? 'bar3D' : 'line3D',
              data: values.map((value, index) => [index, 0, value]),
              shading: 'lambert',
              itemStyle: { color: '#3478f6', opacity: .92 },
              lineStyle: { color: '#3478f6', width: 5 },
              symbol: 'circle',
              symbolSize: 8,
            }],
          }
          chart.setOption(option as EChartsOption, { notMerge: true })
        } else {
          const isPieChart = chartType === 'pie' || chartType === 'donut'
          const option: EChartsOption = {
            animationDuration: 450,
            aria: { enabled: true },
            tooltip: { trigger: isPieChart ? 'item' : 'axis' },
            grid: { top: 24, right: 24, bottom: isPieChart ? 56 : 42, left: 62, containLabel: true },
            xAxis: isPieChart ? undefined : {
              type: 'category',
              data: categories,
              axisTick: { show: false },
              axisLine: { lineStyle: { color: '#dce4ef' } },
              axisLabel: { color: '#64748b', rotate: categories.length > 8 ? 25 : 0 },
            },
            yAxis: isPieChart ? undefined : {
              type: 'value',
              axisLabel: { color: '#64748b', formatter: (value: number) => valueKind === 'currency' ? money(value) : value.toLocaleString('en-IN') },
              splitLine: { lineStyle: { color: '#edf1f6' } },
            },
            legend: isPieChart ? { bottom: 0, textStyle: { color: '#64748b' } } : undefined,
            series: isPieChart
              ? [{
                type: 'pie',
                radius: chartType === 'donut' ? ['48%', '72%'] : '72%',
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: { borderColor: '#fff', borderWidth: 3 },
                label: { color: '#475569', formatter: '{b}: {c}' },
                data: categories.map((name, index) => ({ name, value: values[index] })),
              }]
              : [{
                type: chartType,
                data: values,
                smooth: chartType === 'line',
                showSymbol: chartType === 'line',
                symbolSize: 7,
                itemStyle: { color: '#3478f6', borderRadius: chartType === 'bar' ? [6, 6, 0, 0] : undefined },
                lineStyle: { color: '#3478f6', width: 3 },
                areaStyle: chartType === 'line' ? { color: 'rgba(52, 120, 246, .12)' } : undefined,
              }],
          }
          chart.setOption(option)
        }

        resize = () => chart?.resize()
        window.addEventListener('resize', resize)
      } catch (error) {
        if (active) setChartFailure({
          signature,
          message: error instanceof Error ? error.message : 'The chart could not be rendered.',
        })
      }
    }

    void renderChart()
    return () => {
      active = false
      if (resize) window.removeEventListener('resize', resize)
      chart?.dispose()
    }
  }, [categories, chartType, signature, valueKind, values])

  return <div className="report-chart-shell">
    {chartError ? <p className="report-chart-error" role="alert">{chartError}</p> : <div className="report-chart" ref={chartElement} role="img" aria-label={`${chartType} chart showing ${valueKind} by category`} />}
  </div>
}
