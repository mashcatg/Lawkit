import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ShareNotificationRequest {
  conversationId: string;
  conversationTitle: string;
  emails: string[];
  sharedByEmail: string;
  publicShareToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const {
      conversationId,
      conversationTitle,
      emails,
      sharedByEmail,
      publicShareToken,
    }: ShareNotificationRequest = await req.json();

    console.log("Sending share notifications to:", emails);

    const shareLink = `${req.headers.get("origin") || ""}/shared/${publicShareToken}`;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Send email to each recipient using Resend API
    const emailPromises = emails.map((recipientEmail) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Lawkit <onboarding@resend.dev>",
          to: [recipientEmail],
          subject: `${sharedByEmail} shared a conversation with you`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a1a1a; margin-bottom: 24px;">You've been invited to view a conversation</h1>
              
              <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                <strong>${sharedByEmail}</strong> has shared a conversation with you on Lawkit.
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">${conversationTitle}</h2>
              </div>
              
              <a href="${shareLink}" 
                 style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                View Conversation
              </a>
              
              <p style="color: #999; font-size: 14px; margin-top: 32px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          `,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;

    console.log(
      `Email notifications sent: ${successCount} succeeded, ${failedCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failedCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-share-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
