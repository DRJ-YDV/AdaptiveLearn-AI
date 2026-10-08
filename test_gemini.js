import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

  for (const model of models) {
    try {
      console.log(`\nTesting extract-page ${model}...`);
      const contents = [
        {
          inlineData: {
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            mimeType: 'image/png'
          }
        },
        "Extract knowledge"
      ];

      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: { responseMimeType: 'application/json' }
      });
      console.log(`Success extraction with ${model}! Response:`, response.text);
    } catch (e) {
      console.error(`ERROR with ${model}:`, e.message);
    }
  }
}

test();
