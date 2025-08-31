import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const modelKey = "gemini-2.5-flash";
if (!apiKey) throw new Error("GEMINI_API_KEY not set");

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelKey });

export async function gen(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}