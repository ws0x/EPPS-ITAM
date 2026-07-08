export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set. Email not sent.");
    return { success: false, error: "RESEND_API_KEY is not set" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Makka ITAM <onboarding@resend.dev>", // Default Resend test sender
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", errText);
      return { success: false, error: errText };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
