// --- START OF FILE CalendarTimeline.jsx (using react-calendar-timeline) ---

import React, { useState, useContext, useEffect } from 'react';
import Timeline, { TimelineMarkers, TodayMarker } from 'react-calendar-timeline'; // NEW
import moment from 'moment'; // NEW dependency
import { Context } from '../Context';
import './CalendarTimeline.css';

// NEW: Import the library's CSS
import 'react-calendar-timeline/lib/Timeline.css';

const TimelineChart = ({ roadmapData, onTaskUpdate }) => {
  const { data } = useContext(Context);
  const [groups, setGroups] = useState([{ id: 1, title: 'Tasks' }]); // This library requires a 'groups' array
  const [items, setItems] = useState([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  // Convert roadmapData to react-calendar-timeline format
  useEffect(() => {
    if (!roadmapData) return;

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
        group: 1, // All items belong to our single group
        title: task.task,
        start_time: startMoment.valueOf(),
        end_time: endMoment.valueOf(),
        canMove: true,
        canResize: 'both',
        className: task.completed ? 'item-completed-rct' : 'item-pending-rct',
        // We'll store the original task object here to retrieve it on select
        originalTask: task 
      };
    });

    setItems(timelineItems);
  }, [roadmapData, showCompleted]);
  
  // Handler for moving an item
  const handleItemMove = (itemId, dragTime, newGroupOrder) => {
    const originalTask = roadmapData.find(t => t.id === itemId);
    if (!originalTask) return;

    const movedItem = items.find(i => i.id === itemId);
    const duration = movedItem.end_time - movedItem.start_time;
    const newStartTime = moment(dragTime);
    const newEndTime = moment(dragTime + duration);
    
    updateTask(itemId, newStartTime, newEndTime);
  };
  
  // Handler for resizing an item
  const handleItemResize = (itemId, time, edge) => {
    const originalTask = roadmapData.find(t => t.id === itemId);
    if (!originalTask) return;

    const resizedItem = items.find(i => i.id === itemId);
    const newStartTime = edge === 'left' ? moment(time) : moment(resizedItem.start_time);
    const newEndTime = edge === 'right' ? moment(time) : moment(resizedItem.end_time);

    updateTask(itemId, newStartTime, newEndTime);
  };

  // Central update function
  const updateTask = (taskId, newStartMoment, newEndMoment) => {
    const originalTask = roadmapData.find(t => t.id === taskId);
    if (!originalTask) return;

    const newDurationMs = newEndMoment.valueOf() - newStartMoment.valueOf();
    const newDailyHours = Math.max(0.5, Math.round((newDurationMs / (1000 * 60 * 60)) * 2) / 2); // Round to nearest 0.5hr

    const updatedTask = {
      ...originalTask,
      date: newStartMoment.format('YYYY-MM-DD'),
      dailyStartTime: newStartMoment.format('HH:mm'),
      dailyHours: newDailyHours,
    };
    
    const updatedData = roadmapData.map(t => t.id === taskId ? updatedTask : t);
    onTaskUpdate(updatedData);
  };

  const handleItemSelect = (itemId, e, time) => {
      const selectedItem = items.find(i => i.id === itemId);
      if (selectedItem && selectedItem.originalTask) {
          setSelectedTask(selectedItem.originalTask);
      }
  };

  // Toggle task completion (this logic remains the same)
  const toggleTaskCompletion = (taskId) => {
    if (onTaskUpdate) {
      const updatedData = roadmapData.map(task => 
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      onTaskUpdate(updatedData);
      setSelectedTask(prev => prev ? { ...prev, completed: !prev.completed } : null);
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
            defaultTimeEnd={moment().add(3, 'days')}
            onItemMove={handleItemMove}
            onItemResize={handleItemResize}
            onItemSelect={handleItemSelect}
            sidebarWidth={0} // Hide the group sidebar as we don't need it
          >
            <TimelineMarkers>
                <TodayMarker />
            </TimelineMarkers>
          </Timeline>
        </div>
      ) : (
        <div className="no-data-message">
          <p>{labels.noTasksMessage || 'No tasks to display in timeline.'}</p>
        </div>
      )}

      {/* The task details panel and summary remain identical to the previous solution */}
      {selectedTask && (
        <div className="task-details-panel">
            {/* ... same JSX as before ... */}
        </div>
      )}
      <div className="timeline-summary">
        {/* ... same JSX as before ... */}
      </div>
    </div>
  );
};

export default TimelineChart;