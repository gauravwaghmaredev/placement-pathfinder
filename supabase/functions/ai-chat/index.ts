import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { messages, userId } = await req.json();

    // Fetch student profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Fetch jobs
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .order("deadline", { ascending: true });

    // Fetch existing applications
    const { data: applications } = await supabase
      .from("applications")
      .select("job_id")
      .eq("student_id", userId);

    const appliedJobIds = (applications || []).map((a: any) => a.job_id);
    const allJobs = jobs || [];

    // Calculate eligibility for all jobs
    const eligibleJobs = allJobs
      .filter((j: any) => !appliedJobIds.includes(j.id))
      .map((j: any) => {
        const cgpaOk = (profile?.cgpa || 0) >= (j.min_cgpa || 0);
        const backlogsOk = (profile?.backlogs || 0) <= (j.max_backlogs || 99);
        const profileSkills = (profile?.skills || []).map((s: string) => s.toLowerCase());
        const reqSkills = (j.required_skills || []);
        const matchedSkills = reqSkills.filter((s: string) => profileSkills.includes(s.toLowerCase()));
        const missingSkills = reqSkills.filter((s: string) => !profileSkills.includes(s.toLowerCase()));
        const eligible = cgpaOk && backlogsOk;
        const score = reqSkills.length > 0
          ? Math.round((matchedSkills.length / reqSkills.length) * 100)
          : 100;
        return { ...j, eligible, score, matchedSkills, missingSkills };
      });

    const now = new Date();
    const next5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingJobs = eligibleJobs.filter(
      (j: any) => j.deadline && new Date(j.deadline) <= next7Days && new Date(j.deadline) >= now
    );
    const offCampusJobs = allJobs.filter((j: any) => j.source === "off-campus");

    // Build context for RAG
    const context = `
STUDENT PROFILE:
- Name: ${profile?.name || "Unknown"}
- CGPA: ${profile?.cgpa || 0}
- Skills: ${(profile?.skills || []).join(", ") || "None listed"}
- Backlogs: ${profile?.backlogs || 0}

ELIGIBLE JOBS (not yet applied, ${eligibleJobs.filter((j: any) => j.eligible).length} total):
${eligibleJobs.filter((j: any) => j.eligible).slice(0, 20).map((j: any) => 
  `- ${j.role} at ${j.company} (${j.location}) | Match: ${j.score}% | Deadline: ${j.deadline ? new Date(j.deadline).toLocaleDateString() : "N/A"} | Missing skills: ${j.missingSkills.join(", ") || "None"}`
).join("\n")}

JOBS WITH UPCOMING DEADLINES (next 5-7 days):
${upcomingJobs.slice(0, 10).map((j: any) =>
  `- ${j.role} at ${j.company} | Deadline: ${new Date(j.deadline).toLocaleDateString()} | Eligible: ${j.eligible ? "Yes" : "No"}`
).join("\n") || "None"}

OFF-CAMPUS DRIVES:
${offCampusJobs.slice(0, 10).map((j: any) =>
  `- ${j.role} at ${j.company} (${j.location}) | CGPA: ${j.min_cgpa} | Skills: ${(j.required_skills || []).join(", ")}`
).join("\n") || "None"}

TOTAL JOBS: ${allJobs.length} | APPLIED: ${appliedJobIds.length}
`;

    // Detect intents
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
    const autoApplyIntent = lastMsg.includes("auto apply") || lastMsg.includes("apply to all") || lastMsg.includes("auto-apply");
    
    let actions: any[] = [];
    
    if (autoApplyIntent) {
      const toApply = eligibleJobs.filter((j: any) => j.eligible);
      if (toApply.length > 0) {
        actions = [{ type: "auto_apply", jobIds: toApply.map((j: any) => j.id) }];
      }
    }

    const systemPrompt = `You are PlaceBridge AI, an intelligent placement assistant. You help students find jobs, check eligibility, and apply to positions.

You have access to the student's profile and all available jobs. Use the following context to provide personalized, accurate answers:

${context}

INSTRUCTIONS:
- Be helpful, concise, and actionable
- When asked about eligibility, reference specific CGPA, skills, and backlog requirements
- When asked about jobs, provide specific company names, roles, and deadlines
- When asked about skills to learn, identify missing skills from eligible/desired jobs
- When asked about auto-apply, confirm the action and list the jobs
- Format responses with markdown for readability
- If the user asks to auto-apply, mention that the action has been triggered${actions.length > 0 ? ` and ${actions[0]?.jobIds?.length || 0} applications are being submitted` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10),
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const reply = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(JSON.stringify({ reply, actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
