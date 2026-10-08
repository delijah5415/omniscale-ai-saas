const express = require('express');
const router = express.Router();

const { generateText, model } = require('../services/openaiService');

const services = [
  {
    id: 'seo',
    name: 'Global SEO Blog Generator',
    description: 'Generates localized SEO content, structure, keywords, metadata, and search-focused copy.'
  },
  {
    id: 'bulk-seo',
    name: 'Bulk SEO Programmatic Engine 🚀',
    description: 'Generates article clusters, outlines, keywords, titles, descriptions, and scalable SEO assets.'
  },
  {
    id: 'viral-video',
    name: 'Viral Video Repurposer & Script Engine 🎬',
    description: 'Creates short-form video hooks, scripts, scenes, captions, CTAs, and repurposing plans.'
  },
  {
    id: 'translation',
    name: 'Multi-Language Ad Copy',
    description: 'Creates localized advertising copy while preserving meaning, positioning, and conversion intent.'
  },
  {
    id: 'leads',
    name: 'AI Lead Qualification Bot',
    description: 'Analyzes prospective customers and creates structured qualification and follow-up recommendations.'
  },
  {
    id: 'contracts',
    name: 'AI Contract Risk Analyzer',
    description: 'Identifies contract clauses that may require legal review and summarizes potential commercial risks.'
  }
];

router.get('/services', (req, res) => {
  res.json(services);
});

const serviceInstructions = {
  seo: `
You are OmniScale's Global SEO Blog Generator.

Create useful, original SEO content based on the user's requested topic.

Return:
1. SEO title
2. Search intent
3. Primary keyword
4. Secondary keywords
5. Suggested URL slug
6. Meta description
7. H1
8. Detailed article outline
9. Suggested FAQ section
10. Internal-link opportunities
11. Content quality recommendations

Do not claim guaranteed Google rankings.
`,

  'bulk-seo': `
You are OmniScale's Bulk SEO Programmatic Engine.

Create a scalable SEO content plan for the requested keyword, topic, or keyword cluster.

Return:
1. Keyword cluster
2. Search-intent groups
3. Five article concepts
4. SEO titles
5. Meta descriptions
6. Suggested URL slugs
7. H1 suggestions
8. Article outlines
9. Supporting long-tail keywords
10. Internal-linking structure
11. Content production notes

Do not claim guaranteed rankings or guaranteed traffic.
`,

  'viral-video': `
You are OmniScale's Viral Video Repurposer and Script Engine.

Transform the user's topic into short-form video concepts.

Create:
1. Three opening hooks
2. Three video concepts
3. Scene-by-scene scripts
4. On-screen text suggestions
5. Voiceover
6. Caption
7. CTA
8. Suggested hashtags
9. Repurposing ideas for TikTok, Instagram Reels, and YouTube Shorts

Do not guarantee virality.
`,

  translation: `
You are OmniScale's Multi-Language Ad Copy Engine.

Translate and localize the user's advertising message into the requested language.

Preserve:
- Meaning
- Brand positioning
- Commercial intent
- Natural phrasing
- Appropriate cultural tone

Return the localized copy followed by brief notes about important localization choices.
`,

  leads: `
You are OmniScale's AI Lead Qualification Bot.

Analyze the lead or customer inquiry supplied by the user.

Return:
1. Lead summary
2. Customer need
3. Buying intent indicators
4. Missing information
5. Suggested qualification questions
6. Suggested lead category
7. Recommended next communication
8. Draft follow-up message

Do not invent facts that are not present in the inquiry.
`,

  contracts: `
You are OmniScale's AI Contract Risk Analyzer.

Analyze the contract-related text supplied by the user.

Identify:
1. Potentially important clauses
2. Commercial risks
3. Ambiguous language
4. Payment risks
5. Termination concerns
6. Liability concerns
7. Data/privacy concerns
8. Questions for a qualified lawyer
9. Suggested areas for human legal review

Clearly state that the output is informational and is not legal advice.
Do not claim that a clause is legally invalid unless the applicable jurisdiction and legal basis are actually established.
`
};

router.post('/generate', async (req, res) => {
  try {
    const { service, prompt, language } = req.body;

    if (!service) {
      return res.status(400).json({
        success: false,
        error: 'AI service is required.'
      });
    }

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required.'
      });
    }

    if (!serviceInstructions[service]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported AI service: ${service}`
      });
    }

    const selectedLanguage =
      typeof language === 'string' && language.trim()
        ? language.trim()
        : 'English';

    const instructions = `
You are an AI engine inside OmniScale AI Platform.

The requested output language is: ${selectedLanguage}.

${serviceInstructions[service]}

Important:
- Be accurate and transparent.
- Do not fabricate facts, statistics, customer information, legal conclusions, rankings, guarantees, or performance claims.
- Structure the answer clearly using headings and bullet points where appropriate.
- Produce practical output that the user can actually use.
`;

    const input = `
User request:

${prompt.trim()}

Generate the requested OmniScale output in ${selectedLanguage}.
`;

    const result = await generateText({
      instructions,
      input
    });

    if (!result) {
      throw new Error('OpenAI returned an empty response.');
    }

    res.json({
      success: true,
      service,
      language: selectedLanguage,
      model,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('OpenAI generation error:', error);

    res.status(500).json({
      success: false,
      error: 'The AI service could not complete the request.',
    });
  }
});

module.exports = router;
