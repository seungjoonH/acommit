export class GoogleGenerativeAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  getGenerativeModel() {
    return {
      generateContent: async (input) => ({ response: { candidates: [{ content: { parts: [{ text: 'mock-gemini-response' }] } }] } })
    };
  }
}
