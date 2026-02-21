import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchConfig, fetchProjects } from "@/lib/api";

export function Home() {
  const navigate = useNavigate();
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  useEffect(() => {
    if (!config) return;
    if (!config.configured) {
      navigate("/setup", { replace: true });
      return;
    }
    if (projects.length > 0) {
      navigate(`/p/${projects[0].slug}`, { replace: true });
    } else {
      navigate("/create", { replace: true });
    }
  }, [config, projects, navigate]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}
