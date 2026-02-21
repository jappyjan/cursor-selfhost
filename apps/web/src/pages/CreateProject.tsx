import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function CreateProject() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <h2 className="font-mono text-2xl font-semibold">Create project</h2>
        <p className="text-sm text-muted-foreground">
          Create a new project from a local folder or clone from Git. This
          wizard will be implemented in Phase 7.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </div>
  );
}
