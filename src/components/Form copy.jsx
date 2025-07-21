// --- START OF FILE Form.jsx ---

import React, { useState, useContext } from "react";
import { Context } from '../Context';

export default function Form({ onPromptChange, onStartDateChange, onWorkDaysChange }) {
  const [age, setAge] = useState(20);
  const [gender, setGender ] = useState("männlich");
  const [country, setCountry] = useState("Deutschland");

  const { data, language } = useContext(Context);

  const [promptInfo, setPromptInfo] = useState({
    problem: "",
    solution: "",
    result: "",
    period: "",
    startDate: "",
    dailyStartTime: "",
    dailyHours: "",
    workDays: [],
    industry: ""
  });

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

    // 1. Get all the data from the form
    const problem = formData.get("problem");
    const solution = formData.get("solution");
    const result = formData.get("result");
    const period = formData.get("period");
    const startDate = formData.get("startDate");
    const dailyStartTime = formData.get("dailyStartTime");
    const dailyHours = formData.get("dailyHours");
    const industry = formData.get("industry");
    
    const workDaysString = workDays.map(dayId =>
      weekDays.find(day => day.id === dayId)?.label
    ).join(', ');

    // 2. Define the new, precise instructions for the AI's output format
    const aiOutputInstructions = `
IMPORTANT: Your response MUST be ONLY a valid JSON array of task objects. Do not add any text, explanations, or markdown before or after the JSON.
Each object in the array represents a single task and must have these exact keys:
- "task": A string describing the task.
- "day_offset": A number representing the project day this task falls on (e.g., 1, 2, 3...). Calculate this based on the user's goal, period, and available work days. Day 1 is the first available work day.
- "dailyHours": A number for the hours required for this task.
- "dailyStartTime": A string for the start time of the task (e.g., "${dailyStartTime}").
- "motivation": A short, motivating sentence for completing the task.

Example JSON output:
\`\`\`json
[
  { "day_offset": 1, "task": "Initial research on competitors", "dailyHours": 4, "dailyStartTime": "${dailyStartTime}", "motivation": "A journey of a thousand miles begins with a single step!" },
  { "day_offset": 2, "task": "Outline value proposition based on research", "dailyHours": 3, "dailyStartTime": "${dailyStartTime}", "motivation": "Clarity is power. Let's define our core message." }
]
\`\`\`
`;

    // 3. Construct the user's context for the AI
    const userContext = data.promptTemplate.problem + problem
      + data.promptTemplate.solution + solution
      + data.promptTemplate.result + result
      + data.promptTemplate.period + period
      + data.promptTemplate.dailyStartTime + dailyStartTime
      + data.promptTemplate.dailyHours + dailyHours
      + data.promptTemplate.workDays + workDaysString
      + data.promptTemplate.industry + industry;
    
    // 4. Combine the role, user context, and output instructions into the final system prompt
    const fullPrompt = (data.aiRolePrompt || "You are a helpful project manager.") + "\n\n" + userContext + "\n\n" + aiOutputInstructions;

    // 5. Update the parent component (App.jsx) with the necessary info.
    onPromptChange(fullPrompt);
    onStartDateChange(startDate);
    onWorkDaysChange(workDays);

    // 6. Set a confirmation message to display locally
    setGeneratedPromptMessage(`✅ System-Prompt wurde generiert. Du kannst jetzt im Chat unten den Plan erstellen lassen (z.B. mit "Erstelle den Plan").`);
  };

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
          <input type="number" name="period" min="1" required />
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

// --- END OF FILE Form.jsx ---