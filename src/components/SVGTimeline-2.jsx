import React, { useState } from "react";

const tasks = [
  { id: 1, track: 1, start: "2025-07-01", end: "2025-07-10", color: "#3ecf8e" },
  { id: 2, track: 2, start: "2025-07-05", end: "2025-07-15", color: "#ffc107" },
  { id: 3, track: 3, start: "2025-07-03", end: "2025-07-20", color: "#ff7043" },
  { id: 4, track: 4, start: "2025-07-12", end: "2025-07-25", color: "#42a5f5" },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TRACK_HEIGHT = 40;
const BAR_HEIGHT = 20;
const START_DATE = new Date("2025-07-01");
const LABEL_WIDTH = 100;

function dateToX(date) {
  return (new Date(date) - START_DATE) / MS_PER_DAY * 20;
}

export default function TimelineSVG() {
  const [hoveredTask, setHoveredTask] = useState(null);
  const width = 800;
  const height = TRACK_HEIGHT * tasks.length + 40;

  return (
    <div style={{ position: "relative" }}>
      <svg width={width + LABEL_WIDTH} height={height} style={{ border: "1px solid #ccc" }}>
        {/* Track lines */}
        {tasks.map((_, i) => (
          <line
            key={`track-${i}`}
            x1={LABEL_WIDTH}
            x2={width + LABEL_WIDTH}
            y1={(i + 1) * TRACK_HEIGHT}
            y2={(i + 1) * TRACK_HEIGHT}
            stroke="#e0e0e0"
          />
        ))}

        {/* Row labels */}
        {tasks.map((task, i) => (
          <text
            key={`label-${task.id}`}
            x={LABEL_WIDTH - 10}
            y={i * TRACK_HEIGHT + 25}
            textAnchor="end"
            fontSize="14"
            fill="#333"
          >
            Task {task.track}
          </text>
        ))}

        {/* Task bars */}
        {tasks.map((task) => {
          const x = dateToX(task.start) + LABEL_WIDTH;
          const width = dateToX(task.end) - dateToX(task.start);
          const y = (task.track - 1) * TRACK_HEIGHT + 10;
          return (
            <rect
              key={task.id}
              x={x}
              y={y}
              width={width}
              height={BAR_HEIGHT}
              rx={4}
              fill={task.color}
              onMouseEnter={() => setHoveredTask(task)}
              onMouseLeave={() => setHoveredTask(null)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredTask && (
        <div
          style={{
            position: "absolute",
            top: hoveredTask.track * TRACK_HEIGHT - 10,
            left: dateToX(hoveredTask.start) + LABEL_WIDTH + 10,
            background: "#333",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "none",
          }}
        >
          <div><strong>Task {hoveredTask.track}</strong></div>
          <div>Start: {hoveredTask.start}</div>
          <div>End: {hoveredTask.end}</div>
        </div>
      )}
    </div>
  );
}
