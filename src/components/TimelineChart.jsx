// --- START OF FILE TimelineChart.jsx ---

import React, { useState, useContext, useEffect } from 'react';
import { Chart } from 'react-google-charts';
import { Context } from '../Context';
import './TimelineChart.css';

const TimelineChart = ({ roadmapData, onTaskUpdate }) => {
  const { data } = useContext(Context);
  const [chartData, setChartData] = useState([]);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'gantt'
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);

  // Convert roadmap data to Google Charts format
  useEffect(() => {
    if (!roadmapData || roadmapData.length === 0) {
      setChartData([]);
      return;
    }

    const filteredData = showCompleted 
      ? roadmapData 
      : roadmapData.filter(task => !task.completed);

    // --- NEW LOGIC START ---
    // This is the core of the new feature. We process tasks to calculate their visual end time.
    const processedTasks = filteredData.map((task, index) => {
      const taskDate = new Date(task.date);
      const [startHour, startMinute] = (task.dailyStartTime || '10:00').split(':').map(Number);
      const durationHours = task.dailyHours || 1;

      const startDateTime = new Date(taskDate);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      // Default end time is based on the task's own duration. This is the fallback.
      let endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

      // Look ahead to the next task to determine if we should extend the visual duration.
      const nextTask = filteredData[index + 1];

      // If there is a next task AND it's on a different day, extend the current task's bar.
      if (nextTask && task.date !== nextTask.date) {
        const nextTaskStartDate = new Date(nextTask.date);
        const [nextStartHour, nextStartMinute] = (nextTask.dailyStartTime || '10:00').split(':').map(Number);
        nextTaskStartDate.setHours(nextStartHour, nextStartMinute, 0, 0);
        
        // Set the visual end time of the current task to be the start time of the next task.
        endDateTime = nextTaskStartDate;
      }
      // If the next task is on the same day, or this is the last task, the default end time is used.

      return {
        ...task, // Keep original task data
        startDateTime,
        endDateTime
      };
    });
    // --- NEW LOGIC END ---

    if (viewMode === 'timeline') {
      const timelineData = [
        [{ type: 'string', id: 'Task' }, { type: 'string', id: 'Name' }, { type: 'date', id: 'Start' }, { type: 'date', id: 'End' }]
      ];
      processedTasks.forEach(pTask => {
        const taskName = pTask.completed ? `✅ ${pTask.task}` : pTask.task;
        timelineData.push([pTask.id || `task-${pTask.startDateTime}`, taskName, pTask.startDateTime, pTask.endDateTime]);
      });
      setChartData(timelineData);
    } else { // gantt view
      const ganttData = [
        [{ type: 'string', label: 'Task ID' }, { type: 'string', label: 'Task Name' }, { type: 'string', label: 'Resource' }, { type: 'date', label: 'Start Date' }, { type: 'date', label: 'End Date' }, { type: 'number', label: 'Duration' }, { type: 'number', label: 'Percent Complete' }, { type: 'string', label: 'Dependencies' }]
      ];
      processedTasks.forEach(pTask => {
        const durationMs = pTask.endDateTime.getTime() - pTask.startDateTime.getTime();
        const percentComplete = pTask.completed ? 100 : 0;
        ganttData.push([
          pTask.id || `task-${pTask.startDateTime}`,
          pTask.task,
          'AI Coach',
          pTask.startDateTime,
          pTask.endDateTime,
          durationMs > 0 ? durationMs : null, // duration in milliseconds, null if zero
          percentComplete,
          null 
        ]);
      });
      setChartData(ganttData);
    }
  }, [roadmapData, viewMode, showCompleted]);

  // Handle chart selection events
  const handleChartSelect = (chartWrapper) => {
    const selection = chartWrapper.getChart().getSelection();
    if (selection.length > 0) {
      const selectedRow = selection[0].row;
      // We need to find the original task from the filtered data, as its index matches the chart row
      const filteredDataSource = showCompleted ? roadmapData : roadmapData.filter(task => !task.completed);
      if (selectedRow >= 0 && filteredDataSource[selectedRow]) {
        setSelectedTask(filteredDataSource[selectedRow]);
      }
    }
  };

  // Toggle task completion
  const toggleTaskCompletion = (taskId) => {
    if (onTaskUpdate) {
      const updatedData = roadmapData.map(task => 
        task.id === taskId 
          ? { ...task, completed: !task.completed }
          : task
      );
      onTaskUpdate(updatedData);
    }
  };

  // Chart options
  const getChartOptions = () => {
    // ... (This function remains unchanged)
    const baseOptions = {
      height: Math.max(400, roadmapData.length * 50),
      backgroundColor: '#f8f9fa',
      timeline: {
        groupByRowLabel: false,
        showRowLabels: true,
        showBarLabels: true,
        singleColor: '#8dd3c7',
        colorByRowLabel: true
      },
      hAxis: {
        format: 'MMM dd, yyyy HH:mm'
      },
      tooltip: {
        isHtml: true,
        trigger: 'focus'
      }
    };

    if (viewMode === 'gantt') {
      return {
        ...baseOptions,
        gantt: {
          trackHeight: 30,
          barHeight: 20,
          groupByRowLabel: false,
          percentEnabled: true,
          shadowEnabled: true,
          labelStyle: {
            fontSize: 12,
            color: '#333'
          },
          criticalPathEnabled: false,
          criticalPathStyle: {
            stroke: '#e64a19',
            strokeWidth: 5
          }
        }
      };
    }

    return baseOptions;
  };

  const language = data?.language || 'de';
  const labels = data?.roadmapLabels || {};

  return (
    <div className="timeline-chart-container">
      <div className="timeline-header">
        <h2 className="timeline-title">
          {labels.timelineTitle || 'Project Timeline'}
        </h2>
        
        <div className="timeline-controls">
          <div className="view-mode-selector">
            <button 
              className={`mode-button ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              📊 {labels.timelineView || 'Timeline'}
            </button>
            <button 
              className={`mode-button ${viewMode === 'gantt' ? 'active' : ''}`}
              onClick={() => setViewMode('gantt')}
            >
              📈 {labels.ganttView || 'Gantt'}
            </button>
          </div>

          <div className="filter-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              {labels.showCompleted || 'Show Completed Tasks'}
            </label>
          </div>
        </div>
      </div>

      {chartData.length > 1 ? (
        <div className="chart-wrapper">
          <Chart
            chartType={viewMode === 'timeline' ? 'Timeline' : 'Gantt'}
            width="100%"
            height={`${Math.max(400, roadmapData.length * 50)}px`}
            data={chartData}
            options={getChartOptions()}
            chartEvents={[
              {
                eventName: 'select',
                callback: ({ chartWrapper }) => handleChartSelect(chartWrapper)
              }
            ]}
          />
        </div>
      ) : (
        <div className="no-data-message">
          <p>{labels.noTasksMessage || 'No tasks to display in timeline.'}</p>
        </div>
      )}

      {selectedTask && (
        <div className="task-details-panel">
          <div className="task-details-header">
            <h3>{labels.taskDetails || 'Task Details'}</h3>
            <button 
              className="close-button"
              onClick={() => setSelectedTask(null)}
            >
              ✕
            </button>
          </div>
          
          <div className="task-details-content">
            <div className="task-detail-row">
              <strong>{labels.taskLabel || 'Task'}:</strong>
              <span className={selectedTask.completed ? 'completed-task' : ''}>
                {selectedTask.task}
              </span>
            </div>
            
            <div className="task-detail-row">
              <strong>{labels.dateLabel || 'Date'}:</strong>
              <span>{new Date(selectedTask.date).toLocaleDateString()}</span>
            </div>
            
            <div className="task-detail-row">
              <strong>{labels.timeLabel || 'Time'}:</strong>
              <span>{selectedTask.dailyStartTime || '10:00'} - {
                (() => {
                  const [startHour, startMinute] = (selectedTask.dailyStartTime || '10:00').split(':').map(Number);
                  const duration = selectedTask.dailyHours || 1;
                  const totalMinutes = startHour * 60 + startMinute + (duration * 60);
                  const endHour = Math.floor(totalMinutes / 60);
                  const endMinute = totalMinutes % 60;
                  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
                })()
              }</span>
            </div>
            
            <div className="task-detail-row">
              <strong>{labels.durationLabel || 'Duration'}:</strong>
              <span>{selectedTask.dailyHours || 1}h</span>
            </div>
            
            <div className="task-detail-row">
              <strong>{labels.statusLabel || 'Status'}:</strong>
              <span className={selectedTask.completed ? 'status-completed' : 'status-pending'}>
                {selectedTask.completed ? 
                  (labels.completedStatus || 'Completed') : 
                  (labels.pendingStatus || 'Pending')
                }
              </span>
            </div>
            
            {selectedTask.motivation && (
              <div className="task-detail-row">
                <strong>{labels.motivationLabel || 'Motivation'}:</strong>
                <span>{selectedTask.motivation}</span>
              </div>
            )}
            
            <div className="task-detail-actions">
              <button 
                className={`toggle-complete-button ${selectedTask.completed ? 'mark-incomplete' : 'mark-complete'}`}
                onClick={() => toggleTaskCompletion(selectedTask.id)}
              >
                {selectedTask.completed ? 
                  (labels.markIncomplete || 'Mark as Incomplete') : 
                  (labels.markComplete || 'Mark as Complete')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="timeline-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">{labels.totalTasks || 'Total Tasks'}:</span>
            <span className="stat-value">{roadmapData.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{labels.completedTasks || 'Completed'}:</span>
            <span className="stat-value">{roadmapData.filter(task => task.completed).length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{labels.totalHours || 'Total Hours'}:</span>
            <span className="stat-value">{roadmapData.reduce((sum, task) => sum + (task.dailyHours || 1), 0)}h</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineChart;