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
    const { 
      conversationId, 
      userId, 
      userName: requestUserName, 
      userEmail: requestUserEmail, 
      mode, 
      deepResearch, 
      prompt, 
      originalPrompt,
      context,
      docId: requestDocId,
      fileUrls: requestFileUrls,
      timestamp 
    } = await req.json();
    const n8nWebhookUrl = 'https://n8n.srv998239.hstgr.cloud/webhook/bf4dd093-bb02-472c-9454-7ab9af97bd1d';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('=== INCOMING REQUEST ===');
    console.log('Conversation ID:', conversationId);
    console.log('User ID:', userId);
    console.log('DocId:', requestDocId);
    console.log('Prompt:', prompt?.substring(0, 100));

    // Fetch user profile info
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    const userName = profile?.full_name || 'User';
    const userEmail = profile?.email || '';

    // Fetch conversation files and get public URLs
    const { data: files } = await supabase
      .from('conversation_files')
      .select('file_path, file_name')
      .eq('conversation_id', conversationId);

    const fileUrls = files?.map(file => ({
      name: file.file_name,
      url: `${supabaseUrl}/storage/v1/object/public/conversation-files/${file.file_path}`
    })) || [];

    const payload = {
      conversationId,
      userId,
      userName,
      userEmail,
      mode,
      deepResearch,
      prompt: prompt,
      originalPrompt: prompt,
      context: context || undefined,
      docid: requestDocId || null, // lowercase 'docid' for n8n
      fileUrls,
      timestamp: new Date().toISOString(),
    };

    console.log('=== SENDING TO N8N ===');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Send to n8n webhook with clean payload
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('=== N8N RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send prompt to n8n',
          details: errorText,
          status: response.status 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get raw response text
    const responseText = await response.text();
    console.log('=== RAW RESPONSE ===');
    console.log('Length:', responseText.length);
    console.log('First 500 chars:', responseText.substring(0, 500));
    console.log('Last 500 chars:', responseText.substring(Math.max(0, responseText.length - 500)));

    // Check content type
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);

    let data;
    let parseError = null;

    // Try to parse JSON
    if (responseText && responseText.trim()) {
      try {
        data = JSON.parse(responseText);
        console.log('=== PARSED JSON ===');
        console.log('Type:', Array.isArray(data) ? 'Array' : typeof data);
        console.log('Keys:', Array.isArray(data) ? `Length: ${data.length}` : Object.keys(data || {}).join(', '));
        console.log('Full structure:', JSON.stringify(data, null, 2).substring(0, 1000));
      } catch (error) {
        parseError = error;
        console.error('=== JSON PARSE ERROR ===');
        console.error('Error:', error);
        data = { 
          success: true, 
          message: 'Prompt sent but response not parseable as JSON',
          rawResponse: responseText.substring(0, 500)
        };
      }
    } else {
      console.warn('=== EMPTY RESPONSE ===');
      data = { 
        success: true, 
        message: 'Prompt sent but n8n returned empty response'
      };
    }

    // Extract AI response and generate docId if not present
    let aiResponse = 'No response received from AI';
    let docId = requestDocId || null;
    let docContent = null;
    let docTitle = null;

    console.log('=== EXTRACTING DATA ===');

    // Check if response is array format: [{ output: { aiResponse: "..." }, intermediateSteps: [...] }]
    if (Array.isArray(data) && data.length > 0) {
      console.log('Response is array, length:', data.length);
      console.log('First item keys:', Object.keys(data[0] || {}).join(', '));
      
      if (data[0]?.output) {
        console.log('Found output object, keys:', Object.keys(data[0].output).join(', '));
        const output = data[0].output;
        aiResponse = output.aiResponse || output.response || aiResponse;
        docId = output.docId || docId || `doc_${Date.now()}`;
        docContent = output.doccontent || output.docContent || null;
        docTitle = output.docTitle || output.doctitle || null;
      } else {
        console.warn('Array item missing output property');
      }
    } 
    // Fallback: check if response is direct object format: { aiResponse: "..." }
    else if (data && typeof data === 'object') {
      console.log('Response is object, keys:', Object.keys(data).join(', '));
      aiResponse = data.aiResponse || data.response || data.message || aiResponse;
      docId = data.docId || docId || `doc_${Date.now()}`;
      docContent = data.doccontent || data.docContent || null;
      docTitle = data.docTitle || data.doctitle || null;
    } else {
      console.warn('Unexpected data type:', typeof data);
    }
    
    // Normalize docTitle
    if (docTitle && typeof docTitle === 'string') {
      docTitle = docTitle.trim().replace(/^["'""'']|["'""'']$/g, '').replace(/,$/, '');
    }

    console.log('=== EXTRACTED VALUES ===');
    console.log('aiResponse type:', typeof aiResponse);
    console.log('aiResponse length:', typeof aiResponse === 'string' ? aiResponse.length : 'N/A');
    console.log('aiResponse preview:', typeof aiResponse === 'string' ? aiResponse.substring(0, 200) : JSON.stringify(aiResponse));
    console.log('docId:', docId);
    console.log('docTitle:', docTitle);
    console.log('docContent:', docContent ? 'Present' : 'Missing');

    // Save document to database if present
    if (docId && docContent && conversationId && userId) {
      console.log('=== SAVING DOCUMENT TO DATABASE ===');
      
      // Strip title from content to avoid duplication
      let cleanedContent = docContent;
      if (docTitle) {
        const titlePattern = new RegExp(`^\\s*<h1[^>]*>${docTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`, 'i');
        cleanedContent = docContent.replace(titlePattern, '').trim();
      }
      
      try {
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

          if (dbError) throw dbError;
        } else {
          // Insert new document (include doc_title)
          const { error: dbError } = await supabase
            .from('documents')
            .insert({
              doc_id: docId,
              doc_title: docTitle || 'Generated Document',
              doc_content: cleanedContent,
              conversation_id: conversationId,
              user_id: userId,
              updated_at: new Date().toISOString()
            });

          if (dbError) throw dbError;
        }

        console.log('Document saved to database successfully');
        
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
                doc_title: docTitle || 'Generated Document',
                created_by: userId
              });
          
          console.log(`Saved version ${newVersionNumber} for document ${docId}`);
        } catch (versionError) {
          console.error('Error saving document version:', versionError);
        }
      } catch (dbSaveError) {
        console.error('Error saving document:', dbSaveError);
      }
    }

    // Always return a complete response structure
    const finalResponse = {
      response: aiResponse,
      docId: docId,
      docContent: docContent,
      docTitle: docTitle || (docContent && docId ? 'Generated Document' : null),
      _debug: {
        responseStatus: response.status,
        contentType,
        hadParseError: !!parseError,
        rawResponseLength: responseText.length,
        dataType: Array.isArray(data) ? 'array' : typeof data
      }
    };

    console.log('=== FINAL RESPONSE ===');
    console.log(JSON.stringify(finalResponse, null, 2).substring(0, 1000));

    return new Response(
      JSON.stringify(finalResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== ERROR IN FUNCTION ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errorType: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});