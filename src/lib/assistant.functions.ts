import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskInput = z.object({
  question: z.string().min(1).max(1000),
  projectId: z.string().uuid().nullable().optional(),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, message: "The assistant is not configured yet." };
    }

    const { supabase } = context;
    const [projectsRes, itemsRes] = await Promise.all([
      supabase.from("projects").select("*").order("sort_order"),
      supabase.from("ridac_items").select("*").order("due_date", { nullsFirst: false }),
    ]);
    if (projectsRes.error || itemsRes.error) {
      return { ok: false as const, message: "Could not read the portfolio data." };
    }

    const projects = projectsRes.data ?? [];
    const items = itemsRes.data ?? [];
    const scoped = data.projectId ? items.filter((i) => i.project_id === data.projectId) : items;

    const byId = new Map(projects.map((p) => [p.id, p]));
    const snapshot = {
      today: new Date().toISOString().slice(0, 10),
      projects: projects.map((p) => ({
        name: p.name,
        code: p.code,
        phase: p.phase,
        health: p.health,
        priority: p.priority,
        owner: p.owner,
        target_date: p.target_date,
      })),
      items: scoped.slice(0, 400).map((i) => ({
        project: byId.get(i.project_id)?.name ?? "",
        ref: i.ref_code,
        type: i.type,
        title: i.title,
        owner: i.owner,
        status: i.status,
        severity: i.severity,
        due_date: i.due_date,
      })),
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content:
              "You are the portfolio assistant for a PMO tool. Answer strictly from the JSON portfolio snapshot provided. " +
              "Be concise and specific: name projects, owners, reference codes and dates. Flag overdue and blocked items. " +
              "Use short markdown bullets. If the snapshot does not contain the answer, say so plainly.",
          },
          {
            role: "user",
            content: `Portfolio snapshot:\n${JSON.stringify(snapshot)}\n\nQuestion: ${data.question}`,
          },
        ],
      }),
    });

    if (res.status === 429) {
      return { ok: false as const, message: "Too many requests right now — try again in a moment." };
    }
    if (res.status === 402) {
      return {
        ok: false as const,
        message: "AI credits are exhausted. Add credits in Lovable to keep using the assistant.",
      };
    }
    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      return { ok: false as const, message: `Assistant unavailable (${res.status}).` };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = json.choices?.[0]?.message?.content?.trim();
    if (!answer) return { ok: false as const, message: "The assistant returned an empty answer." };
    return { ok: true as const, answer };
  });
