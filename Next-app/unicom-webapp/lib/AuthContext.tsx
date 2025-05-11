"use client";

import infra_config from '../public/infra_config.json';
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  getIdTokenFromUrl,
  storeIdToken,
  getStoredIdToken,
  isTokenExpired,
  redirectToLogin,
} from "@/lib/auth";

interface SignedUrlData {
  "CloudFront-Policy": string;
  "CloudFront-Signature": string;
  "CloudFront-Key-Pair-Id": string;
  expires: number;
}

interface User {
  email: string;
  sub: string;
  [key: string]: any;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  signedUrlData: SignedUrlData | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [signedUrlData, setSignedUrlData] = useState<SignedUrlData | null>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "redirecting">("loading");

  const API_URL = infra_config.api_url;

  useEffect(() => {
    const initializeToken = async () => {
      console.log("Initializing authentication...");
      const urlToken = getIdTokenFromUrl();
      const storedToken = getStoredIdToken();

      if (urlToken) {
        console.log("Found token in URL");
        storeIdToken(urlToken);
        setToken(urlToken);
        parseUserFromToken(urlToken);
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        setAuthStatus("authenticated");
      } else if (storedToken && !isTokenExpired(storedToken)) {
        console.log("Found valid token in storage");
        setToken(storedToken);
        parseUserFromToken(storedToken);
        setAuthStatus("authenticated");
      } else {
        console.log("No token found, redirecting to login");
        setAuthStatus("redirecting");
        setTimeout(() => {
          redirectToLogin();
        }, 1000); // 1 second delay just to show "Redirecting..." message
      }
    };

    initializeToken();
  }, []);

  const parseUserFromToken = (idToken: string) => {
    try {
      const payloadBase64 = idToken.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      setUser({
        email: decodedPayload.email,
        sub: decodedPayload.sub,
        ...decodedPayload,
      });
    } catch (err) {
      console.error("Failed to decode token:", err);
      setUser(null);
    }
  };

  useEffect(() => {
    const fetchSignedUrlData = async () => {
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/api/signedurl`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch signed URL");
        }

        const data = await response.json();
        localStorage.setItem("signedUrlData", JSON.stringify(data));
        setSignedUrlData(data);
      } catch (error) {
        console.error("Error fetching signed URL data:", error);
      }
    };

    const createOrUpdateUser = async () => {
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/api/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          throw new Error("Failed to create or update user");
        }

        console.log("User created or updated successfully");
      } catch (error) {
        console.error("Error creating/updating user:", error);
      }
    };

    if (token) {
      fetchSignedUrlData();
      createOrUpdateUser();
    }
  }, [token]);

  const isAuthenticated = !!token && !isTokenExpired(token);

  const handleSetToken = (newToken: string | null) => {
    if (newToken) {
      storeIdToken(newToken);
      setToken(newToken);
      parseUserFromToken(newToken);
    } else {
      localStorage.removeItem("id_token");
      localStorage.removeItem("signedUrlData");
      setToken(null);
      setUser(null);
      setSignedUrlData(null);
      redirectToLogin();
    }
  };

  // Handle different loading states nicely
  if (authStatus === "loading") {
    return <div>Loading authentication...</div>;
  }

  if (authStatus === "redirecting") {
    return <div>Redirecting to login...</div>;
  }

  return (
    <AuthContext.Provider value={{ token, user, setToken: handleSetToken, isAuthenticated, signedUrlData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
