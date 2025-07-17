// --- START OF FILE App.jsx ---

import React, { useState, useEffect, useContext } from 'react';
 
import Form from './components/Form';
import RoadmapEdit from './components/RoadmapEdit';
import ChatInterface from './components/ChatInterface';
import TimelineChart from './components/TimelineChart';
import { Context } from './Context';
import * as fileUtils from './utils/fileUtils';
import './App.css';

// This function remains the same
const calculateDateFromOffset = (startDateString, dayOffset, workDays) => {
  // ... (no changes here)
    if (!startDateString || workDays.length === 0) {
      console.warn("calculateDateFromOffset called with invalid inputs. Falling back to today's date.");
      return new Date().toISOString().split('T')[0];
  }

  const workDayNumbers = workDays.map(day => {
    const map = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
    return map[day];
  });

  let currentDate = new Date(startDateString);
  currentDate.setHours(12, 0, 0, 0); 
  let daysCounted = 0;
  let safetyNet = 0; 
  
  while (daysCounted < dayOffset && safetyNet < 3650) {
    if (workDayNumbers.includes(currentDate.getDay())) {
      daysCounted++;
    }
    if (daysCounted < dayOffset) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    safetyNet++;
  }
  return currentDate.toISOString().split('T')[0];
};

/**
 * NEW FUNCTION: Rescales task day_offsets to fit a target duration.
 * Takes the AI's plan and stretches/compresses it evenly.
 * @param {Array} tasks - The array of task objects from the AI.
 * @param {number} targetTotalWorkDays - The total number of work days the plan should cover.
 * @returns {Array} The tasks with their day_offset values recalculated.
 */
const rescaleTaskOffsets = (tasks, targetTotalWorkDays) => {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Find the duration of the AI's plan
  const offsets = tasks.map(t => t.day_offset);
  const minAiDay = Math.min(...offsets);
  const maxAiDay = Math.max(...offsets);
  const aiPlanDuration = maxAiDay - minAiDay + 1;

  // If AI plan is already longer or there's nothing to scale, return as is
  if (aiPlanDuration >= targetTotalWorkDays || aiPlanDuration <= 1) {
    return tasks;
  }
  
  // Apply a linear mapping to stretch the offsets
  const rescaledTasks = tasks.map(task => {
    // How far through the AI plan is this task (from 0.0 to 1.0)?
    const relativePosition = (task.day_offset - minAiDay) / (aiPlanDuration - 1);
    
    // Map that relative position onto the new, longer timeline
    const newOffset = 1 + Math.round(relativePosition * (targetTotalWorkDays - 1));
    
    return { ...task, day_offset: newOffset };
  });

  return rescaledTasks;
};


function App() {
  const { data } = useContext(Context);

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] =useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [gesamtPrompt, setGesamtPrompt] = useState("");
  const [roadmapData, setRoadmapData] = useState([]);
  const [roadmapToday, setRoadmapToday] = useState([]);
  const [roadmapContext, setRoadmapContext] = useState('');
  
  const [projectStartDate, setProjectStartDate] = useState('');
  const [workDays, setWorkDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  // 1. Add state for the project period (in weeks)
  const [projectPeriod, setProjectPeriod] = useState(4); // Default to 4 weeks

  // ... (params and today variables are fine)
  const params = new URLSearchParams(location.search);
  const part1 = params.get('part1');
  const part2 = params.get('part2');
  const part3 = params.get('part3');
  const part4 = params.get('part4');
  
  const today = new Date().toISOString().split('T')[0];


  useEffect(() => {
    const contextString = `Current Project Plan (as JSON):\n${JSON.stringify(roadmapData, null, 2)}`;
    setRoadmapContext(contextString);
  }, [roadmapData]);

  useEffect(() => {
    const todayTasks = roadmapData.filter(item => item.date === today);
    setRoadmapToday(todayTasks);
  }, [roadmapData, today]);

  const handleRoadmapUpdate = (updatedData) => {
    updatedData.sort((a, b) => new Date(a.date) - new Date(b.date));
    setRoadmapData(updatedData);
  };

  // 2. Modify processAIResponse to use the new rescaling logic
  const processAIResponse = (content) => {
    const defaultMotivation = data?.chat_defaultMotivation || 'Erreiche dein Ziel!';
    const icsContents = fileUtils.extractIcsContent(content);
    const jsonContents = fileUtils.extractJsonContent(content);
    
    let allNewEvents = [];
    
    if (jsonContents.length > 0) {
      jsonContents.forEach(jsonString => {
         try {
            let tasksWithOffsets = JSON.parse(jsonString);

            if (Array.isArray(tasksWithOffsets)) {
              // --- THIS IS THE NEW LOGIC ---
              // Calculate the total number of work days the user wants the project to span
              const targetTotalWorkDays = projectPeriod * workDays.length;
              
              // Rescale the AI's plan to fit the user's desired duration
              const rescaledTasks = rescaleTaskOffsets(tasksWithOffsets, targetTotalWorkDays);
              // --- END OF NEW LOGIC ---

              const newEvents = rescaledTasks.map(task => ({
                task: task.task,
                dailyHours: task.dailyHours || 1,
                // Use the new, rescaled day_offset to calculate the date
                date: calculateDateFromOffset(projectStartDate, task.day_offset, workDays), 
                dailyStartTime: task.dailyStartTime || '10:00',
                motivation: task.motivation || defaultMotivation, 
              }));
              allNewEvents.push(...newEvents);
            }
          } catch (e) {
            console.error("Failed to parse AI JSON response:", e);
            setMessages(prev => [...prev, { role: 'system', content: `Error: The AI's response was not in the expected format and could not be imported. Please try again. Details: ${e.message}` }]);
          }
      });
    } else if (icsContents.length > 0) {
      icsContents.forEach(ics => {
        allNewEvents.push(...fileUtils.parseIcsToRoadmapData(ics, defaultMotivation));
      });
    }

    if (allNewEvents.length > 0) {
      allNewEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
      setRoadmapData(allNewEvents);
      setTimeout(() => {
        const successMessage = (data?.chat_autoImportSuccess || 'Automatisch {count} Termine importiert!').replace('{count}', allNewEvents.length);
        setMessages(prev => [...prev, { role: 'system', content: successMessage }]);
      }, 500);
    }

    const icsDownloadLinks = icsContents.map((ics, i) => fileUtils.createIcsDownloadLink(ics, `kalender-${i+1}.ics`));
    const jsonDownloadLinks = jsonContents.map((json, i) => fileUtils.createJsonDownloadLink(json, `roadmap-${i+1}.json`));
    
    return {
      content: content.replace(/```json\n?([\s\S]*?)```/g, "✅ Plan successfully imported! See the updated roadmap and timeline below."),
      downloadLinks: [...jsonDownloadLinks, ...icsDownloadLinks],
      importedEvents: allNewEvents.length,
    };
  };

  // ... (handleFileUpload, sendMessage, deleteFile are unchanged) ...
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    for (const file of files) {
      try {
        const content = await file.text();
        let fileType = 'text';
        let parsedEvents = [];
        const defaultMotivation = data?.chat_defaultMotivation || 'Erreiche dein Ziel!';

        if (file.name.endsWith('.ics')) {
          fileType = 'calendar';
          parsedEvents = fileUtils.parseIcsToRoadmapData(content, defaultMotivation);
        } else if (file.name.endsWith('.json')) {
          fileType = 'json';
          parsedEvents = fileUtils.parseJsonToRoadmapData(content, defaultMotivation);
        }

        if (parsedEvents.length > 0) {
          setRoadmapData(parsedEvents);
        }

        setUploadedFiles(prev => [...prev, {
          id: Date.now() + Math.random(), name: file.name, content, type: fileType, size: file.size
        }]);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
    event.target.value = '';
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() && uploadedFiles.length === 0) return;

    const fileContext = uploadedFiles.map(f => `[Datei: ${f.name}]\n${f.content}`).join('\n\n---\n\n');
    const messageContent = `${inputMessage}\n\n${fileContext}`.trim();
    const userMessage = { role: 'user', content: messageContent };
    
    const conversationHistory = [...messages]; 

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          messages: conversationHistory,
          files: uploadedFiles,
          prompt: gesamtPrompt,
          roadmap: roadmapContext,
        }),
      });
      
       if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      const aiContent = responseData.choices?.[0]?.message?.content || 'Fehler: Keine Antwort erhalten.';
      
      const processed = processAIResponse(aiContent);
      const assistantMessage = { role: 'assistant', ...processed };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Fehler bei der Verarbeitung Ihrer Anfrage. Details: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };


  return (
    <div className="app-container">
      <div id="part1" style={{ display: part1 }}>
        <h2>{data?.app_Headline1}</h2>
        <div id="form-all-id">
          {/* 3. Pass the new setter to the Form component */}
          <Form 
            onPromptChange={setGesamtPrompt} 
            onStartDateChange={setProjectStartDate}
            onWorkDaysChange={setWorkDays}
            onPeriodChange={setProjectPeriod} 
          />
        </div>
        {gesamtPrompt && (
          <div className="active-prompt-display">
            <strong>{data?.chat_activePromptLabel || 'Aktiver Prompt'}:</strong> Ready to generate plan.
          </div>
        )}
        
        <ChatInterface
            data={data}
            messages={messages}
            isLoading={isLoading}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            uploadedFiles={uploadedFiles}
            handleFileUpload={handleFileUpload}
            deleteFile={deleteFile}
            sendMessage={sendMessage}
        />
      </div>

      <div id="part2" style={{ display: part2 }}>
        {roadmapToday.length > 0 ? (
          <RoadmapEdit titleDisplay2='block' titleDisplay3='none' roadmapData={roadmapToday} isToday={true} />
        ) : (
          <div className="info-box">
            {(data?.chat_noTasksToday || 'No Tasks for today! ({today})').replace('{today}', today)}
          </div>
        )}
      </div>

      <div id="part3" style={{ display: part3 }}>
        <h2>{data?.app_Headline3}</h2>
        <p className="info-box">
          <strong>ℹ️ {data?.chat_infoLabel || 'Info'}:</strong>
          {' '}
          {(data?.chat_roadmapInfo || 'Der Projektplan wird automatisch aktualisiert, wenn die KI Kalenderdaten erstellt. Aktuell werden {count} Termine angezeigt.').replace('{count}', roadmapData.length)}
        </p>
        <RoadmapEdit
          roadmapData={roadmapData}
          onRoadmapUpdate={handleRoadmapUpdate}
          titleDisplay2='none'
          titleDisplay3='block'
        />
      </div>
     
      <div id="part4" style={{ display: "block" }}>
        <TimelineChart 
          roadmapData={roadmapData} 
          onTaskUpdate={handleRoadmapUpdate} 
        />
      </div>

    </div>
  );
}

export default App;