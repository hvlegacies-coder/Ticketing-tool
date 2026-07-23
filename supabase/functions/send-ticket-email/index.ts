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
    const { ticketId, email, clientName, issueTitle, priority, department, issueCategory, affectedSystem, companyName, chatLink: providedChatLink, orgName } = await req.json()

    if (!ticketId || !email || !clientName || !issueTitle) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const chatLink = providedChatLink || `https://ticket-sync-co.lovable.app/ticket/${ticketId}/chat`
    const brandName = orgName || 'HigherView Taxes LLC'
    const shortId = ticketId.slice(0, 8).toUpperCase()

    const priorityColor = {
      'Critical': '#e53e3e',
      'High': '#dd6b20',
      'Medium': '#d69e2e',
      'Low': '#38a169',
    }[priority] || '#718096'

    const priorityBg = {
      'Critical': '#fff5f5',
      'High': '#fffaf0',
      'Medium': '#fffff0',
      'Low': '#f0fff4',
    }[priority] || '#f7fafc'

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f0f2f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 40px 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${brandName}</h1>
      <div style="width: 48px; height: 3px; background: linear-gradient(90deg, #667eea, #764ba2); margin: 12px auto 0; border-radius: 2px;"></div>
      <p style="color: #a0b4d0; margin: 12px 0 0; font-size: 14px; letter-spacing: 0.5px;">SUPPORT TICKET CONFIRMATION</p>
    </div>

    <!-- Status Banner -->
    <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 20px 32px; border-bottom: 1px solid #e8ecf4;">
      <table style="width: 100%;" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="display: inline-block; background: #eef2ff; color: #4f46e5; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">⏳ PROCESSING</span>
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
        Thank you for reaching out! Your support ticket has been received and is <strong style="color: #4f46e5;">currently being processed</strong> by our team. We'll reach out once it's been resolved or if we need additional information from you.
      </p>
      
      <!-- Ticket Details Card -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 0 24px;">
        <div style="background: #f1f5f9; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
          <h3 style="margin: 0; font-size: 14px; color: #374151; font-weight: 700; letter-spacing: 0.3px;">📋 TICKET DETAILS</h3>
        </div>
        <div style="padding: 16px 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; width: 150px; vertical-align: top;">Issue Summary</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${issueTitle}</td>
            </tr>
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Priority</td>
              <td style="padding: 10px 0;">
                <span style="display: inline-block; background: ${priorityBg}; color: ${priorityColor}; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; border: 1px solid ${priorityColor}20;">${priority || 'Medium'}</span>
              </td>
            </tr>
            ${issueCategory ? `<tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Category</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 500;">${issueCategory}</td>
            </tr>` : ''}
            ${department ? `<tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Department</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 500;">${department}</td>
            </tr>` : ''}
            ${affectedSystem ? `<tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Affected System</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 500;">${affectedSystem}</td>
            </tr>` : ''}
            ${companyName ? `<tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Company</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 500;">${companyName}</td>
            </tr>` : ''}
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Est. Response</td>
              <td style="padding: 10px 0; color: #1f2937; font-size: 13px; font-weight: 600;">Within 24 hours</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- What Happens Next -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; margin: 0 0 28px;">
        <h4 style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 700;">🔄 What happens next?</h4>
        <ol style="margin: 0; padding: 0 0 0 20px; color: #3b82f6;">
          <li style="margin: 0 0 8px; font-size: 13px; line-height: 1.5;"><span style="color: #374151;">Our team reviews your ticket and assigns it to a specialist</span></li>
          <li style="margin: 0 0 8px; font-size: 13px; line-height: 1.5;"><span style="color: #374151;">We may reach out if we need additional details</span></li>
          <li style="margin: 0; font-size: 13px; line-height: 1.5;"><span style="color: #374151;">You'll receive an email once your issue has been resolved</span></li>
        </ol>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 0 0 24px;">
        <a href="${chatLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
          💬 Open Messages
        </a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
        Use the button above to communicate with our support team about this ticket.<br>Save this email for your records.
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
        subject: `🎫 Ticket #${shortId} Received — ${issueTitle}`,
        html,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`Resend API error: ${res.status} ${errorBody}`)
    }

    const result = await res.json()
    console.log('Email sent via Resend:', result)

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Email send error:', errorMsg)
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
