// --- START OF FILE CalendarTimeline.jsx ---

import React, { useState, useContext, useEffect } from 'react';
import Timeline, { TimelineMarkers, TodayMarker } from 'react-calendar-timeline';
import moment from 'moment';
import { Context } from '../Context';
import './CalendarTimeline.css';

// --- FIX: CSS import is required for the timeline to be styled correctly. ---
// This is the most common path. If it fails, try 'react-calendar-timeline/src/lib/Timeline.css'
// or import it in your main App.css file.
 // import 'react-calendar-timeline/src/lib/Timeline.css';

const CalendarTimeline = ({ roadmapData, onTaskUpdate }) => {
  const { data } = useContext(Context);
  const [groups, setGroups] = useState([{ id: 1, title: 'Tasks' }]);
  const [items, setItems] = useState([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  // Convert roadmapData to react-calendar-timeline format
  useEffect(() => {
    if (!roadmapData || !Array.isArray(roadmapData)) {
      setItems([]);
      return;
    };

    const filteredData = showCompleted 
      ? roadmapData 
      : roadmapData.filter(task => !task.completed);

    const timelineItems = filteredData.map(task => {
      const startMoment = moment(task.date).set({ 
          hour: parseInt((task.dailyStartTime || '10:00').split(':')[0]), 
          minute: parseInt((task.dailyStartTime || '10:00').split(':')[1]) 
      });
      const endMoment = startMoment.clone().add(task.dailyHours || 1, 'hours');

      return {
        id: task.id,
        group: 1,
        title: task.task,
        start_time: startMoment.valueOf(),
        end_time: endMoment.valueOf(),
        canMove: true,
        canResize: 'both',
        className: task.completed ? 'item-completed-rct' : 'item-pending-rct',
        // Store the original task object to retrieve it on select
        originalTask: task 
      };
    });

    setItems(timelineItems);
  }, [roadmapData, showCompleted]);
  
  // Handler for moving an item
  const handleItemMove = (itemId, dragTime) => {
    const movedItem = items.find(i => i.id === itemId);
    if (!movedItem) return;

    const duration = movedItem.end_time - movedItem.start_time;
    updateTask(itemId, moment(dragTime), moment(dragTime + duration));
  };
  
  // Handler for resizing an item
  const handleItemResize = (itemId, time, edge) => {
    const resizedItem = items.find(i => i.id === itemId);
    if (!resizedItem) return;

    const newStartTime = edge === 'left' ? moment(time) : moment(resizedItem.start_time);
    const newEndTime = edge === 'right' ? moment(time) : moment(resizedItem.end_time);
    updateTask(itemId, newStartTime, newEndTime);
  };

  // Central update function
  const updateTask = (taskId, newStartMoment, newEndMoment) => {
    const originalTask = roadmapData.find(t => t.id === taskId);
    if (!originalTask) return;

    const newDurationMs = newEndMoment.valueOf() - newStartMoment.valueOf();
    const newDailyHours = Math.max(0.5, Math.round((newDurationMs / (1000 * 60 * 60)) * 2) / 2);

    const updatedTask = {
      ...originalTask,
      date: newStartMoment.format('YYYY-MM-DD'),
      dailyStartTime: newStartMoment.format('HH:mm'),
      dailyHours: newDailyHours,
    };
    
    const updatedData = roadmapData.map(t => t.id === taskId ? updatedTask : t);
    onTaskUpdate(updatedData);
  };

  const handleItemSelect = (itemId) => {
      const selectedItem = items.find(i => i.id === itemId);
      if (selectedItem && selectedItem.originalTask) {
          setSelectedTask(selectedItem.originalTask);
      }
  };

  const toggleTaskCompletion = (taskId) => {
    if (onTaskUpdate) {
      const updatedData = roadmapData.map(task => 
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      onTaskUpdate(updatedData);
      // Also update the task in the details panel if it's open
      setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, completed: !prev.completed } : prev);
    }
  };

  const labels = data?.roadmapLabels || {};

  return (
    <div className="timeline-chart-container">
        <div className="timeline-header">
            <h2 className="timeline-title">{labels.timelineTitle || 'Project Timeline'}</h2>
            <div className="timeline-controls">
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

      {items.length > 0 ? (
        <div className="chart-wrapper">
          <Timeline
            groups={groups}
            items={items}
            defaultTimeStart={moment().add(-3, 'days')}
            defaultTimeEnd={moment().add(4, 'days')}
            onItemMove={handleItemMove}
            onItemResize={handleItemResize}
            onItemSelect={handleItemSelect}
            onItemDoubleClick={handleItemSelect}
            sidebarWidth={0}
          >
            <TimelineMarkers>
                <TodayMarker />
            </TimelineMarkers>
          </Timeline>
        </div>
      ) : (
        <div className="no-data-message">
          <p>{labels.noTasksMessage || 'No tasks to display. Add some tasks to get started!'}</p>
        </div>
      )}

      {/* --- FIX: The entire Task Details Panel is now inside this conditional block. --- */}
      {/* This prevents errors when `selectedTask` is null. */}
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
          
            {/* --- FIX: The content of the panel is now correctly placed inside it. --- */}
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
                        {selectedTask.completed ? (labels.completedStatus || 'Completed') : (labels.pendingStatus || 'Pending')}
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
                        {selectedTask.completed ? (labels.markIncomplete || 'Mark as Incomplete') : (labels.markComplete || 'Mark as Complete')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- FIX: The summary is now a separate, correctly placed section. --- */}
      <div className="timeline-summary">
        <div className="summary-stats">
            <div className="stat-item">
                <span className="stat-label">{labels.totalTasks || 'Total Tasks'}:</span>
                <span className="stat-value">{roadmapData ? roadmapData.length : 0}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">{labels.completedTasks || 'Completed'}:</span>
                <span className="stat-value">{roadmapData ? roadmapData.filter(task => task.completed).length : 0}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">{labels.totalHours || 'Total Hours'}:</span>
                <span className="stat-value">{roadmapData ? roadmapData.reduce((sum, task) => sum + (task.dailyHours || 1), 0) : 0}h</span>
            </div>
        </div> 
      </div>
    </div>
  );
}

export default CalendarTimeline;