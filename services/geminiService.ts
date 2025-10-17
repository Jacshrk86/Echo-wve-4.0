import { GoogleGenAI, Modality } from "@google/genai";

export async function generateSpeech(
  text: string, 
  voiceName: string, 
  language: string, 
  isSSML: boolean,
  voiceTone: string,
  speakingIntention: string,
  voiceCharacteristics: string,
  pitch: number,
  speed: number
): Promise<string> {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let textToSynthesize = text;

  // For non-SSML, build a direct, command-like prompt for the model.
  if (!isSSML) {
    const instructions: string[] = [];
    if (voiceTone.trim()) instructions.push(`in a ${voiceTone.trim()} tone`);
    if (voiceCharacteristics.trim()) instructions.push(`with a ${voiceCharacteristics.trim()} voice`);
    if (speakingIntention.trim()) instructions.push(`as if to ${speakingIntention.trim()}`);
    
    // Map pitch/speed to simple descriptors
    if (pitch < 0.9) instructions.push('with a low pitch');
    else if (pitch > 1.1) instructions.push('with a high pitch');
    if (speed < 0.9) instructions.push('at a slow speed');
    else if (speed > 1.1) instructions.push('at a fast speed');

    if (instructions.length > 0) {
      const prefix = `Speak the following text ${instructions.join(', ')}: `;
      textToSynthesize = prefix + text;
    }
  }

  // If SSML is enabled, use original text and wrap in <speak> tags if needed.
  const processedText = isSSML && !text.trim().startsWith('<speak>') 
    ? `<speak>${text}</speak>` 
    : textToSynthesize;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: processedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
          // FIX: Pass the language code to the API, which is likely required.
          languageCode: language,
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (base64Audio) {
      return base64Audio;
    } else {
      throw new Error("No audio data received from API. The model may have deemed the input unsafe.");
    }
  } catch (error) {
    console.error("Error generating speech:", error);
    if (error instanceof Error && (error.message.includes('400') || error.message.toLowerCase().includes('invalid'))) {
        throw new Error("Invalid request. Please check your input text (and SSML markup) and try again.");
    }
    throw new Error("Failed to generate speech. Please check your input and API configuration.");
  }
}