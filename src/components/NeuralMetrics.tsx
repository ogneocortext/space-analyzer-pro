import React, { FC, useEffect, useRef, useState } from 'react';
import './neural-view.css';

interface NeuralMetricsProps {
  density: number; // 0-1
  connectionStrength: number; // 0-1
  patternRecognition: number; // 0-1
  anomalyScore: number; // 0-1
  processingTime: number; // milliseconds
  activeNodes: number;
}

const NeuralMetrics: FC<NeuralMetricsProps> = ({
  density,
  connectionStrength,
  patternRecognition,
  anomalyScore,
  processingTime,
  activeNodes
}) => {
  const densityCanvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [processingHistory, setProcessingHistory] = useState<number[]>([]);

  // Update processing time history for sparkline
  useEffect(() => {
    setProcessingHistory(prev => {
      const newHistory = [...prev, processingTime];
      return newHistory.slice(-20); // Keep last 20 values
    });
  }, [processingTime]);

  // Draw circular gauge
  const drawCircularGauge = (
    canvas: HTMLCanvasElement,
    value: number,
    label: string,
    color: string
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Progress arc
    const startAngle = -Math.PI / 2; // Start from top
    const endAngle = startAngle + (value * Math.PI * 2);

    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.stroke();

    // Value text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(value * 100)}%`, centerX, centerY + 5);

    // Label text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(label, centerX, centerY + 25);
  };

  // Draw sparkline
  const drawSparkline = (canvas: HTMLCanvasElement, data: number[], label: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || data.length < 2) return;

    const padding = 10;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find min/max for scaling
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = padding + height - ((value - min) / range) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#3b82f6';
    data.forEach((value, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = padding + height - ((value - min) / range) * height;

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, canvas.width / 2, canvas.height - 5);

    // Current value
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`${Math.round(data[data.length - 1])}ms`, canvas.width / 2, 15);
  };

  // Draw gauges on mount and update
  useEffect(() => {
    if (densityCanvasRef.current) {
      drawCircularGauge(densityCanvasRef.current, density, 'DENSITY', '#3b82f6');
    }
  }, [density]);

  useEffect(() => {
    if (processingCanvasRef.current) {
      drawSparkline(processingCanvasRef.current, processingHistory, 'PROCESSING TIME');
    }
  }, [processingHistory]);

  return (
    <div className="neural-metrics-container">
      {/* Circular Gauges Row */}
      <div className="metrics-gauges">
        <div className="metric-gauge">
          <canvas
            ref={densityCanvasRef}
            width={100}
            height={100}
            className="circular-gauge"
          />
        </div>

        <div className="metric-gauge">
          <canvas
            width={100}
            height={100}
            className="circular-gauge"
            ref={(canvas) => {
              if (canvas) drawCircularGauge(canvas, connectionStrength, 'CONNECTIONS', '#8b5cf6');
            }}
          />
        </div>

        <div className="metric-gauge">
          <canvas
            width={100}
            height={100}
            className="circular-gauge"
            ref={(canvas) => {
              if (canvas) drawCircularGauge(canvas, patternRecognition, 'PATTERNS', '#10b981');
            }}
          />
        </div>

        <div className="metric-gauge">
          <canvas
            width={100}
            height={100}
            className="circular-gauge"
            ref={(canvas) => {
              if (canvas) drawCircularGauge(canvas, anomalyScore, 'ANOMALIES', '#f59e0b');
            }}
          />
        </div>
      </div>

      {/* Sparkline Row */}
      <div className="metrics-sparklines">
        <div className="metric-sparkline">
          <canvas
            ref={processingCanvasRef}
            width={200}
            height={60}
            className="sparkline-chart"
          />
        </div>

        <div className="metric-stat-card">
          <div className="stat-value">{activeNodes}</div>
          <div className="stat-label">ACTIVE NODES</div>
        </div>
      </div>
    </div>
  );
};

export default NeuralMetrics;