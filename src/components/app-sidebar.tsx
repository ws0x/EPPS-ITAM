"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  KeyRound,
  Package,
  PackageOpen,
  Users,
  MapPin,
  Building2,
  Factory,
  Layers,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Assets", url: "/assets", icon: Boxes },
  { title: "Licenses", url: "/licenses", icon: KeyRound },
  { title: "Consumables", url: "/consumables", icon: Package },
  { title: "Kits", url: "/kits", icon: PackageOpen },
];

const referenceItems = [
  { title: "Locations", url: "/locations", icon: MapPin },
  { title: "Departments", url: "/departments", icon: Building2 },
  { title: "Manufacturers", url: "/manufacturers", icon: Factory },
  { title: "Models", url: "/models", icon: Layers },
  { title: "Users", url: "/users", icon: Users },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold shadow-sm">
            M
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm">Makka ITAM</span>
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Asset Management</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.url)}
                    render={
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Reference Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {referenceItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.url)}
                    render={
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
