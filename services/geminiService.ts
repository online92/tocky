import { GoogleGenAI, Type } from "@google/genai";
import { SupportedLanguage, TranscriptSegment } from "../types";

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GOOGLE_API_KEY is not defined");
}

const ai = new GoogleGenAI({ apiKey });

export default ai;

// Helper to map language code to prompt string
const getLangPrompt = (lang: SupportedLanguage) => {
  switch (lang) {
    case SupportedLanguage.VIETNAMESE: return "Tiếng Việt";
    case SupportedLanguage.JAPANESE: return "Japanese";
    default: return "English";
  }
};

export const refineTextWithGemini = async (
  text: string,
  language: SupportedLanguage,
  customVocabulary: string
): Promise<string> => {
  if (!text.trim()) return "";
  const langPrompt = getLangPrompt(language);

  const prompt = `
    You are an expert stenographer and editor. 
    Task: Refine the raw transcription below into professional ${langPrompt}.
    
    Context/Vocabulary: ${customVocabulary}

    Rules:
    1. Fix spelling, punctuation, and grammar.
    2. INTELLIGENT FORMATTING: If the text looks like a conversation/dialogue, attempt to break lines between different ideas or implied speakers to make it readable.
    3. Remove filler words (uh, um, à, ừ).
    4. Keep the original meaning strictly.
    5. Return ONLY the refined text.

    Raw Text: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    throw error;
  }
};

export const summarizeTextWithGemini = async (
  text: string,
  language: SupportedLanguage
): Promise<string> => {
    if (!text.trim()) return "";
    const langPrompt = getLangPrompt(language);
  
    const prompt = `
      You are an expert meeting secretary. Analyze the transcript below and provide a structured summary in ${langPrompt}.
      
      You MUST output exactly 3 distinct sections using the following format (use Markdown for bolding):

      ### 📝 Executive Summary (Tóm tắt nội dung)
      [Write a paragraph summarizing the overall conversation or meeting context]

      ### 🔑 Key Takeaways (Các ý chính)
      - [Bullet point 1]
      - [Bullet point 2]
      ...

      ### ✅ Action Items (Danh sách công việc)
      - [Task description] - [Assignee if mentioned]
      - [Task description]
      (If no actions are detected, state "None/Không có")

      Transcript:
      "${text}"
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || "";
    } catch (error) {
      console.error("Gemini Summary Error:", error);
      throw error;
    }
  };

/**
 * Transcribes an audio file using Gemini 2.5 Flash, asking for Diarization and Timestamps
 * Returns a JSON structure of segments.
 */
export const transcribeAudioFile = async (
  base64Audio: string,
  mimeType: string,
  language: SupportedLanguage,
  customVocabulary: string
): Promise<TranscriptSegment[]> => {
  const langPrompt = getLangPrompt(language);
  
  // We use JSON schema to ensure strict structure for the diarization
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        speaker: { type: Type.STRING, description: "Speaker name (e.g., Speaker 1, Speaker 2)" },
        timestamp: { type: Type.STRING, description: "Start time of the segment in MM:SS format" },
        text: { type: Type.STRING, description: "The transcribed text" }
      },
      required: ["speaker", "timestamp", "text"]
    }
  };

  const prompt = `
    Analyze and transcribe this audio file in ${langPrompt}.
    
    Task:
    1. Identify different speakers (Diarization).
    2. Provide timestamps for each turn.
    3. Transcribe speech accurately.
    
    Context: ${customVocabulary}
    
    If the audio is silent or unintelligible, return an empty array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Audio } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const jsonText = response.text || "[]";
    const segments = JSON.parse(jsonText) as any[];
    
    // Add unique IDs to segments
    return segments.map((s, idx) => ({
      id: `seg-${Date.now()}-${idx}`,
      speaker: s.speaker,
      timestamp: s.timestamp,
      text: s.text
    }));

  } catch (error) {
    console.error("Gemini Audio Transcription Error:", error);
    throw new Error("Failed to transcribe audio file.");
  }
};
