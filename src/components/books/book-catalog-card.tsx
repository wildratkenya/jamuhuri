import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Monitor } from "lucide-react";
import type { Book } from "@workspace/api-client-react";

type BookCatalogCardProps = {
  book: Book;
  coverFallback?: string;
  onOrderHardcopy: () => void;
  onOrderEbook: () => void;
  /** Opens order dialog with default format (e.g. whole-card click on homepage) */
  onOpenOrder?: (type: "hardcopy" | "ebook") => void;
};

export function BookCatalogCard({
  book,
  coverFallback = "/images/book-cover-markets.png",
  onOrderHardcopy,
  onOrderEbook,
  onOpenOrder,
}: BookCatalogCardProps) {
  const showHard = book.type === "hardcopy" || book.type === "both";
  const showEbook = book.type === "ebook" || book.type === "both";

  const defaultType: "hardcopy" | "ebook" = showHard ? "hardcopy" : "ebook";

  const imageBlock = (
    <div className="aspect-[4/5] relative bg-muted overflow-hidden flex items-center justify-center p-6">
      <img
        src={book.coverImage || coverFallback}
        alt={book.title}
        className="object-contain w-full h-full drop-shadow-2xl group-hover:scale-105 transition-transform duration-500 pointer-events-none"
      />
      <div className="absolute top-3 right-3 flex gap-1 flex-col pointer-events-none">
        {showHard && (
          <Badge className="bg-orange-100 text-orange-800 border-none shadow-sm font-semibold text-xs">
            Hard Copy
          </Badge>
        )}
        {showEbook && (
          <Badge className="bg-blue-100 text-blue-800 border-none shadow-sm font-semibold text-xs">
            Digital
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <Card className="h-full flex flex-col group overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300">
      {onOpenOrder ? (
        <button
          type="button"
          className="text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]/50 rounded-t-xl"
          onClick={() => onOpenOrder(defaultType)}
          aria-label={`Open order details for ${book.title}`}
        >
          {imageBlock}
        </button>
      ) : (
        imageBlock
      )}

      <CardContent className="flex-1 flex flex-col p-5 bg-background z-10 relative">
        <div className="mb-1 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold tracking-wider text-primary uppercase">
            {book.category || "Finance"}
          </span>
          <span className="text-xs text-muted-foreground">• {book.publishedYear ?? "Recent"}</span>
          {book.isLatest && (
            <Badge className="bg-[#c9a227] text-[#0f2337] text-[10px] px-1.5 py-0">Latest</Badge>
          )}
        </div>
        <h3 className="font-serif text-xl font-bold mb-1.5 leading-snug">{book.title}</h3>
        {book.subtitle && (
          <h4 className="text-muted-foreground font-medium mb-2 italic text-sm">{book.subtitle}</h4>
        )}
        <p className="text-muted-foreground text-sm flex-1 mb-4 leading-snug line-clamp-3">{book.description}</p>

        <div className="border-t border-border/50 pt-4 mt-auto space-y-2">
          {showHard && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                <Package className="h-3 w-3 shrink-0 text-orange-600" />
                <span className="truncate">Hard copy</span>
              </span>
              <span className="font-mono font-semibold tabular-nums shrink-0">
                {book.hardcopyPrice != null
                  ? `${book.currency} ${book.hardcopyPrice.toLocaleString()}`
                  : "—"}
              </span>
            </div>
          )}
          {showEbook && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                <Monitor className="h-3 w-3 shrink-0 text-blue-600" />
                <span className="truncate">Digital</span>
              </span>
              <span className="font-mono font-semibold tabular-nums text-blue-700 shrink-0">
                {book.ebookPrice != null
                  ? `${book.currency} ${book.ebookPrice.toLocaleString()}`
                  : book.hardcopyPrice != null
                    ? `${book.currency} ${book.hardcopyPrice.toLocaleString()}`
                    : "—"}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {showHard && (
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOrderHardcopy();
                }}
                className="w-full text-sm h-10 py-0 bg-[#0f2337] hover:bg-[#0f2337]/90 text-white font-semibold gap-1.5"
              >
                <Package className="h-3.5 w-3.5" /> Order hard copy
              </Button>
            )}
            {showEbook && (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onOrderEbook();
                }}
                className="w-full text-sm h-10 py-0 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold gap-1.5"
              >
                <Monitor className="h-3.5 w-3.5" /> Order digital copy
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
