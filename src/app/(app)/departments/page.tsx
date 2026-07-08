import { listDepartments } from "@/lib/actions/departments";
import { listLocations } from "@/lib/actions/locations";
import { listUsers } from "@/lib/actions/users";
import { DepartmentDialog } from "./department-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default async function DepartmentsPage() {
  const [departments, locations, users] = await Promise.all([
    listDepartments(),
    listLocations(),
    listUsers(),
  ]);
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="text-muted-foreground text-sm">Organizational units within the company.</p>
        </div>
        <DepartmentDialog users={users} locations={locations} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Default Location</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No departments yet.
                </TableCell>
              </TableRow>
            )}
            {departments.map((dept) => {
              const manager = dept.managerId ? userById.get(dept.managerId) : undefined;
              return (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell>
                    {manager ? (manager.firstName ? `${manager.firstName} ${manager.lastName ?? ""}`.trim() : manager.email) : "—"}
                  </TableCell>
                  <TableCell>
                    {dept.defaultLocationId ? (locationById.get(dept.defaultLocationId)?.name ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <DepartmentDialog
                      users={users}
                      locations={locations}
                      editing={dept}
                      trigger={
                        <Button variant="ghost" size="icon" className="size-8">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
