"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getModuleHubPosts } from "@/lib/api";
import { MessageSquare } from "lucide-react";

interface ModuleHubLinksProps {
  moduleId: string;
  schoolId: string;
  courseId: string;
}

interface LinkedPost {
  id: string;
  title: string;
  post_type: string;
  comment_count: number;
  created_at: string;
}

const POST_TYPE_ICON: Record<string, string> = {
  question: "❓",
  understanding: "💡",
  discussion: "🗣️",
};

export default function ModuleHubLinks({ moduleId, schoolId, courseId }: ModuleHubLinksProps) {
  const [posts, setPosts] = useState<LinkedPost[]>([]);

  useEffect(() => {
    getModuleHubPosts(moduleId)
      .then(setPosts)
      .catch(() => {});
  }, [moduleId]);

  // Render nothing if no linked posts
  if (posts.length === 0) return null;

  return (
    <div className="mt-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#111]">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
        <MessageSquare size={12} />
        {posts.length} related hub discussion{posts.length !== 1 ? "s" : ""}
      </p>
      <ul className="space-y-1.5">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/school/${schoolId}/hub/${post.id}`}
              className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
            >
              <span>{POST_TYPE_ICON[post.post_type] || "💬"}</span>
              <span className="line-clamp-1">{post.title}</span>
              {post.comment_count > 0 && (
                <span className="ml-auto shrink-0 text-gray-400">
                  {post.comment_count} reply{post.comment_count !== 1 ? "s" : ""}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
