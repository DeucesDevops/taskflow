export type User = { id: string; name: string; email: string };
export type Project = { id: string; name: string; description: string; ownerId: string; createdAt: string; role: "owner" | "member" };
export type Member = { userId: string; name: string; email: string; role: "owner" | "member" };
export type Page<T> = { items: T[]; limit: number; offset: number; hasMore: boolean };
export type TaskStatus = "todo" | "in_progress" | "done";
export type Task = { id: string; projectId: string; title: string; description: string; assigneeId: string | null; assigneeName: string | null; status: TaskStatus; createdAt: string; updatedAt: string };
export type Comment = { id: string; taskId: string; userId: string; body: string; createdAt: string };
export type Notification = { id: string; type: string; message: string; taskId: string; projectId: string; createdAt: string };

export const taskStatuses: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];
