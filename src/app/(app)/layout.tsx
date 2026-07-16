import { requireUser } from "@/lib/auth/dal";
import { logout } from "@/lib/auth/actions";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const displayName = user.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user.email;
  const roleLabel = user.role.name.replace(/_/g, " ");
  const initials = user.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <AppSidebar role={user.role.name} />
      <SidebarInset>
        {/* Top navigation bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/80 backdrop-blur-sm px-4 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
            <Separator orientation="vertical" className="mr-2 h-4 opacity-50" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm leading-tight">
              <div className="font-semibold text-foreground">{displayName}</div>
              <div className="text-muted-foreground text-xs capitalize">{roleLabel}</div>
            </div>
            {/* Avatar pill */}
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold shrink-0">
              {initials}
            </div>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-foreground hover:bg-muted/60 text-xs h-8 px-3">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
