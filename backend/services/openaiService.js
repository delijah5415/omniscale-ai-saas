const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    'OPENAI_API_KEY is not configured. Add it to backend/.env locally or your Vercel server environment.'
  );
}

const client = new OpenAI({
  apiKey,
  maxRetries: 2,
  timeout: 120000
});

const model = process.env.OPENAI_MODEL || 'gpt-5.5';


async function generateText({ instructions, input }) {
	try {
	  const response = await client.responses.create({
	     model,
	     instructions,
	     input
	    });

	    return response.output_text || '';
	  } catch (error) {
	    console.error('OpenAI API request failed:', {
	      name: error?.name,
	      status: error?.status,
	      code: error?.code,
	      type: error?.type,
	      message: error?.message
	  });

	  throw error;
	}
       }
