const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('Missing RESEND_API_KEY')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { ticketId, email, clientName, issueTitle, priority, issueCategory, department, chatLink: providedChatLink, orgName } = await req.json()

    if (!ticketId || !email || !clientName || !issueTitle) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const chatLink = providedChatLink || `https://ticket-sync-co.lovable.app/ticket/${ticketId}/chat`
    const brandName = orgName || 'HigherView Taxes LLC'
    const shortId = ticketId.slice(0, 8).toUpperCase()

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f0f2f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%); padding: 40px 32px; text-align: center;">
      <div style="font-size: 48px; margin: 0 auto 16px; text-align: center;">⚙️</div>
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Ticket In Progress</h1>
      <div style="width: 48px; height: 3px; background: rgba(255,255,255,0.4); margin: 12px auto 0; border-radius: 2px;"></div>
      <p style="color: #bfdbfe; margin: 12px 0 0; font-size: 14px;">Your support ticket is currently being processed</p>
    </div>

    <!-- Status Banner -->
    <div style="background: #eff6ff; padding: 16px 32px; border-bottom: 1px solid #bfdbfe;">
      <table style="width: 100%;" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">⚙️ PROCESSING</span>
          </td>
          <td style="text-align: right;">
            <span style="font-family: 'Courier New', monospace; color: #6b7280; font-size: 13px;">ID: ${shortId}</span>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- Body -->
    <div style="padding: 32px;">
      <p style="color: #1f2937; font-size: 16px; margin: 0 0 8px; font-weight: 600;">Hi ${clientName},</p>
      
      <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
        We wanted to let you know that your support ticket <strong style="color: #2563eb;">#${shortId}</strong> is now being actively worked on by our team. Here's a summary:
      </p>
      
      <!-- Ticket Summary Card -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 0 24px;">
        <div style="background: #eff6ff; padding: 14px 20px; border-bottom: 1px solid #bfdbfe;">
          <h3 style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 700; letter-spacing: 0.3px;">📋 TICKET SUMMARY</h3>
        </div>
        <div style="padding: 16px 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; width: 150px; vertical-align: top;">Issue</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${issueTitle}</td>
            </tr>
            ${issueCategory ? `<tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Category</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 500;">${issueCategory}</td>
            </tr>` : ''}
            ${department ? `<tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Department</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 500;">${department}</td>
            </tr>` : ''}
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Priority</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 500;">${priority || 'Medium'}</td>
            </tr>
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Status</td>
              <td style="padding: 10px 0;">
                <span style="display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 700;">Processing</span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- What to Expect -->
      <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 10px; padding: 20px; margin: 0 0 28px;">
        <h4 style="margin: 0 0 8px; color: #1e40af; font-size: 14px; font-weight: 700;">📌 What happens next?</h4>
        <p style="margin: 0; color: #1e3a5f; font-size: 13px; line-height: 1.6;">
          Our team is reviewing your issue and working on a resolution. You'll receive another notification once your ticket is resolved. In the meantime, you can send us a message through the link below if you have additional information to share.
        </p>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 0 0 24px;">
        <a href="${chatLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
          💬 View Ticket Messages
        </a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
        Thank you for your patience. We're on it!
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.6;">
        © ${new Date().getFullYear()} ${brandName}. All rights reserved.<br>
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HigherView Taxes Support <support@higherviewtaxesllc.com>',
        reply_to: 'hvlegacies@gmail.com',
        to: [email],
        subject: `⚙️ Ticket #${shortId} In Progress — ${issueTitle}`,
        html,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`Resend API error: ${res.status} ${errorBody}`)
    }

    const result = await res.json()
    console.log('Processing email sent via Resend:', result)

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Processing email error:', errorMsg)
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
