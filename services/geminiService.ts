
import { GoogleGenAI, Type } from "@google/genai";
import { 
  AIResponsePlan, 
  AIExecutionResult, 
  AIVerificationResult, 
  MissionState, 
  Step 
} from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Utility to handle retries with exponential backoff.
 * Uses a shorter base delay for a more responsive feel.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errorMessage = err.message || "";
      const isQuotaError = errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
      
      if (isQuotaError && i < maxRetries - 1) {
        // Shorter exponential backoff: 2s, 4s, 8s, 16s
        const delay = Math.pow(2, i) * 2000; 
        console.warn(`Quota reached. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export const GeminiService = {
  async planMission(goal: string): Promise<AIResponsePlan> {
    return withRetry(async () => {
      // Use Flash for planning to save Pro quota and speed up the start
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are the Master Planner for an autonomous agent. 
        Goal: "${goal}"
        Break this into a logical sequence of 3-7 specific steps. 
        Each step must be actionable and verifiable.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["title", "description"]
                }
              }
            },
            required: ["steps"]
          }
        }
      });
      return JSON.parse(response.text);
    });
  },

  async executeStep(
    step: Step, 
    mission: MissionState
  ): Promise<AIExecutionResult> {
    return withRetry(async () => {
      const memoryContext = mission.artifacts.length > 0 
        ? `Previous Artifacts:\n${mission.artifacts.map(a => `- ${a.name}`).join('\n')}` 
        : "No previous artifacts.";
      
      const prompt = `
        Current Mission Goal: "${mission.goal}"
        Current Step: "${step.title}" - ${step.description}
        
        Memory Context:
        ${memoryContext}
        
        CRITICAL INSTRUCTION: If this step involves writing code, documentation, or structured data, you MUST provide it in the "artifact" field of the JSON response.
      `;

      // Keep Pro for the actual hard work of coding
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              output: { type: Type.STRING },
              artifact: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  content: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["code", "markdown", "json"] }
                },
                required: ["name", "content", "type"]
              }
            },
            required: ["output"]
          }
        }
      });
      return JSON.parse(response.text);
    });
  },

  async verifyStep(
    step: Step, 
    result: AIExecutionResult, 
    goal: string
  ): Promise<AIVerificationResult> {
    return withRetry(async () => {
      const prompt = `
        Goal: "${goal}"
        Step attempted: "${step.title}"
        Output: ${result.output}
        Artifact: ${result.artifact ? result.artifact.name : 'NONE'}
        
        Verify if this fulfills the goal. If code was required and no artifact provided, fail the verification.
      `;

      // Use Flash for verification to reduce latency
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              passed: { type: Type.BOOLEAN },
              feedback: { type: Type.STRING }
            },
            required: ["passed", "feedback"]
          }
        }
      });
      return JSON.parse(response.text);
    });
  },

  async fixStep(
    step: Step, 
    previousResult: AIExecutionResult, 
    feedback: string
  ): Promise<AIExecutionResult> {
    return withRetry(async () => {
      const prompt = `
        The previous attempt for step "${step.title}" failed.
        Feedback: "${feedback}"
        Correct the error and provide the final artifact.
      `;

      // Keep Pro for fixes
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              output: { type: Type.STRING },
              artifact: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  content: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["code", "markdown", "json"] }
                },
                required: ["name", "content", "type"]
              }
            },
            required: ["output"]
          }
        }
      });
      return JSON.parse(response.text);
    });
  }
};
