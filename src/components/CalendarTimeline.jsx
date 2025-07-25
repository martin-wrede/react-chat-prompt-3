// --- START OF FILE CalendarTimeline.jsx ---

import React, { useState, useContext, useEffect } from 'react';
import Timeline, { TimelineMarkers, TodayMarker } from 'react-calendar-timeline';
import moment from 'moment';
import { Context } from '../Context';
import './CalendarTimeline.css';

const CalendarTimeline = ({ roadmapData, onTaskUpdate }) => {
  const { data } = useContext(Context);
  const [groups, setGroups] = useState([]); 
  const [items, setItems] = useState([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  // Convert roadmapData to react-calendar-timeline format
  useEffect(() => {
    if (!roadmapData || !Array.isArray(roadmapData)) {
      setItems([]);
      setGroups([]);
      return;
    };

    const filteredData = showCompleted 
      ? roadmapData 
      : roadmapData.filter(task => !task.completed);

    // --- NEW: Ensure data is sorted for the look-ahead logic to work correctly ---
    const sortedData = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Dynamically create groups from the now sorted data
    const timelineGroups = sortedData.map(task => ({
      id: task.id,
      title: task.task
    }));
    setGroups(timelineGroups);

    // --- UPDATED: Create items and calculate visual duration ---
    const timelineItems = sortedData.map((task, index, array) => {
      const startMoment = moment(task.date).set({ 
          hour: parseInt((task.dailyStartTime || '10:00').split(':')[0]), 
          minute: parseInt((task.dailyStartTime || '10:00').split(':')[1]) 
      });

      // Default end time is based on the task's own duration.
      let endMoment = startMoment.clone().add(task.dailyHours || 1, 'hours');

      // --- LOGIC REPLICATED FROM TimelineChart.jsx ---
      // Look ahead to the next task to determine if we should extend the visual duration.
      const nextTask = array[index + 1];

      // If there is a next task AND it's on a different day, extend the current task's bar.
      if (nextTask && task.date !== nextTask.date) {
        const nextTaskStartMoment = moment(nextTask.date).set({
            hour: parseInt((nextTask.dailyStartTime || '10:00').split(':')[0]),
            minute: parseInt((nextTask.dailyStartTime || '10:00').split(':')[1])
        });
        
        // Set the visual end time of the current task to be the start time of the next task.
        // We also check that this doesn't accidentally shorten the task.
        if (nextTaskStartMoment.isAfter(endMoment)) {
            endMoment = nextTaskStartMoment;
        }
      }
      // --- END of replicated logic ---

      return {
        id: task.id,
        group: task.id, 
        title: task.task, 
        start_time: startMoment.valueOf(),
        end_time: endMoment.valueOf(), // Use the potentially modified end time
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
            sidebarWidth={300} 
            canMove={false}
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