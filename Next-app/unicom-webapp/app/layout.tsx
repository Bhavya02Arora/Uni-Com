"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

// "use client"; // This marks the file as a client component

// import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
// import "./globals.css";

// import React, { useEffect } from "react";
// import { 
//   getIdTokenFromUrl, 
//   storeIdToken, 
//   getStoredIdToken, 
//   isTokenExpired, 
//   redirectToLogin 
// } from "@/lib/auth";

// // Define the type of the `children` prop
// interface AuthGuardProps {
//   children: React.ReactNode;
// }

// // AuthGuard component handles token retrieval, storage, and redirection
// const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
//   useEffect(() => {
//     // Retrieve token from URL if available (e.g., after a login redirect)
//     const urlToken = getIdTokenFromUrl();
//     // Retrieve token from localStorage if already stored
//     const storedToken = getStoredIdToken();

//     // If a token is found in the URL, store it in localStorage
//     if (urlToken) {
//       storeIdToken(urlToken);
//       // Clean the URL by removing the token
//       const cleanUrl = window.location.origin + window.location.pathname;
//       window.history.replaceState({}, document.title, cleanUrl);
//     }

//     // Use the token from the URL if available; otherwise, use the stored token
//     const tokenToUse = urlToken || storedToken;

//     // If no valid token is present or if it’s expired, redirect to login
//     if (!tokenToUse || isTokenExpired(tokenToUse)) {
//       redirectToLogin();
//     }
//   }, []); // Runs only once when the component mounts

//   return <>{children}</>;
// };

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="en">
//       <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
//         <AuthGuard>{children}</AuthGuard>
//       </body>
//     </html>
//   );
// }



