import { requireUser } from "@/lib/auth/dal";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome, {user.firstName ?? user.email}
          </h1>
          <p className="text-muted-foreground text-sm">
            Role: {user.role.name}
          </p>
        </div>
        <form action={logout}>
          <Button variant="outline" type="submit">Sign out</Button>
        </form>
      </div>
    </div>
  );
}
