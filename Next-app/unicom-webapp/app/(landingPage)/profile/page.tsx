"use client";

import infra_config from '../../../public/infra_config.json';
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

export default function MyProfilePage() {
  const { user, token } = useAuth();

  const [form, setForm] = useState({ name: "", college: "", department: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const API_URL = infra_config.api_url;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.email || !token) return;

      try {
        const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.email)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch user profile");
        }

        const data = await res.json();
        setForm({
          name: data.name || "",
          college: data.college || "",
          department: data.department || "",
        });
      } catch (err) {
        console.error(err);
        setMessage("Failed to load profile.");
      }
    };

    fetchProfile();
  }, [user, token]);


  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          college: form.college,
          department: form.department,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update profile");
      }

      setEditing(false);
      setMessage("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      setMessage("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading user information...
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      <section className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-3xl font-bold">My Profile</h2>

        {/* Message */}
        {message && (
          <div className="p-3 bg-gray-100 text-center rounded-md text-sm text-gray-700">
            {message}
          </div>
        )}

        <div className="space-y-4">
          {/* Email - Read Only */}
          <div>
            <label className="block mb-1 text-sm font-medium">Email</label>
            <input
              type="text"
              className="w-full p-2 border rounded-md bg-gray-100"
              value={user.email}
              readOnly
            />
          </div>

          {/* Name - Editable */}
          <div>
            <label className="block mb-1 text-sm font-medium">Name</label>
            <input
              type="text"
              className="w-full p-2 border rounded-md"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setEditing(true);
              }}
            />
          </div>

          {/* College */}
          <div>
            <label className="block mb-1 text-sm font-medium">College</label>
            <input
              type="text"
              className="w-full p-2 border rounded-md"
              value={form.college}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, college: e.target.value }));
                setEditing(true);
              }}
            />
          </div>

          {/* Department */}
          <div>
            <label className="block mb-1 text-sm font-medium">Department</label>
            <input
              type="text"
              className="w-full p-2 border rounded-md"
              value={form.department}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, department: e.target.value }));
                setEditing(true);
              }}
            />
          </div>

          {/* Save button */}
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
