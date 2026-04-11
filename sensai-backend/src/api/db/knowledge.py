import json
from typing import List, Optional
from api.utils.db import get_new_db_connection

async def save_personal_knowledge(
    learner_id: int,
    title: str,
    content: str,
    tags: List[str],
    course_id: Optional[int] = None,
    module_id: Optional[int] = None,
    source_chat_history: Optional[List[dict]] = None
) -> int:
    """Saves a new knowledge entry to the database."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            """
            INSERT INTO personal_knowledge (
                learner_id, course_id, module_id, title, content, tags, source_chat_history
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                learner_id,
                course_id,
                module_id,
                title,
                content,
                json.dumps(tags),
                json.dumps(source_chat_history) if source_chat_history else None
            ),
        )
        knowledge_id = cursor.lastrowid
        await conn.commit()
        return knowledge_id

async def get_learner_knowledge(learner_id: int) -> List[dict]:
    """Retrieves all knowledge entries for a specific learner."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            """
            SELECT id, course_id, module_id, title, content, tags, created_at
            FROM personal_knowledge
            WHERE learner_id = ?
            ORDER BY created_at DESC
            """,
            (learner_id,),
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": row[0],
                "course_id": row[1],
                "module_id": row[2],
                "title": row[3],
                "content": row[4],
                "tags": json.loads(row[5]) if row[5] else [],
                "created_at": str(row[6])
            }
            for row in rows
        ]

async def get_knowledge_by_id(knowledge_id: int) -> Optional[dict]:
    """Retrieves a single knowledge entry by ID."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            """
            SELECT id, learner_id, course_id, module_id, title, content, tags, created_at
            FROM personal_knowledge
            WHERE id = ?
            """,
            (knowledge_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "learner_id": row[1],
            "course_id": row[2],
            "module_id": row[3],
            "title": row[4],
            "content": row[5],
            "tags": json.loads(row[6]) if row[6] else [],
            "created_at": str(row[7])
        }

async def delete_knowledge(knowledge_id: int, learner_id: int) -> bool:
    """Deletes a knowledge entry."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            "DELETE FROM personal_knowledge WHERE id = ? AND learner_id = ?",
            (knowledge_id, learner_id),
        )
        deleted = cursor.rowcount > 0
        await conn.commit()
        return deleted


async def migrate_existing_knowledge_to_chroma() -> dict:
    """
    Backfill all existing knowledge entries to Chroma DB.
    This is a one-time migration for entries created before Chroma integration.
    Returns stats on how many were migrated.
    """
    from api.utils.chroma_db import add_knowledge_to_chroma
    from api.utils.logging import logger
    
    stats = {
        "total_migrated": 0,
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    try:
        async with get_new_db_connection() as conn:
            cursor = await conn.cursor()
            
            # Get all knowledge entries
            await cursor.execute(
                """
                SELECT id, learner_id, course_id, module_id, title, content, tags
                FROM personal_knowledge
                ORDER BY learner_id, id
                """
            )
            rows = await cursor.fetchall()
            stats["total_migrated"] = len(rows)
            
            logger.info(f"Starting migration of {len(rows)} knowledge entries to Chroma DB")
            
            for row in rows:
                knowledge_id, learner_id, course_id, module_id, title, content, tags_json = row
                try:
                    tags = json.loads(tags_json) if tags_json else []
                    
                    success = await add_knowledge_to_chroma(
                        learner_id=learner_id,
                        knowledge_id=knowledge_id,
                        title=title,
                        content=content,
                        tags=tags,
                        course_id=course_id,
                        module_id=module_id,
                    )
                    
                    if success:
                        stats["success"] += 1
                    else:
                        stats["failed"] += 1
                        stats["errors"].append(f"Knowledge ID {knowledge_id}: Failed to add to Chroma")
                        
                except Exception as e:
                    stats["failed"] += 1
                    error_msg = f"Knowledge ID {knowledge_id}: {str(e)}"
                    stats["errors"].append(error_msg)
                    logger.error(error_msg)
            
            logger.info(f"Migration complete - Success: {stats['success']}, Failed: {stats['failed']}")
            
    except Exception as e:
        logger.error(f"Error during knowledge migration: {e}")
        stats["errors"].append(f"Migration failed: {str(e)}")
    
    return stats
