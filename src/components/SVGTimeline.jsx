// --- START OF FILE SVGTimeline.jsx (Complete and Final) ---

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";

// --- Constants ---
const TRACK_HEIGHT = 40;
const BAR_HEIGHT = 20;
const LABEL_WIDTH = 100;
const RESIZE_HANDLE_WIDTH = 8;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const HEADER_HEIGHT = 50; // Space at the top for the calendar header

export default function SVGTimeline({ roadmapData = [], onTaskUpdate }) {
  // --- State and Refs ---
  const [dragState, setDragState] = useState(null);
  const [tempTask, setTempTask] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // --- Responsive Sizing: Get container width ---
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });

    const currentContainer = containerRef.current;
    if (currentContainer) {
      observer.observe(currentContainer);
    }
    
    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
  }, []); // Runs once on mount

  // --- Dynamic Calculations for Timeline Scale ---
  const { timelineStartDate, pixelsPerDay, totalDays } = useMemo(() => {
    const validTasks = roadmapData.filter(task => task && task.start && task.end);

    if (validTasks.length === 0 || containerWidth === 0) {
      return {
        timelineStartDate: new Date(),
        pixelsPerDay: 20, // Default fallback value
        totalDays: 30
      };
    }

    const allDates = validTasks.flatMap(task => [new Date(task.start), new Date(task.end)]);
    const validDates = allDates.filter(date => !isNaN(date.getTime()));

    if (validDates.length === 0) {
      return {
        timelineStartDate: new Date(),
        pixelsPerDay: 20,
        totalDays: 30
      };
    }

    const minDate = new Date(Math.min(...validDates));
    const maxDate = new Date(Math.max(...validDates));

    const startDate = new Date(minDate);
    startDate.setDate(minDate.getDate() - 2);
    const endDate = new Date(maxDate);
    endDate.setDate(maxDate.getDate() + 2);

    const totalDays = Math.max(1, (endDate - startDate) / MS_PER_DAY);
    
    const availableWidth = containerWidth - LABEL_WIDTH;
    const pixelsPerDay = availableWidth > 0 ? availableWidth / totalDays : 0;

    return { timelineStartDate: startDate, pixelsPerDay, totalDays };
  }, [roadmapData, containerWidth]);

  // --- Coordinate/Date Conversion Helpers ---
  const dateToX = useCallback((date) => {
    if (!timelineStartDate || !date) return 0;
    return ((new Date(date) - timelineStartDate) / MS_PER_DAY) * pixelsPerDay;
  }, [timelineStartDate, pixelsPerDay]);

  const xToDate = useCallback((x) => {
    if (!timelineStartDate || pixelsPerDay === 0) return new Date().toISOString().split('T')[0];
    const daysOffset = x / pixelsPerDay;
    const newDate = new Date(timelineStartDate);
    newDate.setTime(newDate.getTime() + daysOffset * MS_PER_DAY);
    newDate.setHours(12, 0, 0, 0);
    return newDate.toISOString().split('T')[0];
  }, [timelineStartDate, pixelsPerDay]);

  const getMousePosInSVG = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  }, []);

  // --- Drag and Drop Event Handlers ---
  const handleMouseDown = (e, task, type) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';
    const { x } = getMousePosInSVG(e);
    setDragState({
      id: task.id,
      type,
      initialMouseX: x,
      originalTask: task,
    });
    setTempTask(task);
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;
    const { x: currentMouseX } = getMousePosInSVG(e);
    const dx = currentMouseX - dragState.initialMouseX;
    
    if (pixelsPerDay === 0) return;

    const dayDelta = Math.round(dx / pixelsPerDay);
    const originalStart = new Date(dragState.originalTask.start);
    const originalEnd = new Date(dragState.originalTask.end);
    let newStart = new Date(originalStart);
    let newEnd = new Date(originalEnd);
    
    if (dragState.type === 'move') {
      newStart.setDate(originalStart.getDate() + dayDelta);
      newEnd.setDate(originalEnd.getDate() + dayDelta);
    } else if (dragState.type === 'resize-start') {
      newStart.setDate(originalStart.getDate() + dayDelta);
      if (newStart > newEnd) newStart = newEnd;
    } else if (dragState.type === 'resize-end') {
      newEnd.setDate(originalEnd.getDate() + dayDelta);
      if (newEnd < newStart) newEnd = newStart;
    }

    setTempTask({
      ...dragState.originalTask,
      start: newStart.toISOString().split('T')[0],
      end: newEnd.toISOString().split('T')[0]
    });
  }, [dragState, getMousePosInSVG, pixelsPerDay]);
  
  const cancelDrag = useCallback(() => {
    document.body.style.cursor = 'default';
    setDragState(null);
    setTempTask(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragState || !tempTask) return;
    if (onTaskUpdate && (tempTask.start !== dragState.originalTask.start || tempTask.end !== dragState.originalTask.end)) {
      const updatedData = roadmapData.map(task =>
        task.id === tempTask.id ? { ...task, start: tempTask.start, end: tempTask.end } : task
      );
      onTaskUpdate(updatedData);
    }
    cancelDrag();
  }, [dragState, tempTask, roadmapData, onTaskUpdate, cancelDrag]);
  
  // --- Global Event Listeners for UX ---
  useEffect(() => {
    if (!dragState) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cancelDrag();
      }
    };
    
    const handleContextMenu = (e) => {
        e.preventDefault();
        cancelDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.body.style.cursor = 'default';
    };
  }, [dragState, handleMouseMove, handleMouseUp, cancelDrag]);

  // --- Data for Rendering ---
  const height = (TRACK_HEIGHT * roadmapData.length) + HEADER_HEIGHT;
  const tasksToRender = useMemo(() => roadmapData.map(task =>
    dragState && task.id === dragState.id ? tempTask : task
  ), [roadmapData, dragState, tempTask]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", boxSizing: 'border-box' }}
      onMouseDown={() => { if (dragState) cancelDrag(); }}
    >
      <svg ref={svgRef} width={containerWidth} height={height} style={{ border: "1px solid #ccc", display: 'block', borderRadius: '8px' }}>
        <defs>
          <style>{`
            .tooltip-wrapper {
              position: relative;
              background: #333;
              color: #fff;
              padding: 6px 10px;
              border-radius: 5px;
              font-size: 12px;
              font-family: sans-serif;
              display: inline-block;
              white-space: nowrap;
            }
            .tooltip-wrapper::after {
              content: '';
              position: absolute;
              bottom: -5px;
              left: 20px;
              border-width: 5px;
              border-style: solid;
              border-color: #333 transparent transparent transparent;
            }
            .svg-tooltip-container {
              opacity: 0;
              transition: opacity 0.2s;
              pointer-events: none;
            }
            g.task-group:hover .svg-tooltip-container {
              opacity: 1;
            }
          `}</style>
        </defs>

        {/* --- Timeline Header (Calendar) --- */}
        <g className="timeline-header" transform={`translate(${LABEL_WIDTH}, 0)`}>
          {(() => {
              const months = [];
              if (totalDays > 0) {
                let currentDate = new Date(timelineStartDate);
                for (let i = 0; i < totalDays; i++) {
                    const monthName = currentDate.toLocaleString('default', { month: 'short' });
                    if (currentDate.getDate() === 1 || i === 0) {
                        months.push({
                            name: `${monthName} ${currentDate.getFullYear()}`,
                            x: dateToX(currentDate)
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
              }
              return months.map(month => (
                  <text key={month.name} x={month.x + 5} y="20" fill="#555" fontSize="12" fontFamily="sans-serif">
                      {month.name}
                  </text>
              ));
          })()}
          {Array.from({ length: Math.ceil(totalDays) }).map((_, i) => {
              const date = new Date(timelineStartDate);
              date.setDate(date.getDate() + i);
              const x = dateToX(date);
              return (
                  <g key={`day-tick-${i}`}>
                      <line
                          x1={x} y1={HEADER_HEIGHT - 30}
                          x2={x} y2={height}
                          stroke="#e0e0e0"
                          strokeDasharray={date.getDay() === 0 || date.getDay() === 6 ? "4 4" : "none"}
                      />
                      <g>
                          <text
                              x={x + 4} y={HEADER_HEIGHT - 20}
                              fontSize="10"
                              fontFamily="sans-serif"
                              fill={date.getDay() === 0 || date.getDay() === 6 ? "#c62828" : "#777"}
                              fontWeight={date.getDay() === 0 || date.getDay() === 6 ? "bold" : "normal"}
                          >
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]}
                          </text>
                          <text x={x + 4} y={HEADER_HEIGHT - 5} fontSize="10" fontFamily="sans-serif" fill="#777">
                              {date.getDate()}
                          </text>
                      </g>
                  </g>
              );
          })}
        </g>
        
        {/* --- Timeline Body (Tasks) --- */}
        <g className="timeline-body" transform={`translate(0, ${HEADER_HEIGHT})`}>
          {roadmapData.map((task, i) => {
              const displayName = task.task.length > 20 ? `${task.task.substring(0, 18)}...` : task.task;
              return (
                <text
                  key={`label-${task.id}`}
                  x={LABEL_WIDTH - 10} y={i * TRACK_HEIGHT + 25}
                  textAnchor="end" fontSize="12" fill="#333" title={task.task} fontFamily="sans-serif"
                >
                  {displayName}
                </text>
              );
          })}

          {roadmapData.map((_, i) => (
            <line
              key={`track-${i}`}
              x1={LABEL_WIDTH} x2={containerWidth}
              y1={(i + 1) * TRACK_HEIGHT} y2={(i + 1) * TRACK_HEIGHT}
              stroke="#e0e0e0"
            />
          ))}
          
          {tasksToRender
            .filter(task => task && task.start && task.end)
            .map((task) => {
              const yIndex = roadmapData.findIndex(t => t.id === task.id);
              if (yIndex === -1) return null;

              const x = dateToX(task.start) + LABEL_WIDTH;
              const taskWidth = Math.max(pixelsPerDay / 2, dateToX(task.end) - dateToX(task.start) + pixelsPerDay);
              const y = yIndex * TRACK_HEIGHT + 10;
              
              return (
                <g
                  key={task.id}
                  className="task-group"
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task, 'move'); }}
                  style={{ cursor: 'grab' }}
                >
                  <rect x={x} y={y} width={taskWidth} height={BAR_HEIGHT} rx={4} fill={task.color} />
                  <rect
                    x={x - RESIZE_HANDLE_WIDTH / 2} y={y}
                    width={RESIZE_HANDLE_WIDTH} height={BAR_HEIGHT}
                    fill="transparent"
                    style={{ cursor: 'ew-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task, 'resize-start'); }}
                  />
                  <rect
                    x={x + taskWidth - RESIZE_HANDLE_WIDTH / 2} y={y}
                    width={RESIZE_HANDLE_WIDTH} height={BAR_HEIGHT}
                    fill="transparent"
                    style={{ cursor: 'ew-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task, 'resize-end'); }}
                  />
                  <foreignObject
                    x={x + 5}
                    y={y - 45}
                    width="250"
                    height="100"
                    className="svg-tooltip-container"
                  >
                    <div xmlns="http://www.w3.org/1999/xhtml" className="tooltip-wrapper">
                      <strong>Task:</strong> {task.task}<br />
                      <strong>Dates:</strong> {task.start} to {task.end}
                    </div>
                  </foreignObject>
                </g>
              );
          })}
        </g>
      </svg>
    </div>
  );
}