"use client";

import infra_config from '../../../public/infra_config.json';
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { formatDateTimeUTC, formatDateUTC } from "@/lib/utils"

// Default image mappings for each category
const DEFAULT_IMAGES: Record<string, string> = {
  SELL: "sell.png",
  ROOMMATE: "Roommate.png",
  CARPOOL: "carpool.png",
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
  status: string;
  // Roommate-specific fields
  community?: string;
  rent?: number;
  start_date?: string;
  gender_preference?: string;
  preferences?: string[]; // Added for tags like "Non-smoker"
  // Carpool-specific fields
  from_location?: string;
  to_location?: string;
  departure_time?: string;
  seats_available?: number;
  // Sell-specific fields
  item?: string;
  sub_category?: string;
}

export default function MyPostsPage() {
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
  const [userInfoCache, setUserInfoCache] = useState<Record<string, any>>({});

  const { signedUrlData } = useAuth();
  const CLOUDFRONT_HOST = infra_config.cloudfront_url;
  const API_URL = infra_config.api_url;

  // Helper function to get the image URL
  const getPostImage = (post: Post): string => {
    if (post.image_url && post.image_url.length > 0) {
      return post.image_url[0];
    }
    return DEFAULT_IMAGES[post.category] || "/images/default_placeholder.jpg";
  };

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

      const response = await fetch(
        `${API_URL}api/myposts/semanticsearch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            query: semanticSearchTerm,
          }),
        }
      );

      if (!response.ok) {
        console.error("Failed to perform semantic search", response.status);
        return;
      }

      const data = await response.json();
      let fetchedPosts: Post[] = Array.isArray(data) ? data : [];

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

      const uniqueOwners = Array.from(new Set(fetchedPosts.map((post: Post) => post.owner))) as string[];
      uniqueOwners.forEach((ownerEmail: string) => {
        fetchUserInfo(ownerEmail);
      });
    } catch (error) {
      console.error("Error performing semantic search:", error);
    } finally {
      setSemanticSearching(false);
    }
  };

  const fetchMyPosts = async () => {
    if (isSemanticSearch) return;

    try {
      setLoading(true);
      const idToken = localStorage.getItem("id_token");
      if (!idToken) {
        console.error("No ID token found");
        return;
      }

      const response = await fetch(
        `${API_URL}api/myposts?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(category)}&sort=${sortOrder}`,
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

  const handleDeletePost = async (postId: string) => {
    try {
      const idToken = localStorage.getItem("id_token");
      if (!idToken) {
        console.error("No ID token found");
        return;
      }

      const response = await fetch(`${API_URL}api/posts/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to delete post", response.status);
        return;
      }

      setPosts(posts.filter((post) => post._id !== postId));
      setSearchResults(searchResults.filter((post) => post._id !== postId));
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleUpdatePostStatus = async (postId: string, newStatus: string) => {
  try {
    const idToken = localStorage.getItem("id_token");
    if (!idToken) {
      console.error("No ID token found");
      return;
    }

    const response = await fetch(`${API_URL}api/posts/${postId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      console.error("Failed to update post status", response.status);
      return;
    }

    setPosts(
      posts.map((post) =>
        post._id === postId ? { ...post, status: newStatus } : post
      )
    );
    setSearchResults(
      searchResults.map((post) =>
        post._id === postId ? { ...post, status: newStatus } : post
      )
    );

    // Fix: Use selectedPost instead of post
    if (selectedPost && selectedPost._id === postId) {
      setSelectedPost({ ...selectedPost, status: newStatus });
    }
  } catch (error) {
    console.error("Error updating post status:", error);
  }
};

  

  useEffect(() => {
    if (!signedUrlData) return;
    fetchMyPosts();
  }, [page, limit, searchQuery, category, sortOrder, signedUrlData, isSemanticSearch]);

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

  const displayPosts = isSemanticSearch ? searchResults : posts;

  if (loading && !isSemanticSearch) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4 relative">
      <section className="max-w-6xl mx-auto p-4">
        <h2 className="text-2xl font-semibold mb-4">My Posts</h2>

        {/* Toggle between regular and semantic search */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setIsSemanticSearch(false)}
            className={`px-4 py-2 rounded-md ${
              !isSemanticSearch
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Regular Search
          </button>
          <button
            onClick={() => setIsSemanticSearch(true)}
            className={`px-4 py-2 rounded-md ${
              isSemanticSearch
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
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
              className="border p-2 rounded-l-md w-full max-w-md"
            />
            <button
              onClick={handleSemanticSearch}
              disabled={semanticSearching}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 disabled:bg-blue-300"
            >
              {semanticSearching ? "Searching..." : "Search"}
            </button>
            {searchResults.length > 0 && (
              <button
                onClick={resetSemanticSearch}
                className="ml-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
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
              placeholder="Search my posts..."
              className="border p-2 rounded-l-md w-full max-w-md"
            />
            <button
              onClick={() => {
                setPage(1);
                setSearchQuery(searchTerm);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
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
              className="border p-2 rounded-md"
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
              className="border p-2 rounded-md"
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
            const imageUrl = getPostImage(post);

            return (
              <div
                key={post._id}
                className={`border rounded-md overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition relative ${
                  post.status === "FAILED" ? "bg-red-300" : "bg-white"
                }`}
              >
                <div
                  className="h-48 w-full bg-gray-200"
                  onClick={() => setSelectedPost(post)}
                >
                  <img
                    src={imageUrl}
                    alt={post.title}
                    className="object-cover h-full w-full"
                    onError={(e) => (e.currentTarget.src = "/images/default_placeholder.jpg")}
                  />
                </div>
                <div className="p-4">
                  {/* Title and Category */}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold">{post.title}</h3>
                    <span className="text-xs uppercase bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      {post.category}
                    </span>
                  </div>

                  {/* Status */}
                  <p className="text-sm text-gray-500 mb-2">Status: {post.status}</p>

                  {/* Category-specific details */}
                  {post.category === "SELL" && (
                    <div className="text-gray-700 space-y-1">
                      {post.item && <p>Item: {post.item}</p>}
                      {post.price !== undefined && (
                        <p className="text-green-700 font-semibold text-lg">
                          ${post.price}
                        </p>
                      )}
                      {post.sub_category && (
                        <p>Subcategory: {post.sub_category}</p>
                      )}
                    </div>
                  )}
                  {post.category === "ROOMMATE" && (
                    <div className="text-gray-700 space-y-1">
                      {post.community && (
                        <p>Community: {post.community}</p>
                      )}
                      {post.rent !== undefined && (
                        <p className="text-green-700 font-semibold text-lg">
                          Rent: ${post.rent}
                        </p>
                      )}
                      {post.start_date && (
                        <p className="text-gray-700">
                          Start Date: {formatDateUTC(post.start_date)}
                        </p>
                      )}
                      {post.gender_preference && (
                        <p>
                          Gender Preference: {post.gender_preference}
                        </p>
                      )}
                      {/* Preferences Tags */}
                      {post.preferences && post.preferences.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {post.preferences.map((pref, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
                            >
                              {pref}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {post.category === "CARPOOL" && (
                    <div className="text-gray-700 space-y-1">
                      {post.from_location && (
                        <p>From: {post.from_location}</p>
                      )}
                      {post.to_location && (
                        <p>To: {post.to_location}</p>
                      )}
                      {post.departure_time && (
                        <p className="text-gray-700">
                          Departure: {formatDateTimeUTC(post.departure_time)}
                        </p>
                      )}
                      {post.seats_available !== undefined && (
                        <p>
                          Seats Available: {post.seats_available}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Posted By and User Info */}
                  <div className="mt-3">
                    <p className="text-sm text-gray-500">
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
                    {userInfo && (
                      <div className="text-sm text-gray-600 mt-1 space-y-1">
                        <p><strong>Name:</strong> {userInfo.name || "N/A"}</p>
                        <p><strong>College:</strong> {userInfo.college || "N/A"}</p>
                        <p><strong>Department:</strong> {userInfo.department || "N/A"}</p>
                      </div>
                    )}
                  </div>

                  {/* Post Management Buttons */}
                  <div className="mt-4 flex gap-2">
                    {post.status !== "CLOSED" && (
                      <button
                        onClick={() => handleUpdatePostStatus(post._id, "CLOSED")}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Close
                      </button>
                    )}
                    {post.status === "CLOSED" && (
                      <button
                        onClick={() => handleUpdatePostStatus(post._id, "PUBLISHED")}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePost(post._id)}
                      className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls - only show for regular search */}
        {!isSemanticSearch && (
          <div className="flex justify-between items-center mt-8">
            <button
              onClick={handlePrev}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <p className="text-gray-700">
              Page {page} of {Math.ceil(total / limit)}
            </p>
            <button
              onClick={handleNext}
              disabled={page * limit >= total}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Modal Popup */}
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
                className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Close
              </button>

              <h2 className="text-2xl font-bold mb-2">{selectedPost.title}</h2>
              <p className="text-gray-600 mb-4">{selectedPost.category}</p>
              <p className="text-gray-600 mb-4">Status: {selectedPost.status}</p>

              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {(selectedPost.image_url && selectedPost.image_url.length > 0
                  ? selectedPost.image_url
                  : [DEFAULT_IMAGES[selectedPost.category] || "/images/default_placeholder.jpg"]
                ).map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Image for ${selectedPost.title}`}
                    className="w-full max-w-xs h-64 object-cover rounded-md shadow-md"
                    onError={(e) => (e.currentTarget.src = "/images/default_placeholder.jpg")}
                  />
                ))}
              </div>

              {/* Category-specific details */}
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
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPost.preferences.map((pref, idx) => (
                        <span
                          key={idx}
                          className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded"
                        >
                          {pref}
                        </span>
                      ))}
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
                <div className="mt-4 text-gray-600 space-y-1">
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

              {/* Post Management Buttons in Modal */}
              <div className="mt-6 flex gap-2">
                {selectedPost.status !== "CLOSED" && (
                  <button
                    onClick={() => handleUpdatePostStatus(selectedPost._id, "CLOSED")}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Close
                  </button>
                )}
                {selectedPost.status === "CLOSED" && (
                  <button
                    onClick={() => handleUpdatePostStatus(selectedPost._id, "PUBLISHED")}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Publish
                  </button>
                )}
                <button
                  onClick={() => handleDeletePost(selectedPost._id)}
                  className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
