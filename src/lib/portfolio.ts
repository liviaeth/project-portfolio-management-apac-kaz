import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Milestone, Project, RidacItem } from "./ridac";

export function useMilestones(projectId?: string) {
  return useQuery({
    queryKey: ["milestones", projectId ?? "all"],
    queryFn: async (): Promise<Milestone[]> => {
      let q = supabase.from("milestones").select("*");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q
        .order("sort_order", { ascending: true })
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });
}

export function useSaveMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<Milestone> & { id?: string }) => {
      if (m.id) {
        const { id, ...rest } = m;
        const { error } = await supabase.from("milestones").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("milestones").insert(m as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });
}


export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useRidacItems(projectId?: string) {
  return useQuery({
    queryKey: ["ridac", projectId ?? "all"],
    queryFn: async (): Promise<RidacItem[]> => {
      let q = supabase.from("ridac_items").select("*");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RidacItem[];
    },
  });
}

/** Keep queries fresh as teammates edit rows. */
export function useRealtimePortfolio() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("portfolio-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        qc.invalidateQueries({ queryKey: ["projects"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ridac_items" }, () => {
        qc.invalidateQueries({ queryKey: ["ridac"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, () => {
        qc.invalidateQueries({ queryKey: ["milestones"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: Partial<Project> & { id?: string }) => {
      if (project.id) {
        const { id, ...rest } = project;
        const { error } = await supabase.from("projects").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert(project as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ridac"] });
    },
  });
}

export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<RidacItem> & { id?: string }) => {
      if (item.id) {
        const { id, ...rest } = item;
        const { error } = await supabase.from("ridac_items").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ridac_items").insert(item as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ridac"] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ridac_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ridac"] }),
  });
}

export function useBulkInsertItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Partial<RidacItem>[]) => {
      const { error } = await supabase.from("ridac_items").insert(items as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ridac"] }),
  });
}
