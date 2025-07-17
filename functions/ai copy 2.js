// functions/ai.js

/**
 * Handles CORS pre-flight requests for the /ai endpoint.
 * This is now a separate function for clarity and best practice.
 */
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * Handles POST requests to the /ai endpoint.
 * It now accepts a 'roadmap' string in the body to provide the AI
 * with the most current state of the user's project plan.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Parse the JSON body from the request.
    const body = await request.json();

    // Destructure all expected fields from the frontend payload, including the new 'roadmap' context.
    const {
      message,
      messages = [],
      files = [],
      prompt, // The main instruction prompt from the Form component
      roadmap // The JSON string of the current roadmap state
    } = body;

    // Validate that the main message content exists.
    if (!message) {
      return new Response(JSON.stringify({ error: "Missing 'message' field in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Start with the base system prompt, either from the user's form or a default.
    let systemPrompt = prompt || "Du bist ein hilfsreicher AI-Assistent. Antworte höflich und informativ auf Deutsch.";

    // --- INJECT THE ROADMAP CONTEXT INTO THE SYSTEM PROMPT ---
    // If the roadmap data was sent, add it as a high-priority context for the AI.
    if (roadmap) {
      systemPrompt += `\n\nWICHTIGER KONTEXT: Dies ist der aktuelle Projektplan des Benutzers. Behandle diese Information als die einzige Quelle der Wahrheit für alle Aufgaben, Daten und Termine. Antworte auf Fragen basierend auf diesen Daten.\n\n${roadmap}`;
    }
    // --- END OF INJECTION ---

    // Append information about uploaded files, if they exist.
    if (files && files.length > 0) {
      systemPrompt += `\n\nZUSÄTZLICHER KONTEXT: Der Benutzer hat auch ${files.length} Datei(en) hochgeladen. Diese sind im Nachrichteninhalt zu finden. Beziehe dich bei Bedarf auch auf diese.`;
    }

    // Assemble the final message payload for the OpenAI API.
    // The order is critical: System -> History -> New User Message
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages, // The existing conversation history
      { role: "user", content: message } // The new message from the user
    ];

    // Make the API call to OpenAI.
    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.VITE_APP_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4-1106-preview", // Or your preferred model
        messages: chatMessages,
        max_tokens: files.length > 0 || (roadmap && roadmap.length > 200) ? 2500 : 1500, // Increase tokens if context is large
        temperature: 0.7,
      }),
    });

    // Handle potential errors from the OpenAI API.
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      // Handle context length error gracefully by sending a user-friendly message.
      if (errorText.includes("context_length_exceeded")) {
        const errorMsg = "Entschuldigung, die Konversation oder die hochgeladenen Dateien sind zu groß. Bitte kürzen Sie Ihre Eingabe oder starten Sie ein neues Gespräch.";
        const errorResponse = { choices: [{ message: { content: errorMsg } }] };
        return new Response(JSON.stringify(errorResponse), {
            status: 200, // Send 200 so the frontend can display the custom message
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      // For any other OpenAI error, throw it to the main catch block.
      throw new Error(`OpenAI API Error: ${apiResponse.status} - ${errorText}`);
    }

    // Parse the successful response from OpenAI.
    const data = await apiResponse.json();
    
    {/**
    // The Airtable logic can remain here if you are using it.
    try {
      await saveToAirtable(env, message, data.choices?.[0]?.message?.content, files, roadmap);
     } catch (airtableError) {
      console.error("Airtable save failed:", airtableError);
   }
   */}

    // ✅ Save to Airtable DIRECTLY (no HTTP calls)
    try {
      await saveToAirtable(env, message, botAnswer, files, parsedBody.fileAttachments);
      console.log("Successfully saved to Airtable with bot answer");
    } catch (airtableError) {
      console.error("Airtable save failed:", airtableError);
      // Continue with AI response even if Airtable fails
    }

    // Return the successful response to the frontend.
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Error in AI function:", error);
    // Create a fallback error message to send to the user.
    const fallbackMsg = {
      choices: [{
        message: { content: "Entschuldigung, es gab einen technischen Fehler. Bitte versuchen Sie es erneut." }
      }]
    };

    // If the error is from invalid JSON from the client, send a 400 status. Otherwise, 500.
    const status = error instanceof SyntaxError ? 400 : 500;
    
    return new Response(JSON.stringify(fallbackMsg), {
      status: status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }


  // ✅ DIRECT Airtable Integration with File Attachments support
async function saveToAirtable(env, originalMessage, botAnswer, files, fileAttachments = []) {
  const AIRTABLE_API_KEY = env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = env.AIRTABLE_TABLE_NAME || "Prompts";

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error("Missing Airtable credentials");
  }

  // Extract just the user's original prompt (without file content)
  let userPrompt = originalMessage;
  
  // If message contains file context, extract only the original prompt
  if (originalMessage.includes("[Uploaded Files Context:]")) {
    userPrompt = originalMessage.split("\n\n[Uploaded Files Context:]")[0];
  }

  // Clean up bot answer - remove any potential formatting issues
  const cleanBotAnswer = botAnswer.replace(/\n\s*\n/g, '\n').trim();

  // Prepare file attachments for Airtable
  let airtableAttachments = [];
  
  if (fileAttachments && fileAttachments.length > 0) {
    console.log("Processing file attachments:", fileAttachments.length);
    
    for (const file of fileAttachments) {
      try {
        // Create a data URL for the file content
        const base64Content = btoa(file.content);
        const dataUrl = `data:${file.type || 'text/plain'};base64,${base64Content}`;
        
        // Airtable attachment format
        const attachment = {
          filename: file.name,
          url: dataUrl
        };
        
        airtableAttachments.push(attachment);
        console.log(`Prepared attachment: ${file.name} (${file.content.length} chars)`);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }
  }

  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;
  
  const fields = {
    "Prompt": userPrompt,
    "Bot_Answer": cleanBotAnswer,
    "Timestamp": new Date().toISOString(),
    "File_Count": files.length,
  };

  // Add file attachments if any
  if (airtableAttachments.length > 0) {
    fields["File_Attachments"] = airtableAttachments;
  }

  const recordData = {
    records: [{ fields }]
  };

  console.log("Saving to Airtable:", {
    url: airtableUrl,
    promptLength: userPrompt.length,
    botAnswerLength: cleanBotAnswer.length,
    hasFiles: files.length > 0,
    hasAttachments: airtableAttachments.length > 0
  });

  const response = await fetch(airtableUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(recordData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Airtable API Error:", response.status, errorText);
    throw new Error(`Airtable API Error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("Airtable save successful:", result);
  return result;
}
}