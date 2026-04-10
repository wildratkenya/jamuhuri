import { useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Monitor } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateOrder } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import type { Book } from "@workspace/api-client-react";

const orderSchema = z
  .object({
    customerName: z.string().min(2, "Name is required"),
    customerEmail: z.string().email("Valid email is required"),
    orderType: z.enum(["hardcopy", "ebook"]),
    quantity: z.preprocess(
      (v) => {
        const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
        return Number.isFinite(n) && n > 0 ? n : 1;
      },
      z.number().int().min(1).max(99),
    ),
    customerPhone: z.string().optional(),
    deliveryAddress: z.string().optional(),
    deliveryCity: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === "hardcopy") {
      if (!data.customerPhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone required for delivery",
          path: ["customerPhone"],
        });
      }
      if (!data.deliveryAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Address required for delivery",
          path: ["deliveryAddress"],
        });
      }
    }
  });

type BookOrderFormValues = z.infer<typeof orderSchema>;

type BookOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book | null;
  initialOrderType: "hardcopy" | "ebook";
};

export function BookOrderDialog({ open, onOpenChange, book, initialOrderType }: BookOrderDialogProps) {
  const createOrder = useCreateOrder();
  const { toast } = useToast();

  const form = useForm<BookOrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      orderType: initialOrderType,
      quantity: 1,
      customerPhone: "",
      deliveryAddress: "",
      deliveryCity: "",
    },
  });

  useEffect(() => {
    if (open && book) {
      form.reset({
        customerName: "",
        customerEmail: "",
        orderType: initialOrderType,
        quantity: 1,
        customerPhone: "",
        deliveryAddress: "",
        deliveryCity: "",
      });
    }
  }, [open, book, initialOrderType, form]);

  const watchOrderType = form.watch("orderType");
  const quantity = form.watch("quantity");

  const unitHardcopy =
    book?.hardcopyPrice != null && Number.isFinite(book.hardcopyPrice) ? book.hardcopyPrice : null;
  const unitEbook =
    book?.ebookPrice != null && Number.isFinite(book.ebookPrice) ? book.ebookPrice : null;

  const hardcopyLineTotal =
    watchOrderType === "hardcopy" && unitHardcopy != null ? unitHardcopy * (quantity || 1) : null;

  const onSubmit = (values: BookOrderFormValues) => {
    if (!book) return;

    let notes: string | undefined;
    if (values.orderType === "hardcopy") {
      if (unitHardcopy != null) {
        const subtotal = unitHardcopy * values.quantity;
        notes = [
          `Copies: ${values.quantity}`,
          `Unit price: ${book.currency} ${unitHardcopy.toLocaleString()}`,
          `Subtotal: ${book.currency} ${subtotal.toLocaleString()}`,
        ].join(" · ");
      } else {
        notes = `Copies requested: ${values.quantity}`;
      }
    }

    createOrder.mutate(
      {
        data: {
          bookId: book.id,
          bookTitle: book.title,
          orderType: values.orderType,
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          deliveryAddress: values.deliveryAddress,
          deliveryCity: values.deliveryCity,
          notes,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Order placed successfully",
            description: "We will contact you shortly regarding your order.",
          });
          onOpenChange(false);
          form.reset();
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Order failed",
            description: "There was a problem placing your order. Please try again.",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-secondary p-6 text-white shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">Order details</DialogTitle>
            <DialogDescription className="text-white/70">
              You are ordering:{" "}
              <span className="font-bold text-primary">{book?.title}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
                {watchOrderType === "hardcopy" ? (
                  <Package className="h-4 w-4 text-[#0f2337] shrink-0" />
                ) : (
                  <Monitor className="h-4 w-4 text-blue-600 shrink-0" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Format
                  </p>
                  <p className="font-bold text-foreground text-sm">
                    {watchOrderType === "hardcopy"
                      ? "Hard copy (physical delivery)"
                      : "Digital copy (sent by email)"}
                  </p>
                </div>
              </div>

              {watchOrderType === "hardcopy" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4 border-t border-border/50 pt-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of copies</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              className="tabular-nums"
                              {...field}
                              value={field.value ?? 1}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const n = parseInt(raw, 10);
                                field.onChange(Number.isFinite(n) ? n : 1);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Estimated book total</p>
                      {unitHardcopy != null && hardcopyLineTotal != null ? (
                        <p className="font-mono font-semibold tabular-nums">
                          {book?.currency} {unitHardcopy.toLocaleString()} × {quantity || 1} ={" "}
                          {book?.currency} {hardcopyLineTotal.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Price on request</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-foreground">
                      <strong className="text-primary">Note:</strong> Payment is collected on delivery
                      via M-PESA. Shipping charges apply based on your location and courier rates.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone number</FormLabel>
                          <FormControl>
                            <Input placeholder="+254…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deliveryCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City / town</FormLabel>
                          <FormControl>
                            <Input placeholder="Nairobi" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="deliveryAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street, building, office…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>
              )}

              {watchOrderType === "ebook" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-primary/10 p-3 rounded-lg border border-primary/20"
                >
                  <p className="text-sm font-medium text-foreground">
                    <strong className="text-primary">E-book delivery:</strong> Payment instructions
                    will be sent to your email. Upon payment confirmation, the digital copy will be
                    delivered to your inbox.
                    {unitEbook != null && (
                      <span className="block mt-2 font-mono">
                        {book?.currency} {unitEbook.toLocaleString()} per copy
                      </span>
                    )}
                  </p>
                </motion.div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createOrder.isPending} className="px-8">
                  {createOrder.isPending ? "Processing…" : "Confirm order"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
