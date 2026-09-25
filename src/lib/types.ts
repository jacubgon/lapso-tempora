export type Role = "user" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  department_id: string | null;
  active: boolean;
};

export type Project = {
  id: string;
  name: string;
  client: string | null;
  color: string;
  archived: boolean;
};

export type Task = {
  id: string;
  project_id: string;
  name: string;
};

export type TimeEntry = {
  id: string;
  user_id: string;
  title: string;
  project_id: string | null;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  source: "timer" | "manual";
};

export type ActionResult = { ok: true } | { ok: false; error: string };
