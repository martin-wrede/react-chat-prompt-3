// --- START OF FILE Form.jsx ---

import React, { useState, useContext } from "react";
import { Context } from '../Context';

// 1. Add `onPeriodChange` to the props
export default function Form({ onPromptChange, onStartDateChange, onWorkDaysChange, onPeriodChange }) {
  // ... (no other changes needed at the top)
  const [age, setAge] = useState(20);
  const [gender, setGender ] = useState("männlich");
  const [country, setCountry] = useState("Deutschland");

  const { data, language } = useContext(Context);

  const [generatedPromptMessage, setGeneratedPromptMessage] = useState("");

  const weekDays = [
    { id: 'monday', label: data.workDays?.monday || 'Montag', short: data.workDaysShort?.monday || 'Mo' },
    { id: 'tuesday', label: data.workDays?.tuesday || 'Dienstag', short: data.workDaysShort?.tuesday || 'Di' },
    { id: 'wednesday', label: data.workDays?.wednesday || 'Mittwoch', short: data.workDaysShort?.wednesday || 'Mi' },
    { id: 'thursday', label: data.workDays?.thursday || 'Donnerstag', short: data.workDaysShort?.thursday || 'Do' },
    { id: 'friday', label: data.workDays?.friday || 'Freitag', short: data.workDaysShort?.friday || 'Fr' },
    { id: 'saturday', label: data.workDays?.saturday || 'Samstag', short: data.workDaysShort?.saturday || 'Sa' },
    { id: 'sunday', label: data.workDays?.sunday || 'Sonntag', short: data.workDaysShort?.sunday || 'So' }
  ];

  const [workDays, setWorkDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);

  const handleWorkDayToggle = (dayId) => {
    setWorkDays(prev =>
      prev.includes(dayId)
        ? prev.filter(day => day !== dayId)
        : [...prev, dayId]
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);

    const problem = formData.get("problem");
    const solution = formData.get("solution");
    const result = formData.get("result");
    const period = formData.get("period"); // We get the period here
    const startDate = formData.get("startDate");
    const dailyStartTime = formData.get("dailyStartTime");
    const dailyHours = formData.get("dailyHours");
    const industry = formData.get("industry");
    
    const workDaysString = workDays.map(dayId =>
      weekDays.find(day => day.id === dayId)?.label
    ).join(', ');

    let aiOutputInstructions;
    
    if (language ==="en")  {
       aiOutputInstructions = `
VERY IMPORTANT: Your entire response MUST be ONLY a single, valid JSON array of task objects.
Do NOT add any text, explanations, comments, or markdown like \`\`\`json before or after the JSON array.
The JSON must be perfectly formatted with double quotes for all keys and string values.

Each object in the array represents a single task and must have these exact keys:
- "task": (string) A description of the task.
- "day_offset": (number) The project day this task falls on (e.g., 1, 2, 3...). Day 1 is the first available work day.
- "dailyHours": (number) The hours required for this task.
- "dailyStartTime": (string) The start time of the task (e.g., "10:00").
- "motivation": (string) A short, motivating sentence for completing the task.

Example of a perfect, complete response:
[
  { "day_offset": 1, "task": "Initial research on competitors", "dailyHours": 4, "dailyStartTime": "10:00", "motivation": "A journey of a thousand miles begins with a single step!" },
  { "day_offset": 2, "task": "Outline value proposition based on research", "dailyHours": 3, "dailyStartTime": ""10:00"", "motivation": "Clarity is power. Let's define our core message." }
]
`;
} else {
   aiOutputInstructions = `
SEHR WICHTIG: Deine gesamte Antwort MUSS NUR ein einzelnes, gültiges JSON-Array mit task-Objekten sein.
Füge KEINEN Text, keine Erklärungen, Kommentare oder Markdown wie \`\`\`json vor oder nach dem JSON-Array hinzu.
Das JSON muss perfekt formatiert sein, mit doppelten Anführungszeichen für alle Schlüssel und String-Werte.

Jedes Objekt im Array repräsentiert eine einzelne Aufgabe und muss genau diese Schlüssel enthalten:
- "task": (string) Eine Beschreibung der Aufgabe.
- "day_offset": (number) Der Projekttag, an dem diese Aufgabe stattfindet (z. B. 1, 2, 3…). Tag 1 ist der erste verfügbare Arbeitstag.
- "dailyHours": (number) Die für diese Aufgabe benötigten Stunden.
- "dailyStartTime": (string) Die Startzeit der Aufgabe (z. B. "10:00").
- "motivation": (string) Ein kurzer, motivierender Satz zur Erledigung der Aufgabe.

Beispiel für eine perfekte, vollständige Antwort:
[
  { "day_offset": 1, "task": "Erste Recherche zu Mitbewerbern", "dailyHours": 4, "dailyStartTime": "10:00", "motivation": "Auch die längste Reise beginnt mit dem ersten Schritt!" },
  { "day_offset": 2, "task": "Wertversprechen basierend auf der Recherche skizzieren", "dailyHours": 3, "dailyStartTime": "10:00", "motivation": "Klarheit ist Macht. Definieren wir unsere Kernbotschaft." }
]
`;

}







    const userContext = data.promptTemplate.problem + problem
      + data.promptTemplate.solution + solution
      + data.promptTemplate.result + result
      + data.promptTemplate.period + period
      + data.promptTemplate.dailyStartTime + dailyStartTime
      + data.promptTemplate.dailyHours + dailyHours
      + data.promptTemplate.workDays + workDaysString
      + data.promptTemplate.industry + industry;
    
    const fullPrompt = (data.aiRolePrompt || "You are a helpful project manager.") + "\n\n" + userContext + "\n\n" + aiOutputInstructions;

    // 2. Pass the period (duration in weeks) up to App.jsx
    onPromptChange(fullPrompt);
    onStartDateChange(startDate);
    onWorkDaysChange(workDays);
    onPeriodChange(period); // <<< ADD THIS LINE

    setGeneratedPromptMessage(
      language === "en" ?
        `✅ System prompt has been generated. You can now create the plan in the chat below (e.g. with “Create the plan”).` 
    :
          `✅ System-Prompt wurde generiert. Du kannst jetzt im Chat unten den Plan erstellen lassen (z.B. mit "Erstelle den Plan").`
 
    );
  };

  // --- No other changes are needed in the JSX return part ---
  return (
    <div>
      {data.personalDataLabel}
      <br /><br />

      <form onSubmit={handleSubmit}>
        {data.ageLabel}
        <br />
        <input
          type="text"
          name="age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        <br /><br />

        {data.genderLabel}
        <br />
        <input
          type="text"
          name="gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
        />
        <br /><br />

        {data.countryLabel}
        <br />
        <input
          type="text"
          name="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <br /><br /><br />

        <label>
          <b>{data.question1}</b><br />
          <input type="text" name="problem" required />
        </label>
        <br /><br />

        <label>
          <b>{data.question2}</b><br />
          <input type="text" name="solution" required />
        </label>
        <br /><br />

        <label>
          <b>{data.question3}</b><br />
          <input type="number" name="period" min="1" defaultValue="4" required />
        </label>
        <br /><br />

        <label>
          <b>{data.question4}</b><br />
          <em>{data.question4Hint}</em><br />
          <input type="text" name="result" required />
        </label>
        <br /><br />

        <label>
          <b>{data.question5}</b><br />
          <em>{data.question5Hint}</em><br />
          <input type="date" name="startDate" defaultValue={new Date().toISOString().split('T')[0]} required />
        </label>
        <br /><br />

        <label>
          <b>{data.question6}</b><br />
          <em>{data.question6Hint}</em><br />
          <input type="time" name="dailyStartTime" defaultValue="09:00" required />
        </label>
        <br /><br />

        <label>
          <b>{data.question7}</b><br />
          <input type="number" name="dailyHours" min="1" max="12" defaultValue="4" required />
        </label>
        <br /><br />

        <label>
          <b>{data.question8}</b><br />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
            {weekDays.map(day => (
              <label key={day.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workDays.includes(day.id)}
                  onChange={() => handleWorkDayToggle(day.id)}
                  style={{ marginRight: '5px' }}
                />
                <span>{day.short}</span>
              </label>
            ))}
          </div>
          <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
            {data.workDaysSelected || 'Selected'}: {workDays.length} {workDays.length === 1 ? (data.workDaysSingular || 'Tag') : (data.workDaysPlural || 'Tage')}
          </small>
        </label>
        <br /><br />

        <label>
          <b>{data.question9}</b><br />
          <em>{data.question9Hint}</em><br />
          <input type="text" name="industry" required />
        </label>
        <br /><br />

        <br />
        <button className="button" type="submit">
          {data.submitButton}
        </button>
      </form>

      <br />
      {generatedPromptMessage && (
        <div style={{ marginTop: "2rem", whiteSpace: "pre-wrap", border: "1px solid #4CAF50", padding: "1rem", borderRadius: "8px", background: "#f0fff4", color: "#2E7D32" }}>
          {generatedPromptMessage}
        </div>
      )}
    </div>
  );
}