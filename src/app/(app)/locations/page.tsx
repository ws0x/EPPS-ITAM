import { listLocations } from "@/lib/actions/locations";
import { LocationDialog } from "./location-dialog";
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

export default async function LocationsPage() {
  const locations = await listLocations();
  const byId = new Map(locations.map((l) => [l.id, l]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="text-muted-foreground text-sm">
            Physical places — buildings, floors, rooms.
          </p>
        </div>
        <LocationDialog locations={locations} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No locations yet.
                </TableCell>
              </TableRow>
            )}
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>
                  {location.parentLocationId
                    ? (byId.get(location.parentLocationId)?.name ?? "—")
                    : "—"}
                </TableCell>
                <TableCell>{location.city ?? "—"}</TableCell>
                <TableCell>{location.state ?? "—"}</TableCell>
                <TableCell>
                  <LocationDialog
                    locations={locations}
                    editing={location}
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
