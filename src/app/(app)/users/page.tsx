import Link from "next/link";
import { listUsersFull, listRoles, listUsers } from "@/lib/actions/users";
import { listDepartments } from "@/lib/actions/departments";
import { listLocations } from "@/lib/actions/locations";
import { UserDialog } from "./user-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Pencil, Users as UsersIcon } from "lucide-react";

export default async function UsersPage() {
  const [userList, roles, departments, locations, managers] = await Promise.all([
    listUsersFull(),
    listRoles(),
    listDepartments(),
    listLocations(),
    listUsers(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Users"
        description={`${userList.length} total`}
        actions={<UserDialog roles={roles} departments={departments} locations={locations} managers={managers} />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {userList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <UsersIcon className="size-8 opacity-40" />
                    <p className="text-sm">No users yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {userList.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <Link href={`/users/${u.id}`} className="hover:text-primary hover:underline">
                    {u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.username}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {u.roleName.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>{u.departmentName ?? "-"}</TableCell>
                <TableCell>{u.locationName ?? "-"}</TableCell>
                <TableCell>
                  {u.loginEnabled ? (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">
                      Disabled
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <UserDialog
                    roles={roles}
                    departments={departments}
                    locations={locations}
                    managers={managers}
                    editing={u}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
