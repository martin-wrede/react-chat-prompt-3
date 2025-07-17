// --- App.jsx (Corrected) ---
import React, { useState, useEffect, useContext } from 'react';
 
import Form from './components/Form';
import RoadmapEdit from './components/RoadmapEdit';
import ChatInterface from './components/ChatInterface';
import TimelineChart from './components/TimelineChart';
import { Context } from './Context';
import * as fileUtils from './utils/fileUtils';
import './App.css';

const initialRoadmapData2 = [
  { date: '2025-07-08', task: 'Schreibe Value Proposition: was bekommt der Users?', dailyStartTime: '10:00', dailyHours: 6, motivation: 'Drinks mit Kollegen' },
  { date: '2025-06-18', task: 'Recherchiere 3 Landing Pages und schreib auf, was funktioniert.', dailyStartTime: '10:00', dailyHours: 6, motivation: 'Freunde anrufen' }
];

const initialRoadmapData = [];
 

/**
 * Calculates a future date based on a start date and a number of working days to offset.
 * @param {string} startDateString - The start date in 'YYYY-MM-DD' format.
 * @param {number} dayOffset - The number of working days to count forward (e.g., 5 means the 5th working day).
 * @param {string[]} workDays - An array of weekday names in English (e.g., ['monday', 'tuesday']).
 * @returns {string} The calculated date in 'YYYY-MM-DD' format.
 */
const calculateDateFromOffset = (startDateString, dayOffset, workDays) => {
  // --- FIX START: Add a guard clause to prevent RangeError ---
  // If the start date is not yet provided or no work days are selected, we can't calculate.
  // Return today's date as a safe fallback to prevent the app from crashing.
  if (!startDateString || workDays.length === 0) {
      console.warn("calculateDateFromOffset called with invalid inputs. Falling back to today's date.");
      return new Date().toISOString().split('T')[0];
  }
  // --- FIX END ---
 
  // Map string names to JavaScript's day numbers (Sun=0, Mon=1, Tue=2, etc.)
  const workDayNumbers = workDays.map(day => {
    const map = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
    return map[day];
  });

  if (workDayNumbers.length === 0) {
      // Avoid infinite loops if no work days are selected
      return new Date().toISOString().split('T')[0];
  }

  let currentDate = new Date(startDateString);
  let daysCounted = 0;
  let safetyNet = 0; // To prevent infinite loops in case of logic error

  // Loop until we have found the target number of work days
  while (daysCounted < dayOffset && safetyNet < 3650) {
    if (daysCounted > 0 || !workDayNumbers.includes(currentDate.getDay())) {
       // Only advance the date if it's not the very first day OR if the start date itself is not a workday
       currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Check if the new current day is a workday
    if (workDayNumbers.includes(currentDate.getDay())) {
      daysCounted++;
    }
    safetyNet++;
  }
  return currentDate.toISOString().split('T')[0];
};
// --- CHANGE END ---


function App() {
  const { data } = useContext(Context);

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [gesamtPrompt, setGesamtPrompt] = useState("");
  const [roadmapData, setRoadmapData] = useState(initialRoadmapData);
  const [roadmapToday, setRoadmapToday] = useState([]);
  const [roadmapContext, setRoadmapContext] = useState('');
  
  // --- CHANGE START: Add state for start date and work days ---
  const [projectStartDate, setProjectStartDate] = useState('');
  const [workDays, setWorkDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  // --- CHANGE END ---

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

  // --- CHANGE START: Update processAIResponse to use the new logic ---
  const processAIResponse = (content) => {
    const defaultMotivation = data?.chat_defaultMotivation || 'Erreiche dein Ziel!';
    const icsContents = fileUtils.extractIcsContent(content);
    const jsonContents = fileUtils.extractJsonContent(content);
    
    let allNewEvents = [];
    
    if (jsonContents.length > 0) {
      jsonContents.forEach(jsonString => {
         try {
            const tasksWithOffsets = JSON.parse(jsonString);
            if (Array.isArray(tasksWithOffsets)) {
              const newEvents = tasksWithOffsets.map(task => ({
                // The AI gives us task, day_offset, dailyHours
                task: task.task,
                dailyHours: task.dailyHours || 1,
                // We calculate the real date using our robust function
                date: calculateDateFromOffset(projectStartDate, task.day_offset, workDays), 
                // We fill in the rest
                dailyStartTime: task.dailyStartTime || '10:00',
                motivation: task.motivation || defaultMotivation, 
              }));
              allNewEvents.push(...newEvents);
            }
          } catch (e) {
            console.error("Failed to parse AI JSON response:", e);
            // Optionally, inform the user about the parsing error
          }
      });
    } else if (icsContents.length > 0) {
      // Fallback for old ICS logic
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
      content: content.replace(/```json\n?([\s\S]*?)```/, "✅ Plan successfully imported! See the updated roadmap below."),
      downloadLinks: [...jsonDownloadLinks, ...icsDownloadLinks],
      importedEvents: allNewEvents.length,
    };
  };
  // --- CHANGE END ---

  
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
          {/* --- CHANGE START: Pass the new setters to the Form --- */}
          <Form 
            onPromptChange={setGesamtPrompt} 
            onStartDateChange={setProjectStartDate}
            onWorkDaysChange={setWorkDays}
          />
          {/* --- CHANGE END --- */}
        </div>
        {gesamtPrompt && (
          <div className="active-prompt-display">
            <strong>{data?.chat_activePromptLabel || 'Aktiver Prompt'}:</strong> {gesamtPrompt.substring(0, 200)}...
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
{gesamtPrompt}
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