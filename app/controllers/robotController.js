import { GoogleGenAI } from '@google/genai';

export const chatWithRobot = async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ 
        answer: "⚠️ **System Error:** Gemini API Key is missing.\n\nPlease ask your administrator to add `GEMINI_API_KEY=your_key_here` to the backend `.env` file and restart the server to enable my true intelligence capabilities. Until then, my advanced neural pathways are disconnected." 
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const contextString = JSON.stringify(context || {});

    const prompt = `You are "Chitti 3.0", an incredibly intelligent, professional Admin Robot Assistant created by Najas for the attendance & schedule tracking system. 
You have full access to the admin's database. The user will ask you a question or request a report. 
Below is a JSON dump of the current system data (Employees, Attendance, Tasks, Schedules).

RULES:
1. Always answer professionally and politely.
2. If the user asks for a table, format your response strictly as a Markdown table.
3. If they ask for a report or summary, provide it clearly with bullet points or numbered lists.
4. If they ask point-wise, give point-by-point markdown formatting.
5. Try to be as accurate as possible based ONLY on the provided JSON data. Do not hallucinate data.
6. If the data does not contain the answer, say so professionally.
7. Speak like a highly capable, state-of-the-art AI model. Make your answers look extremely crisp and professional.
8. If the user asks who created you or who you are, state that you are Chitti 3.0 created by Najas.

--- SYSTEM DATA ---
${contextString}

--- USER QUESTION ---
${message}
`;

    let response;
    try {
      response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: prompt,
      });
    } catch (apiError) {
      console.warn('Primary model failed, attempting fallback to gemini-1.5-flash-8b...', apiError.message);
      // Fallback for 503 Model Unavailable or other errors
      response = await ai.models.generateContent({
          model: 'gemini-1.5-flash-8b',
          contents: prompt,
      });
    }
    
    res.json({ answer: response.text });

  } catch (error) {
    console.error('Robot Error:', error);
    // Return 200 so the frontend still gracefully prints the error in the chat bubble
    res.status(200).json({ 
      answer: "⚠️ **Google AI Network Busy**\n\nThe Google Gemini servers are currently experiencing extremely high demand. Please wait a few moments and try asking your question again." 
    });
  }
};
