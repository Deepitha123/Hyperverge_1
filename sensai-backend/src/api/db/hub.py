from typing import List, Optional
from api.utils.db import get_new_db_connection
from api.config import (
    hub_posts_table_name,
    hub_post_images_table_name,
    hub_comments_table_name,
    hub_comment_images_table_name,
    hub_likes_table_name,
    users_table_name,
    milestones_table_name,
)


async def get_posts_by_course(course_id: int, sort: str = "newest") -> List[dict]:
    """Fetch all posts for a course. Pinned posts always come first."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        if sort == "top":
            order_clause = "ORDER BY p.is_pinned DESC, like_count DESC, p.created_at DESC"
        else:
            order_clause = "ORDER BY p.is_pinned DESC, p.created_at DESC"

        await cursor.execute(
            f"""
            SELECT
                p.id, p.course_id, p.learner_id, p.title, p.body, p.post_type,
                p.module_id, p.is_pinned, p.is_highlighted, p.created_at,
                u.first_name, u.last_name, u.default_dp_color,
                m.name as module_name,
                COUNT(DISTINCT l.id) as like_count,
                COUNT(DISTINCT c.id) as comment_count
            FROM {hub_posts_table_name} p
            LEFT JOIN {users_table_name} u ON p.learner_id = u.id
            LEFT JOIN {milestones_table_name} m ON p.module_id = m.id
            LEFT JOIN {hub_likes_table_name} l ON l.post_id = p.id AND l.comment_id IS NULL
            LEFT JOIN {hub_comments_table_name} c ON c.post_id = p.id AND c.deleted_at IS NULL
            WHERE p.course_id = ? AND p.deleted_at IS NULL
            GROUP BY p.id
            {order_clause}
            """,
            (course_id,),
        )
        rows = await cursor.fetchall()

        posts = []
        for row in rows:
            post_id = row[0]
            await cursor.execute(
                f"SELECT image_url FROM {hub_post_images_table_name} WHERE post_id = ?",
                (post_id,),
            )
            image_rows = await cursor.fetchall()
            images = [r[0] for r in image_rows]

            posts.append({
                "id": post_id,
                "course_id": row[1],
                "learner_id": row[2],
                "title": row[3],
                "body": row[4],
                "post_type": row[5],
                "module_id": row[6],
                "is_pinned": bool(row[7]),
                "is_highlighted": bool(row[8]),
                "created_at": str(row[9]),
                "learner_name": f"{row[10] or ''} {row[11] or ''}".strip(),
                "learner_avatar": row[12],
                "module_name": row[13],
                "like_count": row[14],
                "comment_count": row[15],
                "images": images,
            })

        return posts


async def create_post(
    course_id: int,
    learner_id: int,
    title: str,
    body: str,
    post_type: str,
    module_id: Optional[int],
    image_urls: List[str],
) -> int:
    """Insert a new post and its images. Returns the new post id."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"""
            INSERT INTO {hub_posts_table_name}
                (course_id, learner_id, title, body, post_type, module_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (course_id, learner_id, title, body, post_type, module_id),
        )
        post_id = cursor.lastrowid

        for url in image_urls:
            await cursor.execute(
                f"INSERT INTO {hub_post_images_table_name} (post_id, image_url) VALUES (?, ?)",
                (post_id, url),
            )

        await conn.commit()
        return post_id


async def get_post_by_id(post_id: int) -> Optional[dict]:
    """Fetch a single post with like count and comment count."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"""
            SELECT
                p.id, p.course_id, p.learner_id, p.title, p.body, p.post_type,
                p.module_id, p.is_pinned, p.is_highlighted, p.created_at,
                u.first_name, u.last_name, u.default_dp_color,
                m.name as module_name,
                COUNT(DISTINCT l.id) as like_count,
                COUNT(DISTINCT c.id) as comment_count
            FROM {hub_posts_table_name} p
            LEFT JOIN {users_table_name} u ON p.learner_id = u.id
            LEFT JOIN {milestones_table_name} m ON p.module_id = m.id
            LEFT JOIN {hub_likes_table_name} l ON l.post_id = p.id AND l.comment_id IS NULL
            LEFT JOIN {hub_comments_table_name} c ON c.post_id = p.id AND c.deleted_at IS NULL
            WHERE p.id = ? AND p.deleted_at IS NULL
            GROUP BY p.id
            """,
            (post_id,),
        )
        row = await cursor.fetchone()

        if not row:
            return None

        await cursor.execute(
            f"SELECT image_url FROM {hub_post_images_table_name} WHERE post_id = ?",
            (post_id,),
        )
        image_rows = await cursor.fetchall()
        images = [r[0] for r in image_rows]

        return {
            "id": row[0],
            "course_id": row[1],
            "learner_id": row[2],
            "title": row[3],
            "body": row[4],
            "post_type": row[5],
            "module_id": row[6],
            "is_pinned": bool(row[7]),
            "is_highlighted": bool(row[8]),
            "created_at": str(row[9]),
            "learner_name": f"{row[10] or ''} {row[11] or ''}".strip(),
            "learner_avatar": row[12],
            "module_name": row[13],
            "like_count": row[14],
            "comment_count": row[15],
            "images": images,
        }


async def get_comments_by_post(post_id: int) -> List[dict]:
    """Fetch all comments for a post with like counts and AI scores, ordered by score then age."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"""
            SELECT
                c.id, c.post_id, c.learner_id, c.body, c.created_at,
                u.first_name, u.last_name, u.default_dp_color,
                c.confidence_score,
                COUNT(l.id) as like_count
            FROM {hub_comments_table_name} c
            LEFT JOIN {users_table_name} u ON c.learner_id = u.id
            LEFT JOIN {hub_likes_table_name} l ON l.comment_id = c.id AND l.post_id IS NULL
            WHERE c.post_id = ? AND c.deleted_at IS NULL
            GROUP BY c.id
            ORDER BY c.confidence_score DESC, c.created_at ASC
            """,
            (post_id,),
        )
        rows = await cursor.fetchall()

        comments = []
        for row in rows:
            comment_id = row[0]
            await cursor.execute(
                f"SELECT image_url FROM {hub_comment_images_table_name} WHERE comment_id = ?",
                (comment_id,),
            )
            image_rows = await cursor.fetchall()
            images = [r[0] for r in image_rows]

            comments.append({
                "id": comment_id,
                "post_id": row[1],
                "learner_id": row[2],
                "body": row[3],
                "created_at": str(row[4]),
                "learner_name": f"{row[5] or ''} {row[6] or ''}".strip(),
                "learner_avatar": row[7],
                "confidence_score": row[8],
                "like_count": row[9],
                "images": images,
            })

        return comments


async def create_comment(
    post_id: int,
    learner_id: int,
    body: str,
    image_urls: List[str],
) -> int:
    """Insert a new comment with an AI confidence score and its images. Returns the new comment id."""
    from api.utils.hub_ai import score_hub_comment

    # Fetch post content for AI scoring
    post = await get_post_by_id(post_id)
    if not post:
        raise ValueError("Post not found")

    # Get AI confidence score
    confidence_score = await score_hub_comment(
        post_title=post["title"],
        post_body=post["body"],
        comment_body=body
    )

    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"""
            INSERT INTO {hub_comments_table_name} (post_id, learner_id, body, confidence_score)
            VALUES (?, ?, ?, ?)
            """,
            (post_id, learner_id, body, confidence_score),
        )
        comment_id = cursor.lastrowid

        for url in image_urls:
            await cursor.execute(
                f"INSERT INTO {hub_comment_images_table_name} (comment_id, image_url) VALUES (?, ?)",
                (comment_id, url),
            )

        await conn.commit()
        return comment_id


async def toggle_post_like(post_id: int, learner_id: int) -> dict:
    """Toggle a like on a post. Returns liked status and updated count."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"""SELECT id FROM {hub_likes_table_name}
                WHERE post_id = ? AND learner_id = ? AND comment_id IS NULL""",
            (post_id, learner_id),
        )
        existing = await cursor.fetchone()

        if existing:
            await cursor.execute(
                f"DELETE FROM {hub_likes_table_name} WHERE id = ?",
                (existing[0],),
            )
            liked = False
        else:
            await cursor.execute(
                f"INSERT INTO {hub_likes_table_name} (post_id, learner_id) VALUES (?, ?)",
                (post_id, learner_id),
            )
            liked = True

        await conn.commit()

        await cursor.execute(
            f"SELECT COUNT(*) FROM {hub_likes_table_name} WHERE post_id = ? AND comment_id IS NULL",
            (post_id,),
        )
        count_row = await cursor.fetchone()
        return {"liked": liked, "like_count": count_row[0]}


async def toggle_comment_like(comment_id: int, learner_id: int) -> dict:
    """Toggle a like on a comment. Returns liked status and updated count."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"""SELECT id FROM {hub_likes_table_name}
                WHERE comment_id = ? AND learner_id = ? AND post_id IS NULL""",
            (comment_id, learner_id),
        )
        existing = await cursor.fetchone()

        if existing:
            await cursor.execute(
                f"DELETE FROM {hub_likes_table_name} WHERE id = ?",
                (existing[0],),
            )
            liked = False
        else:
            await cursor.execute(
                f"INSERT INTO {hub_likes_table_name} (comment_id, learner_id) VALUES (?, ?)",
                (comment_id, learner_id),
            )
            liked = True

        await conn.commit()

        await cursor.execute(
            f"SELECT COUNT(*) FROM {hub_likes_table_name} WHERE comment_id = ? AND post_id IS NULL",
            (comment_id,),
        )
        count_row = await cursor.fetchone()
        return {"liked": liked, "like_count": count_row[0]}


async def pin_post(post_id: int) -> None:
    """Set is_pinned = true for a post."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            f"UPDATE {hub_posts_table_name} SET is_pinned = 1 WHERE id = ?",
            (post_id,),
        )
        await conn.commit()


async def highlight_post(post_id: int) -> None:
    """Set is_highlighted = true for a post."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            f"UPDATE {hub_posts_table_name} SET is_highlighted = 1 WHERE id = ?",
            (post_id,),
        )
        await conn.commit()


async def link_post_to_module(post_id: int, module_id: int) -> None:
    """Update the module_id field on a post."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            f"UPDATE {hub_posts_table_name} SET module_id = ? WHERE id = ?",
            (module_id, post_id),
        )
        await conn.commit()


async def delete_post(post_id: int) -> None:
    """Hard-delete all related images/likes/comments, then soft-delete the post."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        # Get all comment IDs for this post
        await cursor.execute(
            f"SELECT id FROM {hub_comments_table_name} WHERE post_id = ?",
            (post_id,),
        )
        comment_ids = [row[0] for row in await cursor.fetchall()]

        # Delete comment images and likes
        for cid in comment_ids:
            await cursor.execute(
                f"DELETE FROM {hub_comment_images_table_name} WHERE comment_id = ?",
                (cid,),
            )
            await cursor.execute(
                f"DELETE FROM {hub_likes_table_name} WHERE comment_id = ? AND post_id IS NULL",
                (cid,),
            )

        # Delete comments
        await cursor.execute(
            f"DELETE FROM {hub_comments_table_name} WHERE post_id = ?",
            (post_id,),
        )

        # Delete post images and likes
        await cursor.execute(
            f"DELETE FROM {hub_post_images_table_name} WHERE post_id = ?",
            (post_id,),
        )
        await cursor.execute(
            f"DELETE FROM {hub_likes_table_name} WHERE post_id = ? AND comment_id IS NULL",
            (post_id,),
        )

        # Soft-delete the post
        await cursor.execute(
            f"UPDATE {hub_posts_table_name} SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
            (post_id,),
        )

        await conn.commit()


async def delete_comment(comment_id: int) -> None:
    """Hard-delete images and likes for a comment, then soft-delete it."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"DELETE FROM {hub_comment_images_table_name} WHERE comment_id = ?",
            (comment_id,),
        )
        await cursor.execute(
            f"DELETE FROM {hub_likes_table_name} WHERE comment_id = ? AND post_id IS NULL",
            (comment_id,),
        )
        await cursor.execute(
            f"UPDATE {hub_comments_table_name} SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
            (comment_id,),
        )

        await conn.commit()


async def get_posts_by_module(module_id: int) -> List[dict]:
    """Fetch all posts linked to a specific module (used in module view widget)."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            f"""
            SELECT
                p.id, p.title, p.post_type, p.created_at,
                COUNT(DISTINCT c.id) as comment_count
            FROM {hub_posts_table_name} p
            LEFT JOIN {hub_comments_table_name} c ON c.post_id = p.id AND c.deleted_at IS NULL
            WHERE p.module_id = ? AND p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY p.created_at DESC
            """,
            (module_id,),
        )
        rows = await cursor.fetchall()

        return [
            {
                "id": row[0],
                "title": row[1],
                "post_type": row[2],
                "created_at": str(row[3]),
                "comment_count": row[4],
            }
            for row in rows
        ]
