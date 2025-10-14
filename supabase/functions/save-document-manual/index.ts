import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { docId, docContent, conversationId, userId } = await req.json();

    if (!docId || !docContent || !conversationId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: docId, docContent, conversationId, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const n8nWebhookUrl = 'https://n8n.srv998239.hstgr.cloud/webhook/14428d95-f249-43d1-a2c7-7d7e5f492fe5';

    // Send to n8n webhook
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        docid: docId,
        doccontent: docContent,
        conversationId: conversationId,
        userId: userId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n webhook error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to save document to n8n' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get response from n8n (might include doctitle)
    let n8nData: any = {};
    try {
      n8nData = await response.json();
      console.log('N8N response:', n8nData);
    } catch (e) {
      console.log('No JSON response from n8n, proceeding with save');
    }

    // Extract doctitle if available in response array or object
    let docTitle = 'Generated Document';
    if (Array.isArray(n8nData) && n8nData.length > 0 && n8nData[0].doctitle) {
      docTitle = n8nData[0].doctitle;
    } else if (n8nData.doctitle) {
      docTitle = n8nData.doctitle;
    }
    
    // Normalize docTitle
    if (docTitle && typeof docTitle === 'string') {
      docTitle = docTitle.trim().replace(/^["'""'']|["'""'']$/g, '').replace(/,$/, '');
    }

    // Strip title from content to avoid duplication
    let cleanedContent = docContent;
    if (docTitle) {
      const titlePattern = new RegExp(`^\\s*<h1[^>]*>${docTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`, 'i');
      cleanedContent = docContent.replace(titlePattern, '').trim();
    }

    // Check if document exists
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('doc_id')
      .eq('doc_id', docId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existingDoc) {
      // Update existing document (don't update doc_title)
      const { error: dbError } = await supabase
        .from('documents')
        .update({
          doc_content: cleanedContent,
          updated_at: new Date().toISOString()
        })
        .eq('doc_id', docId)
        .eq('conversation_id', conversationId);

      if (dbError) {
        console.error('Database save error:', dbError);
        return new Response(
          JSON.stringify({ error: 'Failed to save to database', details: dbError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Insert new document (include doc_title)
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          doc_id: docId,
          doc_title: docTitle,
          doc_content: cleanedContent,
          conversation_id: conversationId,
          user_id: userId,
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('Database save error:', dbError);
        return new Response(
          JSON.stringify({ error: 'Failed to save to database', details: dbError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Save document version
    try {
      // Get the latest version number for this document
      const { data: latestVersion } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', docId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const newVersionNumber = (latestVersion?.version_number || 0) + 1;
      
      // Save new version
      await supabase
        .from('document_versions')
        .insert({
          document_id: docId,
          conversation_id: conversationId,
          version_number: newVersionNumber,
          doc_content: cleanedContent,
          doc_title: docTitle,
          created_by: userId
        });
      
      console.log(`Saved version ${newVersionNumber} for document ${docId}`);
    } catch (versionError) {
      console.error('Error saving document version:', versionError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Document saved successfully',
        docTitle: docTitle
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in save-document-manual:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
