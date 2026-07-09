"use client";

import * as React from "react";
import { useActionState, startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createRequestAction, type RequestActionState } from "@/lib/actions/requests";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type Option = { id: string; name: string };

export function RequestAssetDialog({
  categories,
  models,
}: {
  categories: Option[];
  models: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState<"model" | "category">("model");
  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(
    createRequestAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      if (state.emailError) {
        toast.warning(`Request created, but manager email failed: ${state.emailError}`, {
          duration: 6000,
        });
      } else {
        toast.success("Request submitted successfully!");
      }
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="size-4 mr-2" />Request Item</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Request an Item</DialogTitle>
            <DialogDescription>
              Submit an allocation request to your direct manager.
            </DialogDescription>
          </DialogHeader>

          {/* Request Type Selection */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="requestType">Request Type</Label>
            <Select
              value={requestType}
              onValueChange={(val) => setRequestType(val as "model" | "category")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="model">Specific Model</SelectItem>
                <SelectItem value="category">General Category</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Dropdown Selection */}
          {requestType === "model" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="modelId">Asset Model</Label>
              <Select name="modelId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
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
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select name="categoryId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity Input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
          </div>

          {/* Justification Textarea */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="justification">Justification</Label>
            <Textarea
              id="justification"
              name="justification"
              placeholder="Why do you need this item assigned to you?"
              className="min-h-[80px]"
              required
            />
          </div>

          <DialogFooter className="mt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
