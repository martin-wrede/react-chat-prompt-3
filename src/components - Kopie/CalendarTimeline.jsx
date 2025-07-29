import React, { useState, useContext, useEffect } from 'react';
import Timeline, { TimelineMarkers, TodayMarker } from 'react-calendar-timeline';
import moment from 'moment';
import { Context } from '../Context';
import './CalendarTimeline.css';
import './TimelineChart.css'; // For consistent styling with the other chart

const CalendarTimeline = ({ roadmapData, onTaskUpdate }) => {
  const { data } = useContext(Context);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [processedItemsForSummary, setProcessedItemsForSummary] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);

  // Convert roadmapData to react-calendar-timeline format
  useEffect(() => {
    if (!roadmapData || !Array.isArray(roadmapData)) {
      setItems([]);
      setGroups([]);
      setProcessedItemsForSummary([]); // Clear summary data too
      return;
    }

    // Filter data based on the showCompleted state first
    const filteredData = showCompleted
      ? roadmapData
      : roadmapData.filter(task => !task.completed);

    // Sort the data to ensure correct look-ahead logic for bar length and hour calculation
    const sortedData = [...filteredData].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Create a group for each task, which serves as the sidebar row
    const timelineGroups = sortedData.map(task => ({
      id: task.id,
      title: task.task,
    }));
    setGroups(timelineGroups);

    // Create the timeline items (the bars) from the sorted data
    const timelineItems = sortedData.map((task, index) => {
      const startMoment = moment(task.date).set({
        hour: parseInt((task.dailyStartTime || '10:00').split(':')[0]),
        minute: parseInt((task.dailyStartTime || '10:00').split(':')[1]),
      });

      // Default end time is based on the task's own duration
      let endMoment = startMoment.clone().add(task.dailyHours || 1, 'hours');
      
      const nextTask = sortedData[index + 1];

      // --- Logic for calculating visual length and total hours ---
      let endDateForDayCounting = moment(task.date);
      if (nextTask && task.date !== nextTask.date) {
        // Extend the visual bar to the start of the next task
        const nextTaskStartMoment = moment(nextTask.date).set({
          hour: parseInt((nextTask.dailyStartTime || '10:00').split(':')[0]),
          minute: parseInt((nextTask.dailyStartTime || '10:00').split(':')[1]),
        });
        if (nextTaskStartMoment.isAfter(endMoment)) {
          endMoment = nextTaskStartMoment;
        }
        // For calculation, the duration ends the day before the next task starts
        endDateForDayCounting = moment(nextTask.date).subtract(1, 'day');
      }

      // Calculate the number of days this task's bar represents
      const daysSpanned = Math.max(1, endDateForDayCounting.diff(moment(task.date), 'days') + 1);
      // Calculate the true total hours by multiplying days by daily hours
      const calculatedTotalHours = daysSpanned * (task.dailyHours || 1);
      // --- End of calculation logic ---

      return {
        id: task.id,
        group: task.id,
        title: '', // Keep the bar clean; the label is in the group/sidebar
        start_time: startMoment.valueOf(),
        end_time: endMoment.valueOf(),
        canMove: true,
        canResize: 'both',
        className: task.completed ? 'item-completed-rct' : 'item-pending-rct',
        // Store the original task with the newly calculated hours for the summary
        originalTask: { ...task, calculatedTotalHours },
      };
    });

    setItems(timelineItems);
    // Set the state that the summary will use for its calculation
    setProcessedItemsForSummary(timelineItems);

  }, [roadmapData, showCompleted]); // Re-run effect if data or filter changes

  // Handler for moving an item on the timeline
  const handleItemMove = (itemId, dragTime, newGroupId) => {
    const movedItem = items.find(i => i.id === itemId);
    if (!movedItem) return;

    const duration = movedItem.end_time - movedItem.start_time;
    updateTask(itemId, moment(dragTime), moment(dragTime + duration));
  };

  // Handler for resizing an item on the timeline
  const handleItemResize = (itemId, time, edge) => {
    const resizedItem = items.find(i => i.id === itemId);
    if (!resizedItem) return;

    const newStartTime = edge === 'left' ? moment(time) : moment(resizedItem.start_time);
    const newEndTime = edge === 'right' ? moment(time) : moment(resizedItem.end_time);
    updateTask(itemId, newStartTime, newEndTime);
  };

  // Central function to update a task's properties
  const updateTask = (taskId, newStartMoment, newEndMoment) => {
    const originalTask = roadmapData.find(t => t.id === taskId);
    if (!originalTask) return;

    const newDurationMs = newEndMoment.valueOf() - newStartMoment.valueOf();
    const newDailyHours = Math.max(0.5, Math.round((newDurationMs / (1000 * 60 * 60)) * 2) / 2);
    // --- UPDATED: Calculate new duration in days from the resize/move action ---
    // Use `ceil` to ensure even a small drag into the next day counts as a full day.
    // `true` gives a fractional value for days.
    const newDurationDays = Math.max(1, Math.ceil(newEndMoment.diff(newStartMoment, 'days', true)));


    const updatedTask = {
      ...originalTask,
      date: newStartMoment.format('YYYY-MM-DD'),
      dailyStartTime: newStartMoment.format('HH:mm'),
      dailyHours: newDailyHours,
      durationDays: newDurationDays,
    };


    // here is the old script //
    
    const updatedData = roadmapData.map(t => t.id === taskId ? updatedTask : t);
    onTaskUpdate(updatedData);
  };

  // Handler for selecting an item to show its details
  const handleItemSelect = (itemId) => {
      const selectedItem = items.find(i => i.id === itemId);
      if (selectedItem && selectedItem.originalTask) {
          setSelectedTask(selectedItem.originalTask);
      }
  };

  // Handler for toggling the completion status of a task
  const toggleTaskCompletion = (taskId) => {
    if (onTaskUpdate) {
      const updatedData = roadmapData.map(task => 
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      onTaskUpdate(updatedData);
      // Also update the selected task if it's the one being changed
      setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, completed: !prev.completed } : prev);
    }
  };

  // Get labels from context for internationalization/customization
  const labels = data?.roadmapLabels || {};

  return (
    <div className="timeline-chart-container">
        <div className="timeline-header">
            <h2 className="timeline-title">
              {labels.calendarViewTitle || 'Project Calendar'}
            </h2>
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
            onItemDoubleClick={handleItemSelect} // Allows double-click to select
            sidebarWidth={300} // Ensure the sidebar is visible
            canMove={false} // Prevents vertical reordering of rows
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

      {selectedTask && (
        <div className="task-details-panel">
            {/* This section remains the same as in TimelineChart.jsx */}
            {/* It will display details of the clicked task */}
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
            <span className="stat-value">{processedItemsForSummary.reduce((sum, item) => sum + (item.originalTask.calculatedTotalHours || 0), 0)}h</span>
          </div>7
        </div>
      </div>
    </div>
  );
}

export default CalendarTimeline;