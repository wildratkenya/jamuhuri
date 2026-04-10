import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Filter, Search } from "lucide-react";
import { useListBooks, getListBooksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Book } from "@workspace/api-client-react";
import { BookCatalogCard } from "@/components/books/book-catalog-card";
import { BookOrderDialog } from "@/components/books/book-order-dialog";
import bookCoverImg from "@assets/An_Introduction_to_Financial_Markets_1775134561365.png";

export default function Books() {
  const { data: books, isLoading } = useListBooks({ query: { queryKey: getListBooksQueryKey() } });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [initialOrderType, setInitialOrderType] = useState<"hardcopy" | "ebook">("hardcopy");
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const handleOrderClick = useCallback((book: Book, type: "hardcopy" | "ebook") => {
    setSelectedBook(book);
    setInitialOrderType(type);
    setIsOrderModalOpen(true);
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get("book");
    const orderType = urlParams.get("type") as "hardcopy" | "ebook" | null;

    if (bookId && orderType && books) {
      const book = books.find((b) => b.id === parseInt(bookId, 10));
      if (book) {
        handleOrderClick(book, orderType);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [books, handleOrderClick]);

  const filteredBooks = books?.filter(
    (book) =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="w-full pb-24">
      <section className="bg-secondary text-white pt-24 pb-32">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6">Publications & Books</h1>
            <p className="text-xl text-white/80 leading-relaxed">
              Explore the complete collection of Jamuhuri Gachoroba&apos;s works. Authoritative insights
              into money markets, economic trends, and personal finance.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="container mx-auto px-4 -mt-16">
        <div className="bg-background rounded-2xl shadow-xl border border-border/50 p-6 md:p-8 mb-12">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="Search books by title or topic..."
                className="pl-10 h-12 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground w-full md:w-auto justify-end">
              <Filter className="h-5 w-5" />
              <span className="font-medium">{filteredBooks?.length || 0} Books found</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[500px] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBooks?.map((book, i) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <BookCatalogCard
                  book={book}
                  coverFallback={bookCoverImg}
                  onOrderHardcopy={() => handleOrderClick(book, "hardcopy")}
                  onOrderEbook={() => handleOrderClick(book, "ebook")}
                  onOpenOrder={(type) => handleOrderClick(book, type)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <BookOrderDialog
        open={isOrderModalOpen}
        onOpenChange={setIsOrderModalOpen}
        book={selectedBook}
        initialOrderType={initialOrderType}
      />
    </div>
  );
}
