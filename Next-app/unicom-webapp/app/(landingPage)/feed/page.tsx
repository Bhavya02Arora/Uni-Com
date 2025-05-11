"use client";

import infra_config from '../../../public/infra_config.json';
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { formatDateTimeUTC, formatDateUTC } from "@/lib/utils"

// Default images for categories (referencing local assets in public/images)
const DEFAULT_IMAGES: Record<string, string> = {
  CARPOOL: "carpool.png",
  ROOMMATE: "Roommate.png",
  SELL: "sell.png",
};

interface Post {
  _id: string;
  title: string;
  price?: number;
  location?: string;
  image_url?: string[];
  category: string;
  owner: string;
  description?: string;
  // Roommate-specific fields
  community?: string;
  rent?: number;
  start_date?: string;
  gender_preference?: string;
  preferences?: string[];
  // Carpool-specific fields
  from_location?: string;
  to_location?: string;
  departure_time?: string;
  seats_available?: number;
  // Sell-specific fields
  item?: string;
  sub_category?: string;
  // Interaction metrics (optional, add if supported by backend)
  likes?: number;
}

export default function MyFeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(9);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [semanticSearchTerm, setSemanticSearchTerm] = useState("");
  const [semanticSearching, setSemanticSearching] = useState(false);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [userInfoCache, setUserInfoCache] = useState<Record<string, any>>({});
  
  const { signedUrlData } = useAuth();
  const CLOUDFRONT_HOST = infra_config.cloudfront_url;
  const API_URL = infra_config.api_url;

  function buildSignedImageUrl(baseImageUrl: string, signedUrlData: any): string {
    const url = new URL(baseImageUrl);
    url.searchParams.set("Policy", signedUrlData["CloudFront-Policy"]);
    url.searchParams.set("Signature", signedUrlData["CloudFront-Signature"]);
    url.searchParams.set("Key-Pair-Id", signedUrlData["CloudFront-Key-Pair-Id"]);
    return url.toString();
  }

  const fetchUserInfo = async (email: string) => {
    if (userInfoCache[email]) return;

    try {
      const idToken = localStorage.getItem("id_token");
      if (!idToken) {
        console.error("No ID token found");
        return;
      }

      const response = await fetch(
        `${API_URL}api/users/${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to fetch user info", response.status);
        return;
      }

      const data = await response.json();
      setUserInfoCache((prev) => ({ ...prev, [email]: data }));
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const handleSemanticSearch = async () => {
    if (!semanticSearchTerm.trim()) return;
  
    try {
      setSemanticSearching(true);
      const idToken = localStorage.getItem("id_token");
      if (!idToken) {
        console.error("No ID token found");
        return;
      }
  
      const response = await fetch(`${API_URL}api/posts/semanticsearch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          query: semanticSearchTerm,
        }),
      });
  
      if (!response.ok) {
        console.error("Failed to perform semantic search", response.status);
        return;
      }
  
      const data = await response.json();
      let fetchedPosts: Post[] = (data as Post[]) || [];
  
      fetchedPosts = fetchedPosts.map((post: Post) => {
        if (post.image_url && post.image_url.length > 0 && signedUrlData) {
          const updatedUrls = post.image_url.map((url) => {
            try {
              const parsedUrl = new URL(url);
              const cloudfrontUrl = CLOUDFRONT_HOST + parsedUrl.pathname.replace(/^\/+/, "");
              return buildSignedImageUrl(cloudfrontUrl, signedUrlData);
            } catch {
              return url;
            }
          });
          return { ...post, image_url: updatedUrls };
        }
        return post;
      });
  
      setSearchResults(fetchedPosts);
      setIsSemanticSearch(true);
  
      const uniqueOwners = Array.from(new Set(fetchedPosts.map((post: Post) => post.owner)));
      uniqueOwners.forEach((ownerEmail) => {
        fetchUserInfo(ownerEmail);
      });
    } catch (error) {
      console.error("Error performing semantic search:", error);
    } finally {
      setSemanticSearching(false);
    }
  };

  useEffect(() => {
    if (!signedUrlData) return;

    const fetchPosts = async () => {
      if (isSemanticSearch) return;
      
      try {
        setLoading(true);
        const idToken = localStorage.getItem("id_token");
        if (!idToken) {
          console.error("No ID token found");
          return;
        }

        const response = await fetch(
          `${API_URL}api/posts?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(category)}&sort=${sortOrder}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        if (!response.ok) {
          console.error("Failed to fetch posts", response.status);
          return;
        }

        const data = await response.json();
        let fetchedPosts = (data.posts as Post[]) || [];
        setTotal(data.total || 0);

        fetchedPosts = fetchedPosts.map((post: Post) => {
          if (post.image_url && post.image_url.length > 0 && signedUrlData) {
            const updatedUrls = post.image_url.map((url) => {
              try {
                const parsedUrl = new URL(url);
                const cloudfrontUrl = CLOUDFRONT_HOST + parsedUrl.pathname.replace(/^\/+/, "");
                return buildSignedImageUrl(cloudfrontUrl, signedUrlData);
              } catch {
                return url;
              }
            });
            return { ...post, image_url: updatedUrls };
          }
          return post;
        });

        setPosts(fetchedPosts);

        const uniqueOwners = Array.from(new Set(fetchedPosts.map((post) => post.owner)));
        uniqueOwners.forEach((ownerEmail) => {
          fetchUserInfo(ownerEmail);
        });

      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [page, limit, searchQuery, category, sortOrder, signedUrlData, isSemanticSearch]);

  // Back to Top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNext = () => {
    if (page * limit < total) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const closeModal = () => setSelectedPost(null);

  const resetSemanticSearch = () => {
    setIsSemanticSearch(false);
    setSearchResults([]);
    setSemanticSearchTerm("");
  };

  const handleLike = (postId: string) => {
    setLikedPosts((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    );
  };

  const displayPosts = isSemanticSearch ? searchResults : posts;

  if (loading && !isSemanticSearch) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 relative">
      <section className="max-w-6xl mx-auto p-4">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">My Feed</h2>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setIsSemanticSearch(false)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              !isSemanticSearch
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Regular Search
          </button>
          <button
            onClick={() => setIsSemanticSearch(true)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isSemanticSearch
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Semantic Search
          </button>
        </div>

        {isSemanticSearch ? (
          <div className="flex items-center mb-6">
            <input
              type="text"
              value={semanticSearchTerm}
              onChange={(e) => setSemanticSearchTerm(e.target.value)}
              placeholder="Describe what you're looking for (e.g. 'room near campus with parking')"
              className="border p-2 rounded-l-md w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSemanticSearch}
              disabled={semanticSearching}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
            >
              {semanticSearching ? "Searching..." : "Search"}
            </button>
            {searchResults.length > 0 && (
              <button
                onClick={resetSemanticSearch}
                className="ml-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center mb-6">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search posts..."
              className="border p-2 rounded-l-md w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                setPage(1);
                setSearchQuery(searchTerm);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 transition-colors"
            >
              Search
            </button>
          </div>
        )}

        {!isSemanticSearch && (
          <div className="flex flex-wrap gap-4 mb-6">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="border p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="SELL">Sell</option>
              <option value="ROOMMATE">Roommate</option>
              <option value="CARPOOL">Carpool</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPage(1);
              }}
              className="border p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        )}

        {isSemanticSearch && searchResults.length === 0 && semanticSearchTerm && !semanticSearching && (
          <div className="text-center py-8 text-gray-500">
            No results found for your search. Try different keywords or phrasing.
          </div>
        )}

        {semanticSearching && (
          <div className="text-center py-8 text-gray-500">
            Searching for posts matching your description...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayPosts.map((post) => {
            const userInfo = userInfoCache[post.owner];
            const isLiked = likedPosts.includes(post._id);
            const imageSrc = post.image_url && post.image_url.length > 0
              ? post.image_url[0]
              : DEFAULT_IMAGES[post.category] || "/images/default.png";

            return (
              <div
                key={post._id}
                className="border rounded-lg overflow-hidden shadow-sm bg-white cursor-pointer hover:shadow-lg transition-shadow duration-300"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".like-button")) return;
                  setSelectedPost(post);
                }}
              >
                <div className="relative">
                  <img
                    src={imageSrc}
                    alt={post.title}
                    className="object-cover h-48 w-full"
                    loading="lazy"
                  />
                  <button
                    aria-label={isLiked ? "Unlike post" : "Like post"}
                    className="like-button absolute top-2 right-2 p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(post._id);
                    }}
                  >
                    <svg
                      className={`w-6 h-6 ${isLiked ? "fill-red-500" : "fill-gray-400"}`}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">{post.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full text-white ${
                      post.category === "CARPOOL" ? "bg-blue-500" :
                      post.category === "ROOMMATE" ? "bg-green-500" :
                      "bg-purple-500"
                    }`}>
                      {post.category}
                    </span>
                  </div>

                  {post.category === "SELL" && (
                    <>
                      {post.item && <p className="text-gray-600 text-sm">Item: {post.item}</p>}
                      {post.price !== undefined && (
                        <p className="text-green-600 font-semibold text-sm mt-1">${post.price}</p>
                      )}
                      {post.sub_category && (
                        <p className="text-gray-600 text-sm">Subcategory: {post.sub_category}</p>
                      )}
                      {post.location && (
                        <p className="text-gray-600 text-sm">
                          <strong>Location:</strong> {post.location}
                        </p>
                      )}
                    </>
                  )}
                  {post.category === "ROOMMATE" && (
                    <>
                      {post.community && (
                        <p className="text-gray-600 text-sm">Community: {post.community}</p>
                      )}
                      {post.rent !== undefined && (
                        <p className="text-green-600 font-semibold text-sm mt-1">Rent: ${post.rent}</p>
                      )}
                      {post.start_date && (
                        <p className="text-gray-700">
                          Start Date: {formatDateUTC(post.start_date)}
                        </p>
                      )}
                      {post.gender_preference && (
                        <p className="text-gray-600 text-sm">
                          Gender Preference: {post.gender_preference}
                        </p>
                      )}
                      {post.preferences && post.preferences.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {post.preferences.map((pref, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                            >
                              {pref}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {post.category === "CARPOOL" && (
                    <>
                      {post.from_location && (
                        <p className="text-gray-600 text-sm">
                          <strong>From:</strong> {post.from_location}
                        </p>
                      )}
                      {post.to_location && (
                        <p className="text-gray-600 text-sm">
                          <strong>To:</strong> {post.to_location}
                        </p>
                      )}
                      {post.departure_time && (
                        <p className="text-gray-700">
                          Departure: {formatDateTimeUTC(post.departure_time)}
                        </p>
                      )}
                      {post.seats_available !== undefined && (
                        <p className="text-gray-600 text-sm">
                          Seats Available: {post.seats_available}
                        </p>
                      )}
                    </>
                  )}

                  <div className="flex justify-between items-center mt-3">
                    <p className="text-xs text-gray-500">
                      Posted by{" "}
                      <a
                        href={`https://contacts.google.com/${encodeURIComponent(post.owner)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {post.owner}
                      </a>
                    </p>
                  </div>

                  {userInfo && (
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      <div><strong>Name:</strong> {userInfo.name || "N/A"}</div>
                      <div><strong>College:</strong> {userInfo.college || "N/A"}</div>
                      <div><strong>Department:</strong> {userInfo.department || "N/A"}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!isSemanticSearch && (
          <div className="flex justify-between items-center mt-8">
            <button
              onClick={handlePrev}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <p className="text-gray-700">
              Page {page} of {Math.ceil(total / limit)}
            </p>
            <button
              onClick={handleNext}
              disabled={page * limit >= total}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Create Post Button */}
      <button
        onClick={() => {/* Add navigation logic to create post page */}}
        className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-blue-800 transition-colors"
      >
        Create Post
      </button>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-16 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 w-full md:w-1/2 h-full bg-white shadow-2xl z-50 overflow-auto"
          >
            <div className="p-6">
              <button
                onClick={closeModal}
                className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedPost.title}</h2>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full text-white mb-4 ${
                selectedPost.category === "CARPOOL" ? "bg-blue-500" :
                selectedPost.category === "ROOMMATE" ? "bg-green-500" :
                "bg-purple-500"
              }`}>
                {selectedPost.category}
              </span>

              {selectedPost.image_url && selectedPost.image_url.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {selectedPost.image_url.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Image ${idx + 1}`}
                      className="w-100 h-100 object-cover rounded-md shadow-md"
                    />
                  ))}
                </div>
              )}

              {selectedPost.category === "SELL" && (
                <div className="mt-4 text-gray-700 space-y-1">
                  {selectedPost.item && <p><strong>Item:</strong> {selectedPost.item}</p>}
                  {selectedPost.price !== undefined && (
                    <p className="text-green-700 font-semibold">
                      <strong>Price:</strong> ${selectedPost.price}
                    </p>
                  )}
                  {selectedPost.sub_category && (
                    <p><strong>Subcategory:</strong> {selectedPost.sub_category}</p>
                  )}
                  {selectedPost.location && (
                    <p><strong>Location:</strong> {selectedPost.location}</p>
                  )}
                </div>
              )}
              {selectedPost.category === "ROOMMATE" && (
                <div className="mt-4 text-gray-700 space-y-1">
                  {selectedPost.community && (
                    <p><strong>Community:</strong> {selectedPost.community}</p>
                  )}
                  {selectedPost.rent !== undefined && (
                    <p className="text-green-700 font-semibold">
                      <strong>Rent:</strong> ${selectedPost.rent}
                    </p>
                  )}
                  {selectedPost.start_date && (
                    <p>
                      <strong>Start Date:</strong>{" "}
                      {formatDateUTC(selectedPost.start_date)}
                    </p>
                  )}
                  {selectedPost.gender_preference && (
                    <p>
                      <strong>Gender Preference:</strong> {selectedPost.gender_preference}
                    </p>
                  )}
                  {selectedPost.preferences && selectedPost.preferences.length > 0 && (
                    <div className="mt-2">
                      <p><strong>Preferences:</strong></p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPost.preferences.map((pref, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-sm rounded-full"
                          >
                            {pref}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedPost.category === "CARPOOL" && (
                <div className="mt-4 text-gray-700 space-y-1">
                  {selectedPost.from_location && (
                    <p><strong>From:</strong> {selectedPost.from_location}</p>
                  )}
                  {selectedPost.to_location && (
                    <p><strong>To:</strong> {selectedPost.to_location}</p>
                  )}
                  {selectedPost.departure_time && (
                    <p>
                      <strong>Departure:</strong>{" "}
                      {formatDateTimeUTC(selectedPost.departure_time)}
                    </p>
                  )}
                  {selectedPost.seats_available !== undefined && (
                    <p>
                      <strong>Seats Available:</strong> {selectedPost.seats_available}
                    </p>
                  )}
                </div>
              )}

              <p className="text-gray-500 mt-2">
                Posted by:{" "}
                <a
                  href={`https://contacts.google.com/${encodeURIComponent(selectedPost.owner)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {selectedPost.owner}
                </a>
              </p>

              {userInfoCache[selectedPost.owner] && (
                <div className="mt-4 text-gray-700 space-y-1">
                  <div><strong>Name:</strong> {userInfoCache[selectedPost.owner].name || "N/A"}</div>
                  <div><strong>College:</strong> {userInfoCache[selectedPost.owner].college || "N/A"}</div>
                  <div><strong>Department:</strong> {userInfoCache[selectedPost.owner].department || "N/A"}</div>
                </div>
              )}

              {selectedPost.description && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-gray-700">{selectedPost.description}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}