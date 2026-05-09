<template>
  <div class="growth-chart-container">
    <div ref="chartContainer" class="chart-canvas" />
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Loading chart data...</p>
    </div>
    <div v-if="!hasData" class="no-data">
      <p class="text-slate-400">📊 No historical data available</p>
      <p class="text-sm text-slate-500">Run scans to build growth history</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { type HistoricalDataPoint } from '../../services/HistoricalDataService';

interface Props {
  data: HistoricalDataPoint[];
  loading?: boolean;
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  height: 200
});

const chartContainer = ref<HTMLElement>();
const hasData = computed(() => props.data && props.data.length > 1);

let chart: any = null;

const drawChart = () => {
  if (!chartContainer.value || !hasData.value) return;

  // Clear existing chart
  chartContainer.value.innerHTML = '';

  const container = chartContainer.value;
  const width = container.clientWidth;
  const height = props.height;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('chart-svg');

  // Prepare data
  const sortedData = [...props.data].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate scales
  const maxSize = Math.max(...sortedData.map(d => d.size));
  const maxFiles = Math.max(...sortedData.map(d => d.files));
  
  const xScale = (index: number) => 
    padding.left + (index / (sortedData.length - 1)) * (width - padding.left - padding.right);
  
  const yScaleSize = (size: number) => 
    height - padding.bottom - (size / maxSize) * (height - padding.top - padding.bottom);
  
  const yScaleFiles = (files: number) => 
    height - padding.bottom - (files / maxFiles) * (height - padding.top - padding.bottom);

  // Create gradients
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  // Size gradient
  const sizeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  sizeGradient.setAttribute('id', 'sizeGradient');
  sizeGradient.setAttribute('x1', '0%');
  sizeGradient.setAttribute('y1', '0%');
  sizeGradient.setAttribute('x2', '0%');
  sizeGradient.setAttribute('y2', '100%');
  
  const sizeStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  sizeStop1.setAttribute('offset', '0%');
  sizeStop1.setAttribute('style', 'stop-color:#3b82f6;stop-opacity:0.3');
  
  const sizeStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  sizeStop2.setAttribute('offset', '100%');
  sizeStop2.setAttribute('style', 'stop-color:#3b82f6;stop-opacity:0.05');
  
  sizeGradient.appendChild(sizeStop1);
  sizeGradient.appendChild(sizeStop2);
  defs.appendChild(sizeGradient);
  
  // Files gradient
  const filesGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  filesGradient.setAttribute('id', 'filesGradient');
  filesGradient.setAttribute('x1', '0%');
  filesGradient.setAttribute('y1', '0%');
  filesGradient.setAttribute('x2', '0%');
  filesGradient.setAttribute('y2', '100%');
  
  const filesStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  filesStop1.setAttribute('offset', '0%');
  filesStop1.setAttribute('style', 'stop-color:#8b5cf6;stop-opacity:0.3');
  
  const filesStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  filesStop2.setAttribute('offset', '100%');
  filesStop2.setAttribute('style', 'stop-color:#8b5cf6;stop-opacity:0.05');
  
  filesGradient.appendChild(filesStop1);
  filesGradient.appendChild(filesStop2);
  defs.appendChild(filesGradient);
  
  svg.appendChild(defs);

  // Grid lines
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridGroup.classList.add('grid-lines');
  
  // Horizontal grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (i / 5) * (height - padding.top - padding.bottom);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', padding.left);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width - padding.right);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', '#475569');
    line.setAttribute('stroke-width', '0.5');
    line.setAttribute('opacity', '0.3');
    gridGroup.appendChild(line);
  }
  
  svg.appendChild(gridGroup);

  // Size area
  const sizePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let sizeD = `M ${xScale(0)} ${yScaleSize(sortedData[0].size)}`;
  
  sortedData.forEach((point, index) => {
    sizeD += ` L ${xScale(index)} ${yScaleSize(point.size)}`;
  });
  
  sizeD += ` L ${xScale(sortedData.length - 1)} ${height - padding.bottom} L ${xScale(0)} ${height - padding.bottom} Z`;
  sizePath.setAttribute('d', sizeD);
  sizePath.setAttribute('fill', 'url(#sizeGradient)');
  svg.appendChild(sizePath);

  // Size line
  const sizeLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const sizePoints = sortedData.map((point, index) => 
    `${xScale(index)},${yScaleSize(point.size)}`
  ).join(' ');
  sizeLine.setAttribute('points', sizePoints);
  sizeLine.setAttribute('fill', 'none');
  sizeLine.setAttribute('stroke', '#3b82f6');
  sizeLine.setAttribute('stroke-width', '2');
  svg.appendChild(sizeLine);

  // Files area (scaled to fit)
  const filesPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let filesD = `M ${xScale(0)} ${yScaleFiles(sortedData[0].files)}`;
  
  sortedData.forEach((point, index) => {
    filesD += ` L ${xScale(index)} ${yScaleFiles(point.files)}`;
  });
  
  filesD += ` L ${xScale(sortedData.length - 1)} ${height - padding.bottom} L ${xScale(0)} ${height - padding.bottom} Z`;
  filesPath.setAttribute('d', filesD);
  filesPath.setAttribute('fill', 'url(#filesGradient)');
  svg.appendChild(filesPath);

  // Files line
  const filesLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const filesPoints = sortedData.map((point, index) => 
    `${xScale(index)},${yScaleFiles(point.files)}`
  ).join(' ');
  filesLine.setAttribute('points', filesPoints);
  filesLine.setAttribute('fill', 'none');
  filesLine.setAttribute('stroke', '#8b5cf6');
  filesLine.setAttribute('stroke-width', '2');
  svg.appendChild(filesLine);

  // Data points
  sortedData.forEach((point, index) => {
    // Size point
    const sizeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sizeCircle.setAttribute('cx', xScale(index));
    sizeCircle.setAttribute('cy', yScaleSize(point.size));
    sizeCircle.setAttribute('r', '3');
    sizeCircle.setAttribute('fill', '#3b82f6');
    sizeCircle.setAttribute('stroke', '#1e293b');
    sizeCircle.setAttribute('stroke-width', '1');
    
    // Tooltip for size
    const sizeTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    sizeTitle.textContent = `${formatDate(point.date)}\\nSize: ${formatBytes(point.size)}`;
    sizeCircle.appendChild(sizeTitle);
    
    svg.appendChild(sizeCircle);

    // Files point
    const filesCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    filesCircle.setAttribute('cx', xScale(index));
    filesCircle.setAttribute('cy', yScaleFiles(point.files));
    filesCircle.setAttribute('r', '3');
    filesCircle.setAttribute('fill', '#8b5cf6');
    filesCircle.setAttribute('stroke', '#1e293b');
    filesCircle.setAttribute('stroke-width', '1');
    
    // Tooltip for files
    const filesTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    filesTitle.textContent = `${formatDate(point.date)}\\nFiles: ${point.files.toLocaleString()}`;
    filesCircle.appendChild(filesTitle);
    
    svg.appendChild(filesCircle);
  });

  // X-axis labels
  sortedData.forEach((point, index) => {
    if (index % Math.ceil(sortedData.length / 6) === 0) { // Show ~6 labels max
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', xScale(index));
      text.setAttribute('y', height - padding.bottom + 20);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#94a3b8');
      text.setAttribute('font-size', '11');
      text.textContent = formatDate(point.date, true);
      svg.appendChild(text);
    }
  });

  // Y-axis labels (size)
  for (let i = 0; i <= 5; i++) {
    const value = (maxSize * i) / 5;
    const y = height - padding.bottom - (i / 5) * (height - padding.top - padding.bottom);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', padding.left - 10);
    text.setAttribute('y', y + 4);
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('fill', '#3b82f6');
    text.setAttribute('font-size', '10');
    text.textContent = formatBytes(value);
    svg.appendChild(text);
  }

  // Legend
  const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  legendGroup.setAttribute('transform', `translate(${width - 120}, 20)`);
  
  // Size legend
  const sizeLegendRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  sizeLegendRect.setAttribute('x', '0');
  sizeLegendRect.setAttribute('y', '0');
  sizeLegendRect.setAttribute('width', '12');
  sizeLegendRect.setAttribute('height', '12');
  sizeLegendRect.setAttribute('fill', '#3b82f6');
  legendGroup.appendChild(sizeLegendRect);
  
  const sizeLegendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  sizeLegendText.setAttribute('x', '18');
  sizeLegendText.setAttribute('y', '10');
  sizeLegendText.setAttribute('fill', '#94a3b8');
  sizeLegendText.setAttribute('font-size', '11');
  sizeLegendText.textContent = 'Storage Size';
  legendGroup.appendChild(sizeLegendText);
  
  // Files legend
  const filesLegendRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  filesLegendRect.setAttribute('x', '0');
  filesLegendRect.setAttribute('y', '18');
  filesLegendRect.setAttribute('width', '12');
  filesLegendRect.setAttribute('height', '12');
  filesLegendRect.setAttribute('fill', '#8b5cf6');
  legendGroup.appendChild(filesLegendRect);
  
  const filesLegendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  filesLegendText.setAttribute('x', '18');
  filesLegendText.setAttribute('y', '28');
  filesLegendText.setAttribute('fill', '#94a3b8');
  filesLegendText.setAttribute('font-size', '11');
  filesLegendText.textContent = 'File Count';
  legendGroup.appendChild(filesLegendText);
  
  svg.appendChild(legendGroup);

  container.appendChild(svg);
};

const formatDate = (dateString: string, short = false): string => {
  const date = new Date(dateString);
  if (short) {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const resizeChart = () => {
  if (hasData.value) {
    drawChart();
  }
};

watch(() => props.data, drawChart, { deep: true });
watch(() => props.height, drawChart);

onMounted(() => {
  nextTick(() => {
    drawChart();
    window.addEventListener('resize', resizeChart);
  });
});

// Cleanup
import { onUnmounted } from 'vue';
onUnmounted(() => {
  window.removeEventListener('resize', resizeChart);
});
</script>

<style scoped>
.growth-chart-container {
  position: relative;
  width: 100%;
  height: v-bind(height + 'px');
}

.chart-canvas {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.8);
  border-radius: 0.5rem;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #475569;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.chart-svg {
  width: 100%;
  height: 100%;
}

.grid-lines {
  pointer-events: none;
}

.chart-svg polyline:hover {
  stroke-width: 3;
  filter: brightness(1.2);
}

.chart-svg circle:hover {
  r: 5;
  filter: brightness(1.3);
}
</style>
