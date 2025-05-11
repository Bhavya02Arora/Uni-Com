// app/myposts/layout.tsx
import { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
};

export default function MyPostsLayout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / Navbar */}
      {/* <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">Hi Bhavya 👋</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">
            Profile
          </button>
          <button className="px-4 py-2 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200">
            Logout
          </button>
        </div>
      </header> */}

      {/* Main Content */}
      <main className="pb-24">{children}</main> {/* 👈 Add bottom padding here */}

      {/* Footer */}
      {/* <footer className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-inner flex justify-center">
        <button className="px-6 py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600">
          Create Post
        </button>
      </footer> */}
    </div>
  );
}
