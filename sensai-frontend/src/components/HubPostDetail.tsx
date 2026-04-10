"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getHubPost,
  createHubComment,
  togglePostLike,
  toggleCommentLike,
  pinPost,
  highlightPost,
  linkPostToModule,
  deleteHubPost,
  deleteHubComment,
} from "@/lib/api";
import { HubPost, HubComment } from "@/types";
import {
  ThumbsUp, MessageSquare, Pin, Star, Trash2, Link2,
  ChevronLeft, Send, X
} from "lucide-react";

interface HubPostDetailProps {
  postId: string;
  schoolId: string;
  isMentor?: boolean;
  modules?: { id: string; title: string }[];
}

const POST_TYPE_LABELS: Record<string, string> = {
  question: "❓ Question",
  understanding: "💡 My Understanding",
  discussion: "🗣️ Discussion",
};

const POST_TYPE_COLORS: Record<string, string> = {
  question: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  understanding: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  discussion: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

function timeAgo(dateStr: string) {
  // Ensure the date string is treated as UTC if it doesn't have a timezone specifier
  const date = dateStr.endsWith("Z") ? new Date(dateStr) : new Date(dateStr + "Z");
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ name, color, size = 8 }: { name: string; color?: string | null; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0`}
      style={{ backgroundColor: color || "#6366f1", width: `${size * 4}px`, height: `${size * 4}px` }}
    >
      {initials || "?"}
    </div>
  );
}

// ── Link to Module Modal ───────────────────────────────────────────────────────
function LinkModuleModal({
  modules,
  onClose,
  onLink,
}: {
  modules: { id: string; title: string }[];
  onClose: () => void;
  onLink: (moduleId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    await onLink(selected);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Link to Module</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <select
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select a module…</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
          <button onClick={handleSave} disabled={!selected || saving} className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-50">
            {saving ? "Saving…" : "Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comment Card ───────────────────────────────────────────────────────────────
function CommentCard({
  comment,
  isMentor,
  learnerId,
  onLike,
  onDelete,
}: {
  comment: HubComment;
  isMentor: boolean;
  learnerId: number;
  onLike: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-gray-800 group">
      <Avatar name={comment.learnerName} color={comment.learnerAvatar} size={8} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{comment.learnerName}</span>
            <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
            {comment.confidenceScore !== undefined && comment.confidenceScore !== null && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                comment.confidenceScore >= 8 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                comment.confidenceScore >= 5 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}>
                AI Score: {comment.confidenceScore}/10
              </span>
            )}
          </div>
          {isMentor && (
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.body}</p>
        {comment.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {comment.images.map((src, i) => (
              <img key={i} src={src} alt="" className="rounded-lg max-h-40 object-cover" />
            ))}
          </div>
        )}
        <button
          onClick={onLike}
          className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ThumbsUp size={12} /> {comment.likeCount}
        </button>
      </div>
    </div>
  );
}

// ── Main HubPostDetail ─────────────────────────────────────────────────────────
export default function HubPostDetail({ postId, schoolId, isMentor = false, modules = [] }: HubPostDetailProps) {
  const { user } = useAuth();
  const router = useRouter();
  const learnerId = parseInt(String(user?.id || "0"));

  const [post, setPost] = useState<(HubPost & { comments: HubComment[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const loadPost = async () => {
    setLoading(true);
    try {
      const data = await getHubPost(postId) as HubPost & { comments: HubComment[] };
      setPost(data);
      setLikeCount(data.likeCount);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPost(); }, [postId]);

  const handleLikePost = async () => {
    if (!learnerId) return;
    const res = await togglePostLike(postId, learnerId);
    setLikeCount(res.like_count);
  };

  const handleLikeComment = async (commentId: string) => {
    if (!learnerId) return;
    await toggleCommentLike(commentId, learnerId);
    await loadPost();
  };

  const handleAddComment = async () => {
    if (!commentBody.trim() || !learnerId) return;
    setSubmitting(true);
    try {
      await createHubComment(postId, { learnerId, body: commentBody.trim() });
      setCommentBody("");
      await loadPost();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("Delete this post and all its comments?")) return;
    await deleteHubPost(postId);
    router.back();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    await deleteHubComment(commentId);
    await loadPost();
  };

  const handlePin = async () => { await pinPost(postId); await loadPost(); };
  const handleHighlight = async () => { await highlightPost(postId); await loadPost(); };
  const handleLinkModule = async (moduleId: string) => { await linkPostToModule(postId, moduleId); await loadPost(); };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return <div className="text-center py-20 text-gray-400">Post not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ChevronLeft size={16} /> Back to Hub
      </button>

      {/* Post */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#111] p-5">
        {/* Highlighted banner */}
        {post.isHighlighted && (
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl">
            <Star size={15} fill="currentColor" /> Recommended by Mentor
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${POST_TYPE_COLORS[post.postType] || ""}`}>
            {POST_TYPE_LABELS[post.postType] || post.postType}
          </span>
          {post.isPinned && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              <Pin size={11} /> Pinned
            </span>
          )}
          {post.moduleName && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500">
              📦 {post.moduleName}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{post.title}</h1>

        {/* Author */}
        <div className="flex items-center gap-2 mb-4">
          <Avatar name={post.learnerName} color={post.learnerAvatar} size={7} />
          <span className="text-sm text-gray-600 dark:text-gray-400">{post.learnerName}</span>
          <span className="text-xs text-gray-400">· {timeAgo(post.createdAt)}</span>
        </div>

        {/* Body */}
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-4">{post.body}</p>

        {/* Images */}
        {post.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.images.map((src, i) => (
              <img key={i} src={src} alt="" className="rounded-xl max-h-60 object-cover" />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleLikePost}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
          >
            <ThumbsUp size={15} /> {likeCount}
          </button>
          <span className="flex items-center gap-1.5 text-sm text-gray-400">
            <MessageSquare size={15} /> {post.comments.length}
          </span>
          {/* Mentor toolbar */}
          {isMentor && (
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={handlePin} title="Pin" className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
                <Pin size={15} />
              </button>
              <button onClick={handleHighlight} title="Highlight" className="p-2 rounded-xl text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                <Star size={15} />
              </button>
              {modules.length > 0 && (
                <button onClick={() => setShowLinkModal(true)} title="Link to module" className="p-2 rounded-xl text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                  <Link2 size={15} />
                </button>
              )}
              <button onClick={handleDeletePost} title="Delete post" className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comments section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {post.comments.length} Comment{post.comments.length !== 1 ? "s" : ""}
        </h2>

        {post.comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            isMentor={isMentor}
            learnerId={learnerId}
            onLike={() => handleLikeComment(comment.id)}
            onDelete={() => handleDeleteComment(comment.id)}
          />
        ))}

        {/* Add comment */}
        <div className="flex gap-3 pt-2">
          {user && <Avatar name={String(user.email || "?")} size={8} />}
          <div className="flex-1 flex gap-2">
            <textarea
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Add a comment…"
              rows={2}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
            />
            <button
              onClick={handleAddComment}
              disabled={!commentBody.trim() || submitting}
              className="self-end px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {showLinkModal && (
        <LinkModuleModal modules={modules} onClose={() => setShowLinkModal(false)} onLink={handleLinkModule} />
      )}
    </div>
  );
}
