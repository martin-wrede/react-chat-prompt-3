
// Helper for calculating offset
export const calculateDateFromOffset = (startDateString, dayOffset) => {
  const startDate = new Date(startDateString);
  // Day offsets are usually 1-based, so subtract 1 for date math
  startDate.setDate(startDate.getDate() + dayOffset - 1); 
  return startDate.toISOString().split('T')[0];
};


// Helper to format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- JSON Parsing Logic ---

export const parseJsonToRoadmapData = (jsonContent, defaultMotivation) => {
  try {
    let parsedData = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    if (!Array.isArray(parsedData)) parsedData = [parsedData];
    
    const validatedData = parsedData.map(item => {
      if (!item.date || !item.task) return null;
      return {
        date: item.date,
        task: item.task,
        dailyStartTime: item.dailyStartTime || '09:00',
        dailyHours: item.dailyHours || 2,
        motivation: item.motivation || defaultMotivation || 'Erreiche dein Ziel!'
      };
    }).filter(Boolean);
    
    validatedData.sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log(`Successfully parsed ${validatedData.length} tasks from JSON`);
    return validatedData;
  } catch (error) {
    console.error('Error parsing JSON content:', error);
    return [];
  }
};

export const extractJsonContent = (text) => {
  const jsonContents = [];
  const jsonCodeBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = jsonCodeBlockRegex.exec(text)) !== null) {
    jsonContents.push(match[1]);
  }
  const jsonObjectRegex = /(\[[\s\S]*?\]|\{[\s\S]*?\})/g;
  const potentialJsonMatches = text.match(jsonObjectRegex);
  if (potentialJsonMatches) {
    potentialJsonMatches.forEach(potentialJson => {
      try {
        JSON.parse(potentialJson);
        if (!jsonContents.some(existing => existing.includes(potentialJson.trim()))) {
          jsonContents.push(potentialJson);
        }
      } catch (e) { /* Not valid JSON, ignore */ }
    });
  }
  return jsonContents;
};

export const createJsonDownloadLink = (jsonContent, filename = 'roadmap.json') => {
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return {
    url, filename,
    download: () => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };
};

// --- ICS Parsing Logic ---

export const parseIcsToRoadmapData = (icsContent, defaultMotivation) => {
    try {
        const events = [];
        const eventBlocks = icsContent.split('BEGIN:VEVENT');
        eventBlocks.slice(1).forEach(block => {
            const lines = block.split('\n').map(line => line.trim());
            const event = {};
            lines.forEach(line => {
                if (line.startsWith('SUMMARY:')) {
                    let task = line.replace('SUMMARY:', '').trim();
                    if (task.startsWith('AI Coach:')) task = task.replace('AI Coach:', '').trim();
                    event.task = task;
                }
                if (line.startsWith('DTSTART')) {
                    let dateTimeStr = line.substring(line.lastIndexOf(':') + 1).replace('Z', '');
                    const match = dateTimeStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
                    if (match) {
                        event.date = `${match[1]}-${match[2]}-${match[3]}`;
                        event.dailyStartTime = `${match[4]}:${match[5]}`;
                    }
                }
                if (line.startsWith('DESCRIPTION:')) {
                    const desc = line.replace('DESCRIPTION:', '').trim();
                    const motivationMatch = desc.match(/Motivation:\s*(.+?)(?:\\n|$)/i);
                    event.motivation = motivationMatch ? motivationMatch[1].trim() : (defaultMotivation || 'Stay focused!');
                }
                if (line.startsWith('DURATION:PT')) {
                    const durationStr = line.replace('DURATION:PT', '').trim();
                    if (durationStr.includes('H')) event.dailyHours = parseInt(durationStr) || 1;
                    else if (durationStr.includes('M')) event.dailyHours = Math.max(1, Math.round(parseInt(durationStr) / 60));
                }
            });
            if (event.task && event.date) {
                events.push({
                    dailyStartTime: '09:00',
                    dailyHours: 2,
                    motivation: defaultMotivation || 'Keep pushing!',
                    ...event
                });
            }
        });
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
        return events;
    } catch (error) {
        console.error('Error parsing ICS content:', error);
        return [];
    }
};

const formatIcsDateForDisplay = (icsDate) => {
    if (!icsDate) return 'Unbekannt';
    const y = icsDate.substring(0, 4), m = icsDate.substring(4, 6), d = icsDate.substring(6, 8);
    const h = icsDate.substring(9, 11), min = icsDate.substring(11, 13);
    return `${d}.${m}.${y} ${h}:${min}`;
};

export const parseIcsContentForDisplay = (icsText, data) => {
    const events = [];
    icsText.split('BEGIN:VEVENT').slice(1).forEach(block => {
        const event = {};
        block.split('\n').forEach(line => {
            if (line.startsWith('SUMMARY:')) event.summary = line.replace('SUMMARY:', '').trim();
            if (line.startsWith('DTSTART:')) event.start = line.replace('DTSTART:', '').trim();
        });
        if (event.summary) events.push(event);
    });
    if (events.length > 0) {
        const calendarText = data?.chat_icsCalendarWith || 'ICS-Kalender mit';
        const appointmentsText = data?.chat_appointments || 'Terminen';
        return `${calendarText} ${events.length} ${appointmentsText}:\n\n` +
               events.map(e => `- ${e.summary} (${formatIcsDateForDisplay(e.start)})`).join('\n');
    }
    return icsText;
};


export const extractIcsContent = (text) => {
    const icsRegex = /```ics\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;
    while ((match = icsRegex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
};

export const createIcsDownloadLink = (icsContent, filename = 'calendar.ics') => {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return {
      url, filename,
      download: () => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    };
};