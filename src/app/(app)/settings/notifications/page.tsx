import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { PageHeader } from "@/components/page-header";
import { DigestButtons } from "./digest-buttons";

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  if (user.role.name !== "admin") notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Notifications"
        description="Manual digest sends only - nothing here runs automatically. Each button sends once, immediately, to every admin/IT manager (or, for approvals, to the specific person who can act on it)."
      />
      <DigestButtons />
    </div>
  );
}
