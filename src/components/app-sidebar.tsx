"use client";

import Link from "next/link";
import Image from "next/image";
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
  ClipboardList,
  History,
  BarChart3,
  Receipt,
  Settings,
  Tags,
  FileBarChart,
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
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Assets", url: "/assets", icon: Boxes },
  { title: "Licenses", url: "/licenses", icon: KeyRound },
  { title: "Consumables", url: "/consumables", icon: Package },
  { title: "Kits", url: "/kits", icon: PackageOpen },
  { title: "Purchase Orders", url: "/purchase-orders", icon: Receipt },
  { title: "Requests", url: "/requests", icon: ClipboardList },
];

const referenceItems = [
  { title: "Locations", url: "/locations", icon: MapPin },
  { title: "Departments", url: "/departments", icon: Building2 },
  { title: "Categories", url: "/categories", icon: Tags },
  { title: "Manufacturers", url: "/manufacturers", icon: Factory },
  { title: "Models", url: "/models", icon: Layers },
  { title: "Users", url: "/users", icon: Users },
  { title: "Audit Logs", url: "/audit-logs", icon: History },
  { title: "Reports", url: "/reports", icon: FileBarChart },
];

const settingsItems = [
  { title: "Company Letterhead", url: "/settings/company", icon: Settings },
];

export function AppSidebar({ role }: { role?: string }) {
  const pathname = usePathname();

  const isTechOrManager =
    role === "admin" || role === "it_manager" || role === "technician";
  const canManagePurchaseOrders = role === "admin" || role === "it_manager";

  let visibleNavItems = isTechOrManager
    ? navItems
    : navItems.filter((i) => i.url === "/dashboard" || i.url === "/requests");
  if (!canManagePurchaseOrders) {
    visibleNavItems = visibleNavItems.filter((i) => i.url !== "/purchase-orders");
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/12 border border-white/10 overflow-hidden p-1 shrink-0">
            <Image
              src="/brand/EPPS-logo-mark.png"
              alt="EPPS Logo"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-bold text-[13px] text-sidebar-foreground tracking-tight">
              EPPS ITAM
            </span>
            <span className="text-[9.5px] uppercase tracking-[0.12em] text-sidebar-foreground/38 font-medium">
              Asset Management
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.url)}
                    render={
                      <Link href={item.url} className="flex items-center gap-2.5">
                        <item.icon className="size-4 shrink-0 opacity-75" />
                        <span className="text-[13px]">{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isTechOrManager && (
          <SidebarGroup>
            <SidebarGroupLabel>Reference Data</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {referenceItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.url)}
                      render={
                        <Link href={item.url} className="flex items-center gap-2.5">
                          <item.icon className="size-4 shrink-0 opacity-75" />
                          <span className="text-[13px]">{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.url)}
                      render={
                        <Link href={item.url} className="flex items-center gap-2.5">
                          <item.icon className="size-4 shrink-0 opacity-75" />
                          <span className="text-[13px]">{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
