// Define interfaces for Task-related data
export interface TaskData {
    id: string;
    title: string;
    blocks: any[];
    status: string;
    scheduled_publish_at?: string;
}

export interface Member {
    id: number;
    email: string;
    first_name: string;
    middle_name: string;
    last_name: string;
}

export interface CohortMember extends Member {
    role: 'learner' | 'mentor';
}

export interface TeamMember extends Member {
    role: 'owner' | 'admin';  // Updated roles as per requirement
}

export interface Course {
    id: number;
    name: string;
}

export interface Cohort {
    id: number;
    name: string;
    joined_at: string | undefined;
    role?: string;
}

export interface CohortWithDetails extends Cohort {
    members: CohortMember[];
    org_id: number;
    name: string;
    groups: any[];
    courses?: Course[];
}

export interface Task {
    id: number;
    title: string;
    type: string;
    status: string;
    ordering: number;
    content?: any[]; // Content for learning materials
    num_questions?: number;
    questions?: any[]; // Questions for quizzes and exams
    scheduled_publish_at: string;
    is_generating: boolean;
}

export interface Milestone {
    id: number;
    name: string;
    color: string;
    ordering: number;
    tasks?: Task[];
    unlock_at?: string;
}

// Export all quiz types
export * from './quiz';

// Export other types as needed

// ── Hub (discussion board) types ─────────────────────────────────────────────

export type HubPostType = "question" | "understanding" | "discussion";

export interface HubPost {
  id: string;
  courseId: string;
  learnerId: string;
  learnerName: string;
  learnerAvatar: string | null;
  title: string;
  body: string;
  postType: HubPostType;
  moduleId: string | null;
  moduleName: string | null;
  isPinned: boolean;
  isHighlighted: boolean;
  likeCount: number;
  commentCount: number;
  images: string[];
  createdAt: string;
}

export interface HubComment {
  id: string;
  postId: string;
  learnerId: string;
  learnerName: string;
  learnerAvatar: string | null;
  body: string;
  confidenceScore?: number;
  likeCount: number;
  images: string[];
  createdAt: string;
}

export interface CreateHubPostInput {
  learnerId: number;
  title: string;
  body: string;
  postType: HubPostType;
  moduleId?: number;
  imageUrls?: string[];
}

export interface CreateHubCommentInput {
  learnerId: number;
  body: string;
  imageUrls?: string[];
}