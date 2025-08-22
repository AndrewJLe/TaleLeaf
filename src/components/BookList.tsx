"use client";

import Link from 'next/link';

type Book = {
    id: string;
    title: string;
    pages: number;
    createdAt: number;
    cover?: string;
};

export default function BookList({ books, selectedId, onSelect, onDelete }: any) {
    if (books.length === 0) {
        return null; // Handle empty state in parent component
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">📚</span>
                </div>
                <h3 className="text-lg font-semibold text-emerald-900">Your Books</h3>
                <div className="flex-1"></div>
                <div className="px-3 py-1.5 bg-emerald-100 rounded-full">
                    <span className="text-xs font-medium text-emerald-700">{books.length} book{books.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {books.map((book: Book) => (
                    <div key={book.id} className={`group bg-white/80 backdrop-blur-sm rounded-xl border border-emerald-200 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden ${selectedId === book.id ? 'ring-2 ring-emerald-500' : ''}`}>
                        <Link href={`/book/${book.id}`} className="block">
                            <div className="p-6">
                                {/* Book Cover or Placeholder */}
                                <div className="w-full h-32 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg mb-4 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                                    {book.cover ? (
                                        <img src={book.cover} alt={book.title} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        <span className="text-3xl text-emerald-600">📖</span>
                                    )}
                                </div>

                                {/* Book Info */}
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-emerald-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                                        {book.title}
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                                        <span className="flex items-center gap-1">
                                            📄 {book.pages} pages
                                        </span>
                                    </div>
                                    <div className="text-xs text-emerald-500">
                                        Added {new Date(book.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </Link>

                        {/* Actions */}
                        <div className="px-6 pb-6">
                            <div className="flex gap-2">
                                <Link href={`/book/${book.id}`} className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors text-center">📖 Read</Link>
                                <Link href={`/book/${book.id}?edit=1`} className="px-3 py-2 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-200 transition-colors" title="Edit settings">⚙️</Link>
                                <button onClick={() => onDelete(book.id)} className="px-3 py-2 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors" title="Delete book">🗑️</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
