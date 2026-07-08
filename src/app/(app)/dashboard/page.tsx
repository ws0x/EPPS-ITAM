import { requireUser } from "@/lib/auth/dal";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Welcome, {user.firstName ?? user.email}
      </h1>
      <p className="text-muted-foreground text-sm mt-1">
        Role: {user.role.name.replace(/_/g, " ")}
      </p>
    </div>
  );
}
