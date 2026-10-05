import { requireAdmin } from "@/lib/session";

export default async function ProduccionLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
