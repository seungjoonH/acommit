export default class OpenAI {
  constructor(opts) {
    this.apiKey = opts?.apiKey;
  }
  chat = {
    completions: {
      create: async (payload) => ({ choices: [{ message: { content: 'mock-openai-response' } }] })
    }
  }
}
