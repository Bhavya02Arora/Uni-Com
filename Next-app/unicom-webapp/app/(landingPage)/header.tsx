"use client";
import Image from "next/image";
import Link from "next/link";
import { logout } from "@/lib/auth";

const hasProfileImage = false; // set true if user has uploaded a profile image

export const Header = () => {
  return (
    <header className="h-16 w-full border-b border-gray-200 shadow-sm bg-white">
      <div className="flex items-center justify-between h-full">
        
        {/* Left side - Clickable Mascot and Title */}
        <Link href="/" className="pt-1 pl-4 pb-1 flex items-center gap-x-2 hover:opacity-90 transition">
          <Image src="/logo_tiger.png" height={70} width={65} alt="Mascot" />
          <h1 className="text-4xl font-extrabold text-orange-500 tracking-wide">UniCom</h1>
        </Link>

        {/* Right side - Nav Buttons + Profile */}
        <nav className="pr-6 flex items-center gap-x-4">
          <Link href="/feed" className="text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:bg-orange-50 hover:text-orange-600 transition">
            My Feed
          </Link>
          <Link href="/myposts" className="text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:bg-orange-50 hover:text-orange-600 transition">
            My Post
          </Link>
          <Link href="/features" className="text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:bg-orange-50 hover:text-orange-600 transition">
            Features
          </Link>
          

          <button
            onClick={logout}
            className="text-sm font-medium text-white bg-orange-500 px-4 py-2 rounded-md hover:bg-orange-600 transition"
          >
            Logout
          </button>

          {/* Profile Image or Default Icon */}
          <Link href="/profile" className="ml-2">
            {hasProfileImage ? (
              <Image
                src="/image.png"
                alt="Profile"
                width={40}
                height={40}
                className="rounded-full border-2 border-orange-300 hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-300 hover:scale-105 transition-transform">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 text-gray-500"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2a5 5 0 100 10 5 5 0 000-10zM4 20a8 8 0 0116 0v1H4v-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
};





// import Link from 'next/link';

// export function Header() {
//   return (
//     <header className="w-full bg-gray-200 shadow-md">
//       <div className="container mx-auto p-4">
//         <nav>
//           <ul className="flex justify-center gap-6">
//             <li>
//               <Link href="/">Home</Link>
//             </li>
//             <li>
//               <Link href="/about">About</Link>
//             </li>
//             <li>
//               <Link href="/contact">Contact</Link>
//             </li>
//           </ul>
//         </nav>
//       </div>
//     </header>
//   );
// }