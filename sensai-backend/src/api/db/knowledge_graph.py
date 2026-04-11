"""
Database operations for the Knowledge Graph (concepts, mastery, relations).
This powers the Neural Knowledge Map visualization in the frontend.
"""
import json
import re
from typing import List, Optional, Dict
from api.utils.db import get_new_db_connection, execute_db_operation


async def init_knowledge_graph_tables():
    """Create the knowledge graph tables if they don't exist."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        # Table 1: concepts — The nodes of the graph
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS concepts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME
            )
        """)
        await cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_concept_slug ON concepts (slug)"
        )

        # Table 2: user_knowledge — Per-user mastery tracking
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                concept_id INTEGER NOT NULL,
                mastery_level FLOAT DEFAULT 0.0,
                last_revisited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME,
                UNIQUE(user_id, concept_id),
                FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE
            )
        """)
        await cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_knowledge_user_id ON user_knowledge (user_id)"
        )

        # Table 3: concept_relations — The edges of the graph
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS concept_relations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_concept_id INTEGER NOT NULL,
                target_concept_id INTEGER NOT NULL,
                relation_type TEXT NOT NULL DEFAULT 'related_to',
                strength FLOAT DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(source_concept_id, target_concept_id, relation_type),
                FOREIGN KEY (source_concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
                FOREIGN KEY (target_concept_id) REFERENCES concepts(id) ON DELETE CASCADE
            )
        """)
        await cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_concept_relation_source ON concept_relations (source_concept_id)"
        )
        await cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_concept_relation_target ON concept_relations (target_concept_id)"
        )

        # Table 4: knowledge_concept_links — Links personal_knowledge entries to concepts
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_concept_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                concept_id INTEGER NOT NULL,
                knowledge_id INTEGER NOT NULL,
                context_snippet TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
                FOREIGN KEY (knowledge_id) REFERENCES personal_knowledge(id) ON DELETE CASCADE
            )
        """)
        await cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_kcl_concept_id ON knowledge_concept_links (concept_id)"
        )
        await cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_kcl_knowledge_id ON knowledge_concept_links (knowledge_id)"
        )

        await conn.commit()


def _make_slug(name: str) -> str:
    """Convert a concept name into a URL-friendly slug."""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug[:80]


async def upsert_concept(name: str, slug: str = None, description: str = None) -> int:
    """Insert a concept or return the existing one's ID if slug matches."""
    if not slug:
        slug = _make_slug(name)

    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        # Check if concept exists
        await cursor.execute("SELECT id FROM concepts WHERE slug = ? AND deleted_at IS NULL", (slug,))
        existing = await cursor.fetchone()

        if existing:
            # Update description if provided
            if description:
                await cursor.execute(
                    "UPDATE concepts SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (description, existing[0])
                )
                await conn.commit()
            return existing[0]

        # Insert new concept
        await cursor.execute(
            "INSERT INTO concepts (name, slug, description) VALUES (?, ?, ?)",
            (name, slug, description)
        )
        concept_id = cursor.lastrowid
        await conn.commit()
        return concept_id


async def get_concept_by_slug(slug: str) -> Optional[Dict]:
    """Get a concept by its slug."""
    row = await execute_db_operation(
        "SELECT id, name, slug, description FROM concepts WHERE slug = ? AND deleted_at IS NULL",
        (slug,),
        fetch_one=True
    )
    if not row:
        return None
    return {"id": row[0], "name": row[1], "slug": row[2], "description": row[3]}


async def update_user_knowledge(user_id: int, concept_id: int, mastery_delta: float = 0.1):
    """Update or create user mastery for a concept. Additive, capped at 1.0."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()

        await cursor.execute(
            "SELECT id, mastery_level FROM user_knowledge WHERE user_id = ? AND concept_id = ? AND deleted_at IS NULL",
            (user_id, concept_id)
        )
        existing = await cursor.fetchone()

        if existing:
            new_mastery = min(1.0, existing[1] + mastery_delta)
            await cursor.execute(
                "UPDATE user_knowledge SET mastery_level = ?, last_revisited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_mastery, existing[0])
            )
        else:
            await cursor.execute(
                "INSERT INTO user_knowledge (user_id, concept_id, mastery_level) VALUES (?, ?, ?)",
                (user_id, concept_id, min(1.0, mastery_delta))
            )

        await conn.commit()


async def upsert_concept_relation(source_id: int, target_id: int, relation_type: str = "related_to"):
    """Create a relation between two concepts if it doesn't exist."""
    if source_id == target_id:
        return

    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            """INSERT OR IGNORE INTO concept_relations (source_concept_id, target_concept_id, relation_type)
               VALUES (?, ?, ?)""",
            (source_id, target_id, relation_type)
        )
        await conn.commit()


async def create_knowledge_concept_link(concept_id: int, knowledge_id: int, context_snippet: str = None):
    """Link a concept to a personal_knowledge entry."""
    async with get_new_db_connection() as conn:
        cursor = await conn.cursor()
        await cursor.execute(
            "INSERT INTO knowledge_concept_links (concept_id, knowledge_id, context_snippet) VALUES (?, ?, ?)",
            (concept_id, knowledge_id, context_snippet)
        )
        await conn.commit()


async def get_user_knowledge_graph(user_id: int) -> Dict:
    """
    Fetch the full knowledge graph for a user:
    - Nodes: concepts the user has encountered, with mastery levels
    - Edges: relations between those concepts
    """
    # Fetch nodes
    nodes = await execute_db_operation(
        """
        SELECT DISTINCT c.id, c.name, c.slug, c.description, uk.mastery_level
        FROM concepts c
        INNER JOIN user_knowledge uk ON c.id = uk.concept_id
        WHERE uk.user_id = ? AND c.deleted_at IS NULL AND uk.deleted_at IS NULL
        """,
        (user_id,),
        fetch_all=True
    )

    if not nodes:
        return {"nodes": [], "edges": []}

    node_ids = [n[0] for n in nodes]

    # Fetch edges between these nodes only
    placeholders = ",".join(["?"] * len(node_ids))
    edges = await execute_db_operation(
        f"""
        SELECT source_concept_id, target_concept_id, relation_type, strength
        FROM concept_relations
        WHERE source_concept_id IN ({placeholders})
          AND target_concept_id IN ({placeholders})
        """,
        node_ids + node_ids,
        fetch_all=True
    )

    return {
        "nodes": [
            {
                "id": n[0],
                "name": n[1],
                "slug": n[2],
                "description": n[3],
                "mastery": n[4]
            }
            for n in nodes
        ],
        "edges": [
            {"source": e[0], "target": e[1], "type": e[2], "strength": e[3]}
            for e in (edges or [])
        ]
    }


async def get_concept_evidence(concept_id: int, user_id: int) -> List[Dict]:
    """Get the personal knowledge entries linked to a concept for a user."""
    rows = await execute_db_operation(
        """
        SELECT pk.id, pk.title, pk.content, pk.tags, pk.created_at
        FROM personal_knowledge pk
        INNER JOIN knowledge_concept_links kcl ON pk.id = kcl.knowledge_id
        WHERE kcl.concept_id = ? AND pk.learner_id = ?
        ORDER BY pk.created_at DESC
        """,
        (concept_id, user_id),
        fetch_all=True
    )

    return [
        {
            "id": row[0],
            "title": row[1],
            "content": row[2],
            "tags": json.loads(row[3]) if row[3] else [],
            "created_at": str(row[4])
        }
        for row in (rows or [])
    ]


async def get_unlinked_knowledge_entries(user_id: int) -> List[Dict]:
    """Fetch personal knowledge entries for a user that haven't been processed into graph concepts yet."""
    rows = await execute_db_operation(
        """
        SELECT pk.id, pk.title, pk.content, pk.tags, pk.source_chat_history
        FROM personal_knowledge pk
        LEFT JOIN knowledge_concept_links kcl ON pk.id = kcl.knowledge_id
        WHERE pk.learner_id = ? AND kcl.id IS NULL
        ORDER BY pk.created_at ASC
        """,
        (user_id,),
        fetch_all=True
    )
    
    return [
        {
            "id": row[0],
            "title": row[1],
            "content": row[2],
            "tags": json.loads(row[3]) if row[3] else [],
            "chat_history": json.loads(row[4]) if row[4] else None
        }
        for row in (rows or [])
    ]
