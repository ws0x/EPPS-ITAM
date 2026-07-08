"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAsset, updateAsset, type ActionState } from "@/lib/actions/assets";

type Option = { id: string; name: string };

export function AssetForm({
  models,
  statusLabels,
  locations,
  departments,
  editing,
}: {
  models: Option[];
  statusLabels: Option[];
  locations: Option[];
  departments: Option[];
  editing?: {
    id: string;
    assetTag: string;
    name: string | null;
    serial: string | null;
    modelId: string;
    statusId: string;
    locationId: string | null;
    departmentId: string | null;
    assignedToUserId: string | null;
    purchaseDate: string | null;
    purchaseCost: string | null;
    warrantyMonths: number | null;
    notes: string | null;
  };
}) {
  const action = editing ? updateAsset : createAsset;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {editing && <input type="hidden" name="id" value={editing.id} />}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="assetTag">Asset tag</Label>
            <Input id="assetTag" name="assetTag" defaultValue={editing?.assetTag} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="modelId">Model</Label>
            <Select name="modelId" defaultValue={editing?.modelId} required>
              <SelectTrigger id="modelId">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="serial">Serial</Label>
            <Input id="serial" name="serial" defaultValue={editing?.serial ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="statusId">Status</Label>
            <Select name="statusId" defaultValue={editing?.statusId} required>
              <SelectTrigger id="statusId">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {statusLabels.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="locationId">Location</Label>
            <Select name="locationId" defaultValue={editing?.locationId ?? undefined}>
              <SelectTrigger id="locationId">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="departmentId">Department</Label>
            <Select name="departmentId" defaultValue={editing?.departmentId ?? undefined}>
              <SelectTrigger id="departmentId">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="purchaseDate">Purchase date</Label>
            <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={editing?.purchaseDate ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="purchaseCost">Purchase cost (EGP)</Label>
            <Input id="purchaseCost" name="purchaseCost" type="number" step="0.01" defaultValue={editing?.purchaseCost ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="warrantyMonths">Warranty (months)</Label>
            <Input id="warrantyMonths" name="warrantyMonths" type="number" defaultValue={editing?.warrantyMonths ?? ""} />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : editing ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </form>
  );
}
