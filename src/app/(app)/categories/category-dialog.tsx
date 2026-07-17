"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategory, updateCategory, type ActionState } from "@/lib/actions/categories";
import { Plus } from "lucide-react";

export type CategoryRow = {
  id: string;
  name: string;
  type: "asset" | "license" | "consumable" | "accessory" | "component";
  requiresAcceptance: boolean;
  eulaText: string | null;
  codePrefix: string | null;
};

export function CategoryDialog({
  editing,
  trigger,
}: {
  editing?: CategoryRow;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = editing ? updateCategory : createCategory;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const wasPending = useRef(false);
  const [reqAccept, setReqAccept] = useState(editing?.requiresAcceptance ?? false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Add Category
            </Button>
          )
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              Define asset type grouping and automated tag prefixing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editing?.name} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              {editing ? (
                <>
                  <input type="hidden" name="type" value={editing.type} />
                  <Input defaultValue={editing.type} disabled className="capitalize" />
                </>
              ) : (
                <Select name="type" defaultValue="asset">
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="license">License</SelectItem>
                    <SelectItem value="consumable">Consumable</SelectItem>
                    <SelectItem value="accessory">Accessory</SelectItem>
                    <SelectItem value="component">Component</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="codePrefix">Code Prefix</Label>
              <Input
                id="codePrefix"
                name="codePrefix"
                defaultValue={editing?.codePrefix ?? ""}
                placeholder="e.g. LAP, MON"
                required
                maxLength={8}
                className="uppercase"
              />
              <span className="text-[10px] text-muted-foreground">
                Max 8 characters. Used for warehouse auto-tagging (e.g. LAP26-001).
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="requiresAcceptance"
                name="requiresAcceptance"
                value="true"
                checked={reqAccept}
                onCheckedChange={(checked) => setReqAccept(!!checked)}
              />
              <Label htmlFor="requiresAcceptance" className="font-normal cursor-pointer select-none">
                Requires user acceptance signature on checkout
              </Label>
            </div>

            {reqAccept && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="eulaText">End User License Agreement (EULA)</Label>
                <Textarea
                  id="eulaText"
                  name="eulaText"
                  defaultValue={editing?.eulaText ?? ""}
                  placeholder="Standard terms and conditions Assignee must sign off on..."
                  rows={4}
                />
              </div>
            )}

            {state?.error && (
              <p className="text-sm font-semibold text-destructive">{state.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
