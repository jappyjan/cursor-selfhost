import { useState } from "react";
import { ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

export type TodoItem = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
};

interface TodoListPanelProps {
  todos: TodoItem[];
  className?: string;
}

const STATUS_ICONS: Record<TodoItem["status"], string> = {
  pending: "○",
  in_progress: "◐",
  completed: "✓",
  cancelled: "✗",
};

const STATUS_STYLES: Record<TodoItem["status"], string> = {
  pending: "text-muted-foreground",
  in_progress: "text-primary",
  completed: "text-muted-foreground line-through",
  cancelled: "text-muted-foreground/60 line-through",
};

export function TodoListPanel({ todos, className }: TodoListPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (todos.length === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <ListTodo className="h-4 w-4 shrink-0" />
        <span>
          Todo list ({todos.filter((t) => t.status !== "cancelled").length})
        </span>
      </button>
      {isOpen && (
        <div className="max-h-48 overflow-y-auto border-t border-border px-4 py-2">
          <ul className="space-y-1.5 text-sm">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className={cn(
                  "flex items-start gap-2",
                  STATUS_STYLES[todo.status]
                )}
              >
                <span className="mt-0.5 shrink-0 font-mono text-xs">
                  {STATUS_ICONS[todo.status]}
                </span>
                <span className="break-words">{todo.content}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
