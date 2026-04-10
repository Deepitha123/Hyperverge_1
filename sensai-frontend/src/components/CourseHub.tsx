"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getHubPosts,
  createHubPost,
  pinPost,
  highlightPost,
  deleteHubPost,
} from "@/lib/api";
import { HubPost, HubPostType } from "@/types";
import { MessageSquare, ThumbsUp, Pin, Star, Trash2, Plus, ArrowUpDown, Clock } from "lucide-react";

interface CourseHubProps {
  courseId: string;
  schoolId: string;
  courseName?: string;
  isMentor?: boolean;
  modules?: { id: string; title: string }[];
}

const POST_TYPE_LABELS: Record<HubPostType, string> = {
  question: "❓ Question",
  understanding: "💡 My Understanding",
  discussion: "🗣️ Discussion",
};

const POST_TYPE_COLORS: Record<HubPostType, string> = {
  question: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  understanding: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  discussion: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ name, color }: { name: string; color?: string | null }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
      style={{ backgroundColor: color || "#6366f1" }}
    >
      {initials || "?"}
    </div>
  );
}

// ── New Post Modal ─────────────────────────────────────────────────────────────
function NewPostModal({
  modules,
  onClose,
  onSubmit,
}: {
  modules: { id: string; title: string }[];
  onClose: () => void;
  onSubmit: (data: { title: string; body: string; postType: HubPostType; moduleId?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<HubPostType>("discussion");
  const [moduleId, setModuleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ title: title.trim(), body: body.trim(), postType, moduleId: moduleId || undefined });
      onClose();
    } catch {
      setError("Failed to create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Post</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Post type chips */}
          <div className="flex gap-2 flex-wrap">
            {(["question", "understanding", "discussion"] as HubPostType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPostType(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  postType === t
                    ? POST_TYPE_COLORS[t] + " ring-2 ring-offset-1 ring-current"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {POST_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <input
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Post title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />

          <textarea
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Write your post… *"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {modules.length > 0 && (
            <select
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
            >
              <option value="">🔗 Link to a module (optional)</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Post Card ──────────────────────────────────────────────────────────────────
function PostCard({
  post,
  onClick,
  isMentor,
  onPin,
  onHighlight,
  onDelete,
}: {
  post: HubPost;
  onClick: () => void;
  isMentor: boolean;
  onPin: () => void;
  onHighlight: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`relative rounded-2xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 p-4 group
        ${post.isPinned ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-gray-100 dark:border-gray-800 bg-white dark:bg-[#111]"}
      `}
      onClick={onClick}
    >
      {/* Pinned / Highlighted badges */}
      {post.isPinned && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
          <Pin size={12} /> Pinned
        </span>
      )}
      {post.isHighlighted && (
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Star size={13} fill="currentColor" /> Recommended by Mentor
        </div>
      )}

      {/* Post type + module tag */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${POST_TYPE_COLORS[post.postType]}`}>
          {POST_TYPE_LABELS[post.postType]}
        </span>
        {post.moduleName && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            📦 {post.moduleName}
          </span>
        )}
      </div>

      {/* Title + body preview */}
      <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 line-clamp-2">{post.title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 mb-3">{post.body}</p>

      {/* Footer: author + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={post.learnerName} color={post.learnerAvatar} />
          <span className="text-xs text-gray-500 dark:text-gray-400">{post.learnerName}</span>
          <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
          <span className="text-xs text-gray-400">{timeAgo(post.createdAt)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><ThumbsUp size={12} /> {post.likeCount}</span>
          <span className="flex items-center gap-1"><MessageSquare size={12} /> {post.commentCount}</span>
        </div>
      </div>

      {/* Mentor actions (visible on hover) */}
      {isMentor && (
        <div
          className="absolute bottom-3 right-3 hidden group-hover:flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onPin} title="Pin post" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
            <Pin size={13} />
          </button>
          <button onClick={onHighlight} title="Highlight post" className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
            <Star size={13} />
          </button>
          <button onClick={onDelete} title="Delete post" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main CourseHub Component ───────────────────────────────────────────────────
export default function CourseHub({ courseId, schoolId, courseName, isMentor = false, modules = [] }: CourseHubProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await getHubPosts(courseId, sort);
      setPosts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, [courseId, sort]);

  const handleNewPost = async (data: { title: string; body: string; postType: HubPostType; moduleId?: string }) => {
    if (!user?.id) return;
    await createHubPost(courseId, {
      learnerId: parseInt(String(user.id)),
      title: data.title,
      body: data.body,
      postType: data.postType,
      moduleId: data.moduleId ? parseInt(data.moduleId) : undefined,
    });
    await loadPosts();
  };

  const handlePin = async (postId: string) => {
    await pinPost(postId);
    await loadPosts();
  };

  const handleHighlight = async (postId: string) => {
    await highlightPost(postId);
    await loadPosts();
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await deleteHubPost(postId);
    await loadPosts();
  };

  const goToPost = (postId: string) => {
    router.push(`/school/${schoolId}/hub/${postId}`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-black/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-900 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {courseName ? `${courseName} Hub` : "Course Hub"}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Discuss, ask, and share with your cohort</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1">
            <button
              onClick={() => setSort("newest")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sort === "newest" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
            >
              <Clock size={12} /> Newest
            </button>
            <button
              onClick={() => setSort("top")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sort === "top" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
            >
              <ArrowUpDown size={12} /> Top
            </button>
          </div>
          <button
            onClick={() => setShowNewPost(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Plus size={14} /> New Post
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="mx-auto mb-3 text-gray-300 dark:text-gray-700" size={40} />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No posts yet. Be the first to start a discussion!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => goToPost(post.id)}
              isMentor={isMentor}
              onPin={() => handlePin(post.id)}
              onHighlight={() => handleHighlight(post.id)}
              onDelete={() => handleDelete(post.id)}
            />
          ))
        )}
      </div>

      {showNewPost && (
        <NewPostModal modules={modules} onClose={() => setShowNewPost(false)} onSubmit={handleNewPost} />
      )}
    </div>
  );
}
