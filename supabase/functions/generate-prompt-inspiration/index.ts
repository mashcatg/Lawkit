import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a legal research assistant. Generate 3 concise and diverse legal research prompt suggestions that users might find helpful.

Examples of good legal research prompts:
- "Who appointed Justice Ketanji Brown Jackson?"
- "Analyze the reasoning in National Veterans Legal Services Program v. United States"
- "What cases cite Obergefell v. Hodges and analyze the citation patterns?"
- "Show me 9th Circuit decisions on Fourth Amendment searches in 2023"
- "Find the docket for Google v. Oracle in NDCA"
- "Get the oral argument recording for Dobbs v. Jackson"
- "What are Justice Clarence Thomas's recent gift disclosures?"
- "Show me investments over $5 million held by federal judges"
- "Find all opinions authored by Justice Sonia Sotomayor in 2023"
- "Find Roe v. Wade in the 5th Circuit"
- "Find cases by Judge Smith"
- "Tell me about Justice Sotomayor's career"

Generate 3 NEW suggestions in a similar style. Return ONLY a JSON array of strings, no other text.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate 3 legal research prompt suggestions.' }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate suggestions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Try to parse as JSON array
    let suggestions: string[];
    try {
      suggestions = JSON.parse(content);
      if (!Array.isArray(suggestions)) {
        throw new Error('Not an array');
      }
    } catch {
      // If parsing fails, extract suggestions from text
      suggestions = content
        .split('\n')
        .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('"'))
        .map((line: string) => line.replace(/^[-"]\s*/, '').replace(/"$/, '').trim())
        .filter((line: string) => line.length > 0)
        .slice(0, 3);
    }

    console.log('Generated suggestions:', suggestions);

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-prompt-inspiration function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
