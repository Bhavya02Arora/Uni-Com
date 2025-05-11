"use client";

import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white shadow-inner px-4 py-4">
      <div className="w-full">
        <Link href="/form">
          <button className="w-full py-3 bg-black text-white text-base font-semibold rounded-md shadow-md hover:bg-orange-500 transition">
            Create Post
          </button>
        </Link>
      </div>
    </footer>
  );
};