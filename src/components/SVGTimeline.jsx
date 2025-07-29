// --- START OF FILE SVGTimeline.jsx (FINAL CORRECTED VERSION) ---

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";

// --- Constants ---
const TRACK_HEIGHT = 40;
const BAR_HEIGHT = 20;
const LABEL_WIDTH = 100;
const RESIZE_HANDLE_WIDTH = 8;
const PIXELS_PER_DAY = 20;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export default function SVGTimeline({ roadmapData = [], onTaskUpdate }) {
  const [dragState, setDragState] = useState(null);
  const [tempTask, setTempTask] = useState(null);
  const svgRef = useRef(null);

  const { timelineStartDate, width } = useMemo(() => {
    const validTasks = roadmapData.filter(task => task && task.start && task.end);
    if (validTasks.length === 0) {
      const today = new Date();
      return {
        timelineStartDate: new Date(today.getFullYear(), today.getMonth(), 1),
        width: 30 * PIXELS_PER_DAY,
      };
    }
    const allDates = validTasks.flatMap(task => [new Date(task.start), new Date(task.end)]);
    const validDates = allDates.filter(date => !isNaN(date.getTime()));
    if (validDates.length === 0) {
      const today = new Date();
      return {
        timelineStartDate: new Date(today.getFullYear(), today.getMonth(), 1),
        width: 30 * PIXELS_PER_DAY,
      };
    }
    const minDate = new Date(Math.min(...validDates));
    const maxDate = new Date(Math.max(...validDates));
    const timelineStartDate = new Date(minDate);
    timelineStartDate.setDate(minDate.getDate() - 5);
    const timelineEndDate = new Date(maxDate);
    timelineEndDate.setDate(maxDate.getDate() + 5);
    const totalDays = Math.max(1, (timelineEndDate - timelineStartDate) / MS_PER_DAY);
    const width = totalDays * PIXELS_PER_DAY;
    return { timelineStartDate, width };
  }, [roadmapData]);

  const dateToX = useCallback((date) => {
    if (!timelineStartDate || !date) return 0;
    return ((new Date(date) - timelineStartDate) / MS_PER_DAY) * PIXELS_PER_DAY;
  }, [timelineStartDate]);

  const xToDate = useCallback((x) => {
    if (!timelineStartDate) return new Date().toISOString().split('T')[0];
    const daysOffset = x / PIXELS_PER_DAY;
    const newDate = new Date(timelineStartDate);
    newDate.setTime(newDate.getTime() + daysOffset * MS_PER_DAY);
    newDate.setHours(12, 0, 0, 0);
    return newDate.toISOString().split('T')[0];
  }, [timelineStartDate]);

  const getMousePosInSVG = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  }, []); // svgRef is stable, so dependencies are empty

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
    
    const originalStart = new Date(dragState.originalTask.start);
    const originalEnd = new Date(dragState.originalTask.end);
    let newStart = new Date(originalStart);
    let newEnd = new Date(originalEnd);
    
    const dayDelta = Math.round(dx / PIXELS_PER_DAY);

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
  }, [dragState, getMousePosInSVG]);

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
  
  // Single, combined useEffect for all global event listeners
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
    }

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

  const height = TRACK_HEIGHT * roadmapData.length + 40;
  const tasksToRender = useMemo(() => roadmapData.map(task =>
    dragState && task.id === dragState.id ? tempTask : task
  ), [roadmapData, dragState, tempTask]);

  // [FIX] The return statement wraps all the JSX
  return (
    <div
      style={{ position: "relative", overflowX: 'auto', padding: '1rem' }}
      onMouseDown={() => {
        if (dragState) {
          cancelDrag();
        }
      }}
    >
      <svg ref={svgRef} width={width + LABEL_WIDTH} height={height} style={{ border: "1px solid #ccc", display: 'block' }}>
        <defs>
          <style>{`
            .svg-tooltip {
              background: #333; color: #fff; padding: 4px 8px; border-radius: 4px;
              font-size: 12px; opacity: 0; transition: opacity 0.2s;
              display: inline-block; pointer-events: none;
            }
            g.task-group:hover .svg-tooltip { opacity: 1; }
          `}</style>
        </defs>

        {roadmapData.map((_, i) => (
          <line
            key={`track-${i}`}
            x1={LABEL_WIDTH} x2={width + LABEL_WIDTH}
            y1={(i + 1) * TRACK_HEIGHT} y2={(i + 1) * TRACK_HEIGHT}
            stroke="#e0e0e0"
          />
        ))}

        {roadmapData.map((task, i) => (
          <text key={`label-${task.id}`} x={LABEL_WIDTH - 10} y={i * TRACK_HEIGHT + 25}
            textAnchor="end" fontSize="14" fill="#333">
            Task {task.track}
          </text>
        ))}
        
        {tasksToRender
          .filter(task => task && task.start && task.end)
          .map((task) => {
            const yIndex = roadmapData.findIndex(t => t.id === task.id);
            if (yIndex === -1) return null;

            const x = dateToX(task.start) + LABEL_WIDTH;
            const taskWidth = Math.max(PIXELS_PER_DAY, dateToX(task.end) - dateToX(task.start) + PIXELS_PER_DAY);
            const y = yIndex * TRACK_HEIGHT + 10;
            
            return (
              <g
                key={task.id}
                className="task-group"
                onMouseDown={(e) => {
                  e.stopPropagation(); 
                  handleMouseDown(e, task, 'move');
                }}
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
                <foreignObject x={x + 5} y={y + BAR_HEIGHT + 5} width="150" height="100">
                  <div xmlns="http://www.w3.org/1999/xhtml" className="svg-tooltip">
                    <strong>Task {task.track}</strong><br />
                    Start: {task.start}<br />
                    End: {task.end}
                  </div>
                </foreignObject>
              </g>
            );
        })}
      </svg>
    </div>
  );
}