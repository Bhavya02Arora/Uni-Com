'use client';

import infra_config from '../../../public/infra_config.json';
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";

export default function ListingForm() {
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [customPreference, setCustomPreference] = useState("");
  const [customPreferences, setCustomPreferences] = useState<string[]>([]);
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();
  const API_URL = `${infra_config.api_url}/api/posts`;

  useEffect(() => {
    console.log("Token from context:", token);
    console.log("Is authenticated:", isAuthenticated);
  }, [token, isAuthenticated]);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = (error) => reject(error);
    });

  const handlePreferenceToggle = (preference: string) => {
    if (selectedPreferences.includes(preference)) {
      setSelectedPreferences(selectedPreferences.filter((p) => p !== preference));
    } else {
      setSelectedPreferences([...selectedPreferences, preference]);
    }
  };

  const handleAddCustomPreference = () => {
    const trimmed = customPreference.trim();
    if (trimmed && !customPreferences.includes(trimmed)) {
      setCustomPreferences([...customPreferences, trimmed]);
      setCustomPreference("");
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!category) {
      newErrors.category = "Please select a category";
    }

    if (category === "ROOMMATE") {
      const description = (document.getElementById("description") as HTMLTextAreaElement)?.value;
      const apartmentName = (document.getElementById("apartmentName") as HTMLInputElement)?.value;
      const dateAvailability = (document.getElementById("dateAvailability") as HTMLInputElement)?.value;
      const rent = (document.getElementById("rent") as HTMLInputElement)?.value;

      if (!description) {
        newErrors.description = "Description is required";
      }
      if (!apartmentName) {
        newErrors.apartmentName = "Community/apartment name is required";
      }
      if (!dateAvailability) {
        newErrors.dateAvailability = "Start date is required";
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateAvailability)) {
          newErrors.dateAvailability = "Invalid date format (YYYY-MM-DD)";
        } else {
          const selected = new Date(dateAvailability);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected < today) {
            newErrors.dateAvailability = "Start date cannot be in the past";
          }
        }
      }
      if (!rent || isNaN(Number(rent)) || Number(rent) < 0) {
        newErrors.rent = "Rent must be a positive number";
      }
    }
    else if (category === "CARPOOL") {
      const pickupLocation = (document.getElementById("pickupLocation") as HTMLInputElement)?.value;
      const dropoffLocation = (document.getElementById("dropoffLocation") as HTMLInputElement)?.value;
      const rideDateVal = (document.getElementById("rideDate") as HTMLInputElement)?.value;
      const rideTimeVal = (document.getElementById("rideTime") as HTMLInputElement)?.value;
      const availableSeats = (document.getElementById("availableSeats") as HTMLInputElement)?.value;

      if (!pickupLocation) {
        newErrors.pickupLocation = "Pickup location is required";
      }
      if (!dropoffLocation) {
        newErrors.dropoffLocation = "Drop-off location is required";
      }
      if (!rideDateVal) {
        newErrors.rideDate = "Ride date is required";
      }
      if (!rideTimeVal) {
        newErrors.rideTime = "Ride time is required";
      }
      if (!availableSeats || isNaN(Number(availableSeats)) || Number(availableSeats) < 1) {
        newErrors.availableSeats = "At least 1 seat must be available";
      }
    }
    else if (category === "SELL") {
      const title = (document.getElementById("title") as HTMLInputElement)?.value;
      const itemName = (document.getElementById("itemName") as HTMLInputElement)?.value;
      const itemDescription = (document.getElementById("itemDescription") as HTMLTextAreaElement)?.value;
      const itemPrice = (document.getElementById("itemPrice") as HTMLInputElement)?.value;
      const subCategory = (document.getElementById("subCategory") as HTMLSelectElement)?.value;

      if (!title) newErrors.title = "Title is required";
      if (!itemName) newErrors.itemName = "Item name is required";
      if (!itemDescription) newErrors.itemDescription = "Item description is required";
      if (!itemPrice || isNaN(Number(itemPrice)) || Number(itemPrice) < 0) {
        newErrors.itemPrice = "Price must be a positive number";
      }
      if (!subCategory) newErrors.subCategory = "Sub-category is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isAuthenticated) {
      alert("You are not authenticated. Please log in again.");
      router.push("/login");
      return;
    }
    if (!validateForm()) return;

    const formData: any = { category, images: [] };
    const images: string[] = [];

    if (category === "ROOMMATE") {
      formData.title = "Looking for a roommate";
      formData.description = (document.getElementById("description") as HTMLTextAreaElement)?.value;
      formData.community = (document.getElementById("apartmentName") as HTMLInputElement)?.value;
      formData.start_date = (document.getElementById("dateAvailability") as HTMLInputElement)?.value;
      formData.rent = parseFloat((document.getElementById("rent") as HTMLInputElement)?.value || "0");
      formData.preferences = [...selectedPreferences, ...customPreferences];
      formData.gender_preference = (document.getElementById("genderPreference") as HTMLSelectElement)?.value || "ANY";
      const files = (document.getElementById("uploadImagesRoommate") as HTMLInputElement)?.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          images.push(await toBase64(files[i]));
        }
      }
    }
    else if (category === "CARPOOL") {
      formData.title = "Carpool ride available";
      formData.from_location = (document.getElementById("pickupLocation") as HTMLInputElement)?.value;
      formData.to_location = (document.getElementById("dropoffLocation") as HTMLInputElement)?.value;
      formData.departure_time = `${rideDate}T${rideTime}:00`;
      formData.seats_available = parseInt((document.getElementById("availableSeats") as HTMLInputElement)?.value || "1");
      formData.description = "";
    }
    else if (category === "SELL") {
      formData.title = (document.getElementById("title") as HTMLInputElement)?.value;
      formData.description = (document.getElementById("itemDescription") as HTMLTextAreaElement)?.value;
      formData.item = (document.getElementById("itemName") as HTMLInputElement)?.value;
      formData.price = parseFloat((document.getElementById("itemPrice") as HTMLInputElement)?.value || "0");
      formData.sub_category = (document.getElementById("subCategory") as HTMLSelectElement)?.value;
      const files = (document.getElementById("uploadImagesSell") as HTMLInputElement)?.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          images.push(await toBase64(files[i]));
        }
      }
    }

    formData.images = images;
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (response.status === 202) {
        alert("Listing submitted successfully and is under moderation!");
        router.push("/myposts");
      } else {
        const result = await response.json();
        alert("Error: " + (result.error || "Unknown error occurred"));
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong while submitting the post.");
    }
  };

  const renderError = (field: string) =>
    errors[field] ? <p className="text-red-500 text-sm mt-1">{errors[field]}</p> : null;

  return (
    <Card className="max-w-3xl mx-auto mt-10">
      <CardHeader>
        <CardTitle>Create Listing</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          {/* Category selector */}
          <div className="mb-6">
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`mt-1 block w-full border ${errors.category ? "border-red-500" : "border-gray-300"
                } rounded-md shadow-sm focus:border-[#f76902] focus:ring-[#f76902]`}
            >
              <option value="">Select a category</option>
              <option value="ROOMMATE">Roommate Finder</option>
              <option value="CARPOOL">Carpool</option>
              <option value="SELL">Sell Item</option>
            </select>
            {renderError("category")}
          </div>

          {/* Form + Illustration */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Form fields */}
            <div className="flex-1 space-y-6">
              {category === "ROOMMATE" && (
                <>
                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      className={`mt-1 block w-full border ${errors.description ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-[#f76902] focus:ring-[#f76902]`}
                    />
                    {renderError("description")}
                  </div>

                  {/* Community */}
                  <div>
                    <label htmlFor="apartmentName" className="block text-sm font-medium text-gray-700">
                      Community
                    </label>
                    <input
                      type="text"
                      id="apartmentName"
                      className={`mt-1 block w-full border ${errors.apartmentName ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-[#f76902] focus:ring-[#f76902]`}
                    />
                    {renderError("apartmentName")}
                  </div>

                  {/* Start Date */}
                  <div>
                    <label htmlFor="dateAvailability" className="block text-sm font-medium text-gray-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="dateAvailability"
                      min={new Date().toISOString().split("T")[0]}
                      className={`mt-1 block w-full border ${errors.dateAvailability ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-[#f76902] focus:ring-[#f76902]`}
                    />
                    {renderError("dateAvailability")}
                  </div>

                  {/* Rent */}
                  <div>
                    <label htmlFor="rent" className="block text-sm font-medium text-gray-700">
                      Rent
                    </label>
                    <input
                      type="number"
                      id="rent"
                      min="0"
                      step="0.01"
                      className={`mt-1 block w-full border ${errors.rent ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-[#f76902] focus:ring-[#f76902]`}
                    />
                    {renderError("rent")}
                  </div>

                  {/* Preferences */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Preferences</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {["Non-smoker", "Pet-friendly", "Cooking-enthusiast"].map((pref) => (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => handlePreferenceToggle(pref)}
                          className={`px-3 py-1 rounded-full border ${selectedPreferences.includes(pref)
                            ? "bg-[#f76902] text-white"
                            : "bg-gray-100 text-gray-700"
                            }`}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Preference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Add Custom Preference</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={customPreference}
                        onChange={(e) => setCustomPreference(e.target.value)}
                        placeholder="Enter custom preference"
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:border-[#f76902] focus:ring-[#f76902]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomPreference}
                        className="px-3 py-1 bg-[#f76902] text-white rounded-md hover:bg-[#db5d00]"
                      >
                        Add
                      </button>
                    </div>
                    {customPreferences.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {customPreferences.map((pref, i) => (
                          <span key={i} className="px-3 py-1 bg-[#f76902]/20 text-[#f76902] rounded-full text-sm">
                            {pref}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gender Preference */}
                  <div>
                    <label htmlFor="genderPreference" className="block text-sm font-medium text-gray-700">
                      Gender Preference
                    </label>
                    <select
                      id="genderPreference"
                      className={`mt-1 block w-full border ${errors.genderPreference ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-[#f76902] focus:ring-[#f76902]`}
                    >
                      <option value="ANY">Any</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>

                  {/* Upload Images */}
                  <div>
                    <label htmlFor="uploadImagesRoommate" className="block text-sm font-medium text-gray-700">
                      Upload Images
                    </label>
                    <input
                      type="file"
                      id="uploadImagesRoommate"
                      multiple
                      accept="image/*"
                      className="mt-1 block w-full text-sm text-gray-700 
                                file:mr-4 file:py-2.5 file:px-5 
                                file:rounded-md file:border-0 
                                file:bg-[#f8f8f9] file:text-[#333] 
                                file:font-medium file:shadow-sm 
                                hover:file:bg-[#eee]"
                    />
                  </div>
                </>
              )}

              {category === "CARPOOL" && (
                <>
                  <div>
                    <label htmlFor="pickupLocation" className="block text-sm font-medium text-gray-700">Pickup Location</label>
                    <input
                      type="text"
                      id="pickupLocation"
                      placeholder="Enter pickup location"
                      className={`mt-1 block w-full border ${errors.pickupLocation ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2`}
                    />
                    {renderError("pickupLocation")}
                  </div>

                  <div>
                    <label htmlFor="dropoffLocation" className="block text-sm font-medium text-gray-700">Drop-off Location</label>
                    <input
                      type="text"
                      id="dropoffLocation"
                      placeholder="Enter drop-off location"
                      className={`mt-1 block w-full border ${errors.dropoffLocation ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2`}
                    />
                    {renderError("dropoffLocation")}
                  </div>

                  <div>
                    <label htmlFor="rideDate" className="block text-sm font-medium text-gray-700">Ride Date</label>
                    <input
                      type="date"
                      id="rideDate"
                      value={rideDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setRideDate(e.target.value)}
                      className={`mt-1 block w-full border ${errors.rideDate ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                    />
                    {renderError("rideDate")}
                  </div>

                  <div>
                    <label htmlFor="rideTime" className="block text-sm font-medium text-gray-700">Ride Time</label>
                    <input
                      type="time"
                      id="rideTime"
                      value={rideTime}
                      onChange={(e) => setRideTime(e.target.value)}
                      min={
                        rideDate === new Date().toISOString().split("T")[0]
                          ? new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
                          : undefined
                      }
                      className={`mt-1 block w-full border ${errors.rideTime ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                    />
                    {renderError("rideTime")}
                  </div>

                  <div>
                    <label htmlFor="availableSeats" className="block text-sm font-medium text-gray-700">Available Seats</label>
                    <input
                      type="number"
                      id="availableSeats"
                      min="1"
                      defaultValue="1"
                      className={`mt-1 block w-full border ${errors.availableSeats ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                    />
                    {renderError("availableSeats")}
                  </div>
                </>
              )}

              {category === "SELL" && (
                <>
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                    <input
                      type="text"
                      id="title"
                      placeholder="Enter listing title"
                      className={`mt-1 block w-full border ${errors.title ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2`}
                    />
                    {renderError("title")}
                  </div>

                  <div>
                    <label htmlFor="itemName" className="block text-sm font-medium text-gray-700">Item Name</label>
                    <input
                      type="text"
                      id="itemName"
                      placeholder="Enter item name"
                      className={`mt-1 block w-full border ${errors.itemName ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus;border-indigo-500 focus:ring-indigo-500 p-2`}
                    />
                    {renderError("itemName")}
                  </div>

                  <div>
                    <label htmlFor="itemDescription" className="block text-sm font-medium text-gray-700">Item Description</label>
                    <textarea
                      id="itemDescription"
                      rows={3}
                      placeholder="Enter item description"
                      className={`mt-1 block w-full border ${errors.itemDescription ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2`}
                    />
                    {renderError("itemDescription")}
                  </div>

                  <div>
                    <label htmlFor="itemPrice" className="block text-sm font-medium text-gray-700">Price</label>
                    <input
                      type="number"
                      id="itemPrice"
                      min="0"
                      step="0.01"
                      placeholder="Enter price"
                      className={`mt-1 block w-full border ${errors.itemPrice ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus;border-indigo-500 focus:ring-indigo-500 p-2`}
                    />
                    {renderError("itemPrice")}
                  </div>

                  <div>
                    <label htmlFor="subCategory" className="block text-sm font-medium text-gray-700">Sub Category</label>
                    <select
                      id="subCategory"
                      className={`mt-1 block w-full border ${errors.subCategory ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2`}
                    >
                      <option value="FURNITURE">Furniture</option>
                      <option value="ELECTRONICS">Electronics</option>
                      <option value="KITCHEN">Kitchen</option>
                      <option value="BOOKS">Books</option>
                      <option value="OTHER">Other</option>
                    </select>
                    {renderError("subCategory")}
                  </div>

                  <div>
                    <label htmlFor="uploadImagesSell" className="block text-sm font-medium text-gray-700">Upload Images</label>
                    <input
                      type="file"
                      id="uploadImagesSell"
                      multiple
                      accept="image/*"
                      className="mt-1 block w-full text-sm text-gray-700 
                                file:mr-4 file:py-2.5 file:px-5 
                                file:rounded-md file:border-0 
                                file:bg-[#f8f8f9] file:text-[#333] 
                                file:font-medium file:shadow-sm 
                                hover:file:bg-[#eee]"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Illustrations */}
            {category === "ROOMMATE" && (
              <div className="hidden lg:flex flex-1 items-center justify-center">
                <Image
                  src="roommate-finder.png"
                  alt="Roommate Finder Illustration"
                  width={400}
                  height={400}
                  className="rounded-lg shadow-lg"
                />
              </div>
            )}
            {category === "CARPOOL" && (
              <div className="hidden lg:flex flex-1 items-center justify-center">
                <Image
                  src="carpool-finder.png"
                  alt="Carpool Finder Illustration"
                  width={350}
                  height={350}
                  className="rounded-lg shadow-lg"
                />
              </div>
            )}
            {category === "SELL" && (
              <div className="hidden lg:flex flex-1 items-center justify-center">
                <Image
                  src="sell-items.png"
                  alt="Buy & Sell Illustration"
                  width={400}
                  height={400}
                  className="rounded-lg shadow-lg"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="mt-6 w-full bg-[#f76902] text-white py-2 px-4 rounded-md hover:bg-[#db5d00]"
          >
            Submit
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
