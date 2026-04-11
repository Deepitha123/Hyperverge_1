"use client";

import { useAuth } from "./auth";
import { useCallback, useEffect, useState } from 'react';
import { Task, Milestone } from "@/types";
import { Module } from "@/types/course";
import { transformMilestonesToModules } from "./course";

// Define course interface based on your backend response
export interface Course {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  createdAt?: string;
  updatedAt?: string;
  moduleCount?: number;
  role?: string;
  org?: {
    id: number;
    name: string;
    slug: string;
  };
  org_id: number;
  // Add other fields as needed
}

// School interface (mapped from organization in the API)
export interface School {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
  role?: string;
  slug?: string;
  // Add other fields as needed
}

/**
 * Hook to fetch courses for the current user
 */
export function useCourses() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch courses immediately when user ID is available
  useEffect(() => {
    if (!isAuthenticated || !user?.id || authLoading) {
      return;
    }
    
    setIsLoading(true);
    
    // Simple fetch without caching
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/${user.id}/courses`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Transform the API response to match the expected format
        const formattedCourses: Course[] = data.map((course: any) => ({
          id: course.id,
          title: course.name,
          role: course.role,
          cohort_id: course.cohort_id,
          org: course.org,
          org_id: course.org.id,
          coverImage: course.coverImage,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt
        }));
        
        setCourses(formattedCourses);
      })
      .catch(err => {
        console.error('Error fetching courses:', err);
        setError(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user?.id, isAuthenticated, authLoading]);
  
  return {
    courses,
    isLoading,
    error
  };
}

/**
 * Hook to fetch schools for the current user
 */
export function useSchools() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch schools immediately when user ID is available
  useEffect(() => {
    if (!isAuthenticated || !user?.id || authLoading) {
      return;
    }
    
    setIsLoading(true);
    
    // Simple fetch without caching
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/users/${user.id}/orgs`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Transform the API response to match the expected format
        const formattedSchools: School[] = data.map((org: any) => ({
          id: org.id,
          name: org.name,
          description: org.description,
          url: org.url,
          role: org.role,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt
        }));
        
        setSchools(formattedSchools);
      })
      .catch(err => {
        console.error('Error fetching schools:', err);
        setError(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user?.id, isAuthenticated, authLoading]);
  
  return {
    schools,
    isLoading,
    error
  };
} 

/**
 * Fetches and processes completion data for a user in a cohort
 * @param cohortId - The ID of the cohort
 * @param userId - The ID of the user
 * @returns Object containing task and question completion data
 */
export const getCompletionData = async (cohortId: number, userId: string): Promise<{
  taskCompletions: Record<string, boolean>,
  questionCompletions: Record<string, Record<string, boolean>>
}> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/completion?user_id=${userId}`);

  if (!response.ok) {
      throw new Error(`Failed to fetch completion data: ${response.status}`);
  }

  const completionData = await response.json();

  // Process completion data for tasks
  const taskCompletions: Record<string, boolean> = {};
  // Process completion data for questions
  const questionCompletions: Record<string, Record<string, boolean>> = {};

  // Iterate through each task in the completion data
  Object.entries(completionData).forEach(([taskId, taskData]: [string, any]) => {
      // Store task completion status
      taskCompletions[taskId] = taskData.is_complete;

      // Store question completion status if questions exist
      if (taskData.questions && taskData.questions.length > 0) {
          const questionsMap: Record<string, boolean> = {};

          taskData.questions.forEach((question: any) => {
              if (question && question.question_id != null) {
                  questionsMap[question.question_id.toString()] = question.is_complete;
              }
          });

          questionCompletions[taskId] = questionsMap;
      }
  });

  return { taskCompletions, questionCompletions };
}; 

/**
 * Fetches course data and transforms it into modules
 * @param courseId - The ID of the course
 * @param baseUrl - The base URL for the API request (defaults to NEXT_PUBLIC_BACKEND_URL)
 * @returns Object containing the course data and transformed modules
 * 
 * NOTE: This is a client-side function. For server components, use the version in server-api.ts
 */
export const getCourseModules = async (courseId: string, baseUrl?: string): Promise<{
  courseData: any,
  modules: any[]
}> => {
  // Determine which URL to use (server-side vs client-side)
  const apiUrl = baseUrl || process.env.NEXT_PUBLIC_BACKEND_URL;
  
  const response = await fetch(`${apiUrl}/courses/${courseId}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch course data: ${response.status}`);
  }

  const courseData = await response.json();
  
  // Use the shared utility function to transform the milestones to modules
  const modules = transformMilestonesToModules(courseData.milestones);

  return { courseData, modules };
}; 


export const addModule = async (courseId: string, schoolId: string, modules: Module[], setModules: (modules: Module[]) => void, setActiveModuleId: (moduleId: string) => void, lastUsedColorIndex: number, setLastUsedColorIndex: (colorIndex: number) => void) => {
  // Generate a diverse set of theme-compatible colors for dark mode
  const getRandomPastelColor = () => {
      // Predefined set of diverse dark mode friendly colors in hex format
      const themeColors = [
          '#2d3748',    // Slate blue
          '#433c4c',    // Deep purple
          '#4a5568',    // Cool gray
          '#312e51',    // Indigo
          '#364135',    // Forest green
          '#4c393a',    // Burgundy
          '#334155',    // Navy blue
          '#553c2d',    // Rust brown
          '#37303f',    // Plum
          '#3c4b64',    // Steel blue
          '#463c46',    // Mauve
          '#3c322d',    // Coffee
      ];

      // Ensure we don't pick a color similar to the last one
      let newColorIndex;
      do {
          newColorIndex = Math.floor(Math.random() * themeColors.length);
          // If we have more than 6 colors, make sure the new color is at least 3 positions away
          // from the last one to ensure greater visual distinction
      } while (
          lastUsedColorIndex !== -1 &&
          (Math.abs(newColorIndex - lastUsedColorIndex) < 3 ||
              newColorIndex === lastUsedColorIndex)
      );

      // Update the last used color index
      setLastUsedColorIndex(newColorIndex);

      return themeColors[newColorIndex];
  };

  // Select a random color for the module
  const backgroundColor = getRandomPastelColor();

  try {
      // Make POST request to create a new milestone (module)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/${courseId}/milestones`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              name: "New Module",
              color: backgroundColor, // Now sending color as hex with # symbol
          }),
      });

      if (!response.ok) {
          throw new Error(`Failed to create module: ${response.status}`);
      }

      // Get the module ID from the response
      const data = await response.json();

      // Create the new module with the ID from the API
      const newModule: Module = {
          id: data.id.toString(), // Convert to string to match our Module interface
          title: "New Module",
          position: modules.length,
          items: [],
          isExpanded: true,
          backgroundColor: `${backgroundColor}80`, // Add 50% opacity for UI display
          isEditing: false
      };

      setModules([...modules, newModule]);
      setActiveModuleId(newModule.id);
  } catch (error) {
      console.error("Error creating module:", error);

      // Fallback to client-side ID generation if the API call fails
      const newModule: Module = {
          id: `module-${Date.now()}`,
          title: "New Module",
          position: modules.length,
          items: [],
          isExpanded: true,
          backgroundColor: `${backgroundColor}80`, // Add 50% opacity for UI display
          isEditing: false
      };

      setModules([...modules, newModule]);
      setActiveModuleId(newModule.id);
  }
};


// ── Hub (discussion board) API functions ──────────────────────────────────────

const BACKEND = () => process.env.NEXT_PUBLIC_BACKEND_URL?.replace("localhost", "127.0.0.1") || "http://127.0.0.1:8001";

export async function getHubPosts(courseId: string, sort: "newest" | "top" = "newest") {
  const res = await fetch(`${BACKEND()}/hub/${courseId}/posts?sort=${sort}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getHubPosts failed: ${res.status}`);
  const data = await res.json();
  return data.map((p: any) => ({
    id: String(p.id),
    courseId: String(p.course_id),
    learnerId: String(p.learner_id),
    learnerName: p.learner_name || "Unknown",
    learnerAvatar: p.learner_avatar ?? null,
    title: p.title,
    body: p.body,
    postType: p.post_type,
    moduleId: p.module_id != null ? String(p.module_id) : null,
    moduleName: p.module_name ?? null,
    isPinned: Boolean(p.is_pinned),
    isHighlighted: Boolean(p.is_highlighted),
    likeCount: p.like_count ?? 0,
    commentCount: p.comment_count ?? 0,
    images: p.images ?? [],
    createdAt: p.created_at,
  }));
}

export async function createHubPost(courseId: string, data: {
  learnerId: number; title: string; body: string;
  postType: string; moduleId?: number; imageUrls?: string[];
}) {
  const res = await fetch(`${BACKEND()}/hub/${courseId}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      learner_id: data.learnerId, title: data.title, body: data.body,
      post_type: data.postType, module_id: data.moduleId ?? null,
      image_urls: data.imageUrls ?? [],
    }),
  });
  if (!res.ok) throw new Error(`createHubPost failed: ${res.status}`);
  return res.json();
}

export async function getHubPost(postId: string) {
  const res = await fetch(`${BACKEND()}/hub/posts/${postId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getHubPost failed: ${res.status}`);
  const p = await res.json();
  return {
    id: String(p.id), courseId: String(p.course_id), learnerId: String(p.learner_id),
    learnerName: p.learner_name || "Unknown", learnerAvatar: p.learner_avatar ?? null,
    title: p.title, body: p.body, postType: p.post_type,
    moduleId: p.module_id != null ? String(p.module_id) : null, moduleName: p.module_name ?? null,
    isPinned: Boolean(p.is_pinned), isHighlighted: Boolean(p.is_highlighted),
    likeCount: p.like_count ?? 0, commentCount: p.comment_count ?? 0,
    images: p.images ?? [], createdAt: p.created_at,
    comments: (p.comments ?? []).map((c: any) => ({
      id: String(c.id), postId: String(c.post_id), learnerId: String(c.learner_id),
      learnerName: c.learner_name || "Unknown", learnerAvatar: c.learner_avatar ?? null,
      body: c.body, confidenceScore: c.confidence_score, likeCount: c.like_count ?? 0,
      images: c.images ?? [], createdAt: c.created_at,
    })),
  };
}

export async function createHubComment(postId: string, data: { learnerId: number; body: string; imageUrls?: string[] }) {
  const res = await fetch(`${BACKEND()}/hub/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ learner_id: data.learnerId, body: data.body, image_urls: data.imageUrls ?? [] }),
  });
  if (!res.ok) throw new Error(`createHubComment failed: ${res.status}`);
  return res.json();
}

export async function togglePostLike(postId: string, learnerId: number) {
  const res = await fetch(`${BACKEND()}/hub/posts/${postId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ learner_id: learnerId }),
  });
  if (!res.ok) throw new Error(`togglePostLike failed: ${res.status}`);
  return res.json();
}

export async function toggleCommentLike(commentId: string, learnerId: number) {
  const res = await fetch(`${BACKEND()}/hub/comments/${commentId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ learner_id: learnerId }),
  });
  if (!res.ok) throw new Error(`toggleCommentLike failed: ${res.status}`);
  return res.json();
}

export async function pinPost(postId: string) {
  const res = await fetch(`${BACKEND()}/hub/posts/${postId}/pin`, { method: "PATCH" });
  if (!res.ok) throw new Error(`pinPost failed: ${res.status}`);
  return res.json();
}

export async function highlightPost(postId: string) {
  const res = await fetch(`${BACKEND()}/hub/posts/${postId}/highlight`, { method: "PATCH" });
  if (!res.ok) throw new Error(`highlightPost failed: ${res.status}`);
  return res.json();
}

export async function linkPostToModule(postId: string, moduleId: string) {
  const res = await fetch(`${BACKEND()}/hub/posts/${postId}/link-module`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module_id: parseInt(moduleId) }),
  });
  if (!res.ok) throw new Error(`linkPostToModule failed: ${res.status}`);
  return res.json();
}

export async function deleteHubPost(postId: string) {
  const res = await fetch(`${BACKEND()}/hub/posts/${postId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteHubPost failed: ${res.status}`);
  return res.json();
}

export async function deleteHubComment(commentId: string) {
  const res = await fetch(`${BACKEND()}/hub/comments/${commentId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteHubComment failed: ${res.status}`);
  return res.json();
}

export async function getModuleHubPosts(moduleId: string) {
  const res = await fetch(`${BACKEND()}/hub/module/${moduleId}/posts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getModuleHubPosts failed: ${res.status}`);
  return res.json();
}


// ── Personal Knowledge Base API functions ───────────────────────────────────────────

export async function convertChatToKnowledge(data: {
  learner_id: number;
  course_id?: number | null;
  module_id?: number | null;
  task_id: number;
}) {
  const res = await fetch(`${BACKEND()}/knowledge/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`convertChatToKnowledge failed: ${res.status}`);
  return res.json();
}

export async function getLearnerKnowledge(learnerId: number) {
  const res = await fetch(`${BACKEND()}/knowledge/${learnerId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getLearnerKnowledge failed: ${res.status}`);
  return res.json();
}

export async function deleteLearnerKnowledge(learnerId: number, knowledgeId: number) {
  const res = await fetch(`${BACKEND()}/knowledge/${learnerId}/${knowledgeId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`deleteLearnerKnowledge failed: ${res.status}`);
  return res.json();
}

// ── Knowledge Graph API ──────────────────────────────────────────────────────

export async function getKnowledgeGraph(userId: number) {
  const res = await fetch(`${BACKEND()}/knowledge/graph?user_id=${userId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getKnowledgeGraph failed: ${res.status}`);
  return res.json();
}

export async function getConceptEvidence(conceptId: number, userId: number) {
  const res = await fetch(`${BACKEND()}/knowledge/concepts/${conceptId}/evidence?user_id=${userId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getConceptEvidence failed: ${res.status}`);
  return res.json();
}

export async function rebuildKnowledgeGraph(userId: number) {
  const res = await fetch(`${BACKEND()}/knowledge/graph/rebuild?user_id=${userId}`, { method: "POST" });
  if (!res.ok) throw new Error(`rebuildKnowledgeGraph failed: ${res.status}`);
  return res.json();
}