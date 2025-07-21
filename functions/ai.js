// functions/ai.js

// Import der optionalen Airtable-Funktion
import { saveToAirtable } from './airtable.js';

/**
 * Handles CORS pre-flight requests for the /ai endpoint.
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
 * Accepts a 'roadmap' string in the body to provide the AI
 * with the most current state of the user's project plan.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Parse the JSON body from the request
    const body = await request.json();

    // Destructure all expected fields from the frontend payload
    const {
      message,
      messages = [],
      files = [],
      prompt,
      roadmap,
      fileAttachments = [] // Für Airtable-Integration
    } = body;

    // Validate that the main message content exists
    if (!message) {
      return new Response(JSON.stringify({ error: "Missing 'message' field in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Build system prompt
    let systemPrompt = prompt || "Du bist ein hilfsreicher AI-Assistent. Antworte höflich und informativ auf Deutsch.";

    // Inject roadmap context if provided
    if (roadmap) {
      systemPrompt += `\n\nWICHTIGER KONTEXT: Dies ist der aktuelle Projektplan des Benutzers. Behandle diese Information als die einzige Quelle der Wahrheit für alle Aufgaben, Daten und Termine. Antworte auf Fragen basierend auf diesen Daten.\n\n${roadmap}`;
    }

    // Add file context if files exist
    if (files && files.length > 0) {
      systemPrompt += `\n\nZUSÄTZLICHER KONTEXT: Der Benutzer hat auch ${files.length} Datei(en) hochgeladen. Diese sind im Nachrichteninhalt zu finden. Beziehe dich bei Bedarf auch auf diese.`;
    }

    // Assemble the final message payload for OpenAI API
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
      { role: "user", content: message }
    ];

    // Make the API call to OpenAI
    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.VITE_APP_OPENAI_API_KEY}`, //  
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4-1106-preview",
        messages: chatMessages,
        max_tokens: files.length > 0 || (roadmap && roadmap.length > 200) ? 2500 : 1500,
        temperature: 0.7,
      }),
    });

    // Handle OpenAI API errors
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      
      if (errorText.includes("context_length_exceeded")) {
        const errorMsg = "Entschuldigung, die Konversation oder die hochgeladenen Dateien sind zu groß. Bitte kürzen Sie Ihre Eingabe oder starten Sie ein neues Gespräch.";
        const errorResponse = { choices: [{ message: { content: errorMsg } }] };
        return new Response(JSON.stringify(errorResponse), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      
      throw new Error(`OpenAI API Error: ${apiResponse.status} - ${errorText}`);
    }

    // Parse successful response from OpenAI
    const data = await apiResponse.json();
    const botAnswer = data.choices?.[0]?.message?.content || "Keine Antwort erhalten";

    // 📝 OPTIONAL: Save to Airtable (non-blocking)
    if (env.AIRTABLE_API_KEY && env.AIRTABLE_BASE_ID) {
      try {
        const airtableData = {
          prompt: message,
          botAnswer,
          files,
          fileAttachments
        };
        
        await saveToAirtable(env, airtableData);
        console.log("✅ Successfully saved to Airtable");
      } catch (airtableError) {
        console.error("❌ Airtable save failed:", airtableError);
        // Continue with AI response even if Airtable fails
      }
    } else {
      console.log("ℹ️ Airtable credentials not found - skipping database save");
    }

    // Return the successful response to the frontend
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Error in AI function:", error);
    
    // Create fallback error message
    const fallbackMsg = {
      choices: [{
        message: { content: "Entschuldigung, es gab einen technischen Fehler. Bitte versuchen Sie es erneut." }
      }]
    };

    const status = error instanceof SyntaxError ? 400 : 500;
    
    return new Response(JSON.stringify(fallbackMsg), {
      status: status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}