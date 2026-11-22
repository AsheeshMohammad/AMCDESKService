'use client'

import { useEffect, useRef, useState } from 'react'
import type { ECharts, EChartsOption } from 'echarts'
import { money } from '@/lib/supabase'

export type ReportChartType = 'bar' | 'line' | 'pie' | 'donut' | 'pie3d' | 'bar3d' | 'line3d'

type Props = {
  categories: string[]
  values: number[]
  chartType: ReportChartType
  valueKind: 'count' | 'currency'
  theme: 'light' | 'dark'
}

const pieColors = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#84cc16', '#f97316', '#ec4899', '#64748b', '#a855f7', '#22c55e']

function buildPie3dSeries(categories: string[], values: number[], formatValue: (value: number) => string) {
  const activeSlices = categories
    .map((name, index) => ({ name, value: values[index] ?? 0 }))
    .filter((slice) => slice.value > 0)
  const total = activeSlices.reduce((sum, slice) => sum + slice.value, 0)
  const height = 0.22
  let startAngle = -Math.PI / 2
  const series: object[] = []

  function addSurface(
    name: string,
    color: string,
    u: { min: number; max: number; step: number },
    v: { min: number; max: number; step: number },
    x: (u: number, v: number) => number,
    y: (u: number, v: number) => number,
    z: (u: number, v: number) => number,
  ) {
    series.push({
      type: 'surface',
      name,
      parametric: true,
      parametricEquation: { u, v, x, y, z },
      shading: 'lambert',
      wireframe: { show: false },
      itemStyle: { color },
    })
  }

  activeSlices.forEach((slice, index) => {
    const endAngle = startAngle + (slice.value / total) * Math.PI * 2
    const middleAngle = (startAngle + endAngle) / 2
    const angleStep = (endAngle - startAngle) / Math.max(3, Math.ceil((endAngle - startAngle) / 0.08))
    const xOffset = Math.cos(middleAngle) * 0.025
    const yOffset = Math.sin(middleAngle) * 0.025
    const color = pieColors[index % pieColors.length]
    const arc = { min: startAngle, max: endAngle, step: angleStep }
    const radial = { min: 0, max: 1, step: 0.08 }
    const vertical = { min: 0, max: height, step: height / 4 }
    const plane = (zValue: number) => ({
      x: (angle: number, radius: number) => xOffset + radius * Math.cos(angle),
      y: (angle: number, radius: number) => yOffset + radius * Math.sin(angle),
      z: () => zValue,
    })

    const top = plane(height)
    const bottom = plane(0)
    addSurface(slice.name, color, arc, radial, top.x, top.y, top.z)
    addSurface(slice.name, color, arc, radial, bottom.x, bottom.y, bottom.z)
    addSurface(
      slice.name,
      color,
      arc,
      vertical,
      (angle) => xOffset + Math.cos(angle),
      (angle) => yOffset + Math.sin(angle),
      (_angle, z) => z,
    )
    for (const edgeAngle of [startAngle, endAngle]) {
      addSurface(
        slice.name,
        color,
        radial,
        vertical,
        (radius) => xOffset + radius * Math.cos(edgeAngle),
        (radius) => yOffset + radius * Math.sin(edgeAngle),
        (_radius, z) => z,
      )
    }
    startAngle = endAngle
  })

  return {
    series,
    legend: activeSlices.map((slice) => slice.name),
    valueFor: (name: string) => formatValue(activeSlices.find((slice) => slice.name === name)?.value ?? 0),
  }
}

export default function ReportChart({ categories, values, chartType, valueKind, theme }: Props) {
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
        const textColor = theme === 'dark' ? '#a8b5c7' : '#64748b'
        const gridColor = theme === 'dark' ? '#263449' : '#edf1f6'

        if (chartType === 'pie3d') {
          const pie = buildPie3dSeries(categories, values, formatValue)
          const option = {
            animationDuration: 450,
            tooltip: {
              trigger: 'item',
              formatter: (params: { seriesName: string }) => `${params.seriesName}<br />${pie.valueFor(params.seriesName)}`,
            },
            legend: { data: pie.legend, bottom: 0, textStyle: { color: textColor } },
            xAxis3D: { type: 'value', min: -1.35, max: 1.35, show: false },
            yAxis3D: { type: 'value', min: -1.35, max: 1.35, show: false },
            zAxis3D: { type: 'value', min: -0.05, max: 0.55, show: false },
            grid3D: {
              boxWidth: 100,
              boxDepth: 100,
              boxHeight: 34,
              viewControl: { projection: 'perspective', alpha: 30, beta: 35, distance: 150, autoRotate: false },
              light: { main: { intensity: 1.15 }, ambient: { intensity: 0.5 } },
            },
            series: pie.series,
          }
          chart.setOption(option as EChartsOption, { notMerge: true })
        } else if (chartType === 'bar3d' || chartType === 'line3d') {
          const option = {
            animationDuration: 450,
            tooltip: {
              formatter: (params: { value?: number[] }) => {
                const [index, , value] = params.value ?? []
                return `${categories[index] ?? ''}<br />${formatValue(value ?? 0)}`
              },
            },
            xAxis3D: { type: 'category', data: categories, axisLabel: { color: textColor } },
            yAxis3D: { type: 'category', data: [''], axisLabel: { color: textColor } },
            zAxis3D: { type: 'value', name: valueKind === 'currency' ? 'INR' : 'Count', axisLabel: { color: textColor } },
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
              axisLine: { lineStyle: { color: gridColor } },
              axisLabel: { color: textColor, rotate: categories.length > 8 ? 25 : 0 },
            },
            yAxis: isPieChart ? undefined : {
              type: 'value',
              axisLabel: { color: textColor, formatter: (value: number) => valueKind === 'currency' ? money(value) : value.toLocaleString('en-IN') },
              splitLine: { lineStyle: { color: gridColor } },
            },
            legend: isPieChart ? { bottom: 0, textStyle: { color: textColor } } : undefined,
            series: isPieChart
              ? [{
                type: 'pie',
                radius: chartType === 'donut' ? ['48%', '72%'] : '72%',
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: { borderColor: theme === 'dark' ? '#111827' : '#fff', borderWidth: 3 },
                label: { color: textColor, formatter: '{b}: {c}' },
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
  }, [categories, chartType, signature, theme, valueKind, values])

  return <div className="report-chart-shell">
    {chartError ? <p className="report-chart-error" role="alert">{chartError}</p> : <div className="report-chart" ref={chartElement} role="img" aria-label={`${chartType} chart showing ${valueKind} by category`} />}
  </div>
}
