// --- START OF FILE CalendarTimeline.jsx ---

import React, { useState, useContext, useEffect } from 'react';
import Timeline, { TimelineMarkers, TodayMarker } from 'react-calendar-timeline';
import moment from 'moment';
import { Context } from '../Context';
import './CalendarTimeline.css';

const CalendarTimeline = ({ roadmapData, onTaskUpdate }) => {
  const { data } = useContext(Context);
  // The 'groups' state will now be dynamically populated
  const [groups, setGroups] = useState([]); 
  const [items, setItems] = useState([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  // Convert roadmapData to react-calendar-timeline format
  useEffect(() => {
    if (!roadmapData || !Array.isArray(roadmapData)) {
      setItems([]);
      setGroups([]); // Also clear groups
      return;
    };

    const filteredData = showCompleted 
      ? roadmapData 
      : roadmapData.filter(task => !task.completed);

    // --- 1. DYNAMICALLY CREATE GROUPS ---
    // Create a unique group for each task. The task's name will be the row label.
    const timelineGroups = filteredData.map(task => ({
      id: task.id,
      title: task.task
    }));
    setGroups(timelineGroups);

    // --- 2. CREATE ITEMS AND ASSIGN THEM TO THEIR GROUP ---
    const timelineItems = filteredData.map(task => {
      const startMoment = moment(task.date).set({ 
          hour: parseInt((task.dailyStartTime || '10:00').split(':')[0]), 
          minute: parseInt((task.dailyStartTime || '10:00').split(':')[1]) 
      });
      const endMoment = startMoment.clone().add(task.dailyHours || 1, 'hours');

      return {
        id: task.id,
        // --- This is the key change: assign the item to its own group ---
        group: task.id, 
        title: task.task, // The title is still useful for tooltips
        start_time: startMoment.valueOf(),
        end_time: endMoment.valueOf(),
        canMove: true,
        canResize: 'both',
        className: task.completed ? 'item-completed-rct' : 'item-pending-rct',
        originalTask: task 
      };
    });

    setItems(timelineItems);
  }, [roadmapData, showCompleted]);
  
  // Handler for moving an item
  const handleItemMove = (itemId, dragTime, newGroupId) => {
    // In our setup, moving between groups (newGroupId) changes the task order,
    // which we don't handle here, but we can update the time.
    const movedItem = items.find(i => i.id === itemId);
    if (!movedItem) return;

    const duration = movedItem.end_time - movedItem.start_time;
    updateTask(itemId, moment(dragTime), moment(dragTime + duration));
  };
  
  // Handler for resizing an item (logic remains the same)
  const handleItemResize = (itemId, time, edge) => {
    const resizedItem = items.find(i => i.id === itemId);
    if (!resizedItem) return;

    const newStartTime = edge === 'left' ? moment(time) : moment(resizedItem.start_time);
    const newEndTime = edge === 'right' ? moment(time) : moment(resizedItem.end_time);
    updateTask(itemId, newStartTime, newEndTime);
  };

  // Central update function (logic remains the same)
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

  // Selection and completion logic remains the same
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
      setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, completed: !prev.completed } : prev);
    }
  };

  const labels = data?.roadmapLabels || {};

  return (
    <div className="timeline-chart-container">
        <div className="timeline-header">
            {/* Header remains the same */}
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
            // --- 3. ENABLE THE SIDEBAR TO SHOW THE GROUP TITLES ---
            sidebarWidth={300} // Set a width to make the sidebar visible
            canMove={false} // Prevents vertical reordering of rows by dragging
          >
            <TimelineMarkers>
                <TodayMarker />
            </TimelineMarkers>
          </Timeline>
        </div>
      ) : (
        <div className="no-data-message">
            {/* No data message remains the same */}
        </div>
      )}

      {selectedTask && (
        <div className="task-details-panel">
            {/* Task Details Panel remains the same */}
        </div>
      )}

      <div className="timeline-summary">
        {/* Summary remains the same */}
      </div>
    </div>
  );
}

export default CalendarTimeline;