from fastapi import APIRouter, HTTPException
from typing import List, Optional
from api.models import (
    CreateHubPostRequest,
    CreateHubCommentRequest,
    LinkModuleRequest,
    ToggleLikeRequest,
)
from api.db.hub import (
    get_posts_by_course as get_posts_by_course_from_db,
    create_post as create_post_in_db,
    get_post_by_id as get_post_by_id_from_db,
    get_comments_by_post as get_comments_by_post_from_db,
    create_comment as create_comment_in_db,
    toggle_post_like as toggle_post_like_in_db,
    toggle_comment_like as toggle_comment_like_in_db,
    pin_post as pin_post_in_db,
    highlight_post as highlight_post_in_db,
    link_post_to_module as link_post_to_module_in_db,
    delete_post as delete_post_in_db,
    delete_comment as delete_comment_in_db,
    get_posts_by_module as get_posts_by_module_from_db,
)

router = APIRouter()


@router.get("/{course_id}/posts")
async def get_posts_for_course(course_id: int, sort: str = "newest"):
    """Get all posts for a course, sorted by 'newest' or 'top'."""
    if sort not in ("newest", "top"):
        raise HTTPException(status_code=400, detail="sort must be 'newest' or 'top'")
    return await get_posts_by_course_from_db(course_id, sort)


@router.post("/{course_id}/posts")
async def create_post(course_id: int, request: CreateHubPostRequest):
    """Create a new post in a course hub (enrolled learners only)."""
    post_id = await create_post_in_db(
        course_id=course_id,
        learner_id=request.learner_id,
        title=request.title,
        body=request.body,
        post_type=request.post_type,
        module_id=request.module_id,
        image_urls=request.image_urls or [],
    )
    return {"id": post_id}


@router.get("/posts/{post_id}")
async def get_post(post_id: int):
    """Get a single post with its comments."""
    post = await get_post_by_id_from_db(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comments = await get_comments_by_post_from_db(post_id)
    return {**post, "comments": comments}


@router.post("/posts/{post_id}/comments")
async def add_comment(post_id: int, request: CreateHubCommentRequest):
    """Add a comment to a post."""
    post = await get_post_by_id_from_db(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment_id = await create_comment_in_db(
        post_id=post_id,
        learner_id=request.learner_id,
        body=request.body,
        image_urls=request.image_urls or [],
    )
    return {"id": comment_id}


@router.post("/posts/{post_id}/like")
async def toggle_post_like(post_id: int, request: ToggleLikeRequest):
    """Toggle a like on a post (like if not liked, unlike if already liked)."""
    post = await get_post_by_id_from_db(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return await toggle_post_like_in_db(post_id, request.learner_id)


@router.post("/comments/{comment_id}/like")
async def toggle_comment_like(comment_id: int, request: ToggleLikeRequest):
    """Toggle a like on a comment."""
    return await toggle_comment_like_in_db(comment_id, request.learner_id)


@router.patch("/posts/{post_id}/pin")
async def pin_post(post_id: int):
    """Mentor only — pin a post to the top of the feed."""
    post = await get_post_by_id_from_db(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await pin_post_in_db(post_id)
    return {"success": True}


@router.patch("/posts/{post_id}/highlight")
async def highlight_post(post_id: int):
    """Mentor only — mark a post as highlighted/recommended."""
    post = await get_post_by_id_from_db(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await highlight_post_in_db(post_id)
    return {"success": True}


@router.patch("/posts/{post_id}/link-module")
async def link_post_to_module(post_id: int, request: LinkModuleRequest):
    """Link a post to a specific module."""
    post = await get_post_by_id_from_db(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await link_post_to_module_in_db(post_id, request.module_id)
    return {"success": True}


@router.delete("/posts/{post_id}")
async def delete_post(post_id: int):
    """Mentor only — delete a post and all its comments, images, and likes."""
    post = await get_post_by_id_from_db(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await delete_post_in_db(post_id)
    return {"success": True}


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: int):
    """Mentor only — delete a comment and its images and likes."""
    await delete_comment_in_db(comment_id)
    return {"success": True}


@router.get("/module/{module_id}/posts")
async def get_posts_by_module(module_id: int):
    """Get all posts linked to a specific module (used in module view widget)."""
    return await get_posts_by_module_from_db(module_id)
