import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, userId, files } = await req.json();
    
    if (!conversationId || !userId || !files || !Array.isArray(files)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookUrl = 'https://n8n.srv998239.hstgr.cloud/webhook/0007840c-e6e6-4eb7-a3b5-74db22b86d0b';

    console.log('Sending file upload notification to n8n:', { conversationId, fileCount: files.length });

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'file_upload',
        conversationId,
        userId,
        files,
        timestamp: new Date().toISOString()
      })
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('n8n webhook error:', webhookResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Webhook request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-file-upload:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
