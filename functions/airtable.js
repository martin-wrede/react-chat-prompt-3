// functions/airtable.js

/**
 * Handles CORS requests for the Airtable endpoint
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { action, data } = body;

    if (!action) {
      return errorResponse("Missing 'action' field");
    }

    let result;

    switch (action) {
      case "save":
        if (!data?.prompt) {
          return errorResponse("Missing 'prompt' in data");
        }
        result = await saveToAirtable(env, data);
        break;

      case "get":
        result = await getFromAirtable(env, data);
        break;

      default:
        return errorResponse(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: corsHeaders(),
    });

  } catch (err) {
    console.error("Airtable API error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

/**
 * Main function to save data to Airtable
 * Can be imported and used by other functions
 */
export async function saveToAirtable(env, data) {
  const { prompt, botAnswer, files = [], fileAttachments = [] } = data;

  const AIRTABLE_API_KEY = env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = env.AIRTABLE_TABLE_NAME || "Prompts";

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error("Missing Airtable credentials in environment");
  }

  // Clean up user prompt (remove file context if present)
  let userPrompt = prompt;
  if (prompt.includes("[Uploaded Files Context:]")) {
    userPrompt = prompt.split("\n\n[Uploaded Files Context:]")[0];
  }

  // Clean bot answer
  const cleanBotAnswer = botAnswer?.replace(/\n\s*\n/g, '\n').trim() || "No response";

  // Process file attachments for Airtable
  const attachments = [];
  
  if (fileAttachments && fileAttachments.length > 0) {
    console.log(`Processing ${fileAttachments.length} file attachments`);
    
    for (const file of fileAttachments) {
      try {
        if (file.url) {
          // File already has URL (e.g., from upload service)
          attachments.push({
            filename: file.name,
            url: file.url
          });
        } else if (file.content) {
          // Create data URL for file content
          const base64Content = btoa(file.content);
          const dataUrl = `data:${file.type || 'text/plain'};base64,${base64Content}`;
          
          attachments.push({
            filename: file.name,
            url: dataUrl
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }
  }

  // Prepare fields for Airtable
  const fields = {
    Prompt: userPrompt,
    Bot_Answer: cleanBotAnswer,
    Timestamp: new Date().toISOString(),
    File_Count: files.length,
  };

  // Add file attachments if any
  if (attachments.length > 0) {
    fields["File_Attachments"] = attachments;
  }

  // Make API call to Airtable
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Airtable API error:", errorText);
    throw new Error(`Airtable error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("✅ Saved to Airtable:", result.records?.[0]?.id);
  return result;
}

/**
 * Optional function to retrieve data from Airtable
 */
export async function getFromAirtable(env, options = {}) {
  const AIRTABLE_API_KEY = env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = env.AIRTABLE_TABLE_NAME || "Prompts";

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error("Missing Airtable credentials in environment");
  }

  const { maxRecords = 100, sort = [{ field: "Timestamp", direction: "desc" }] } = options;
  
  const params = new URLSearchParams({
    maxRecords: maxRecords.toString(),
    sort: JSON.stringify(sort)
  });

  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?${params}`, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result;
}

// Helper functions
function errorResponse(message) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 400,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}