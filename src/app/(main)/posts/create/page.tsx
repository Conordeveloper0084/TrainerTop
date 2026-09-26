"use client";

import { useEffect } from "react";

export default function CreatePostPage() {
  // Post yaratish endi asosiy postlar sahifasidagi modal orqali ishlaydi
  useEffect(() => {
    window.location.href = "/posts";
  }, []);

  return null;
}
