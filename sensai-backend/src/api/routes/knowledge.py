from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from api.db.knowledge import save_personal_knowledge, get_learner_knowledge, delete_knowledge
from api.db.knowledge_graph import (
    init_knowledge_graph_tables,
    get_user_knowledge_graph,
    get_concept_evidence,
)
from api.db.chat import get_task_chat_history_for_user
from api.utils.knowledge_ai import summarize_chat_to_knowledge
from api.utils.knowledge_graph_ai import extract_concepts_from_chat
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ConvertChatRequest(BaseModel):
    learner_id: int
    course_id: Optional[int] = None
    module_id: Optional[int] = None
    task_id: Optional[int] = None  # To fetch specific chat history if history not provided
    chat_history: Optional[List[dict]] = None

@router.post("/convert")
async def convert_chat_to_knowledge(request: ConvertChatRequest, background_tasks: BackgroundTasks):
    """
    Endpoint to trigger the conversion of a chat session into a structured knowledge entry.
    Also triggers background extraction of concepts for the knowledge graph.
    """
    try:
        # Ensure knowledge graph tables exist
        await init_knowledge_graph_tables()

        # Use provided chat history or fetch it for this user and task
        chat_history = request.chat_history
        
        if not chat_history:
            if not request.task_id:
                raise HTTPException(status_code=400, detail="task_id or chat_history is required")
                
            chat_history = await get_task_chat_history_for_user(request.task_id, request.learner_id)
        
        if not chat_history:
            raise HTTPException(status_code=404, detail="No chat history found to convert")
            
        # Summarize using AI
        knowledge_entry = await summarize_chat_to_knowledge(chat_history)
        
        # Format the content into a beautiful note
        takeaways_formatted = "".join([f"- {item}\n" for item in knowledge_entry.takeaways])
        mistakes_formatted = "".join([f"- {item}\n" for item in knowledge_entry.mistakes_to_avoid])
        
        formatted_content = f"""## Summary
{knowledge_entry.explanation}

### Key Takeaways
{takeaways_formatted}
### Pitfalls & Mistakes to Avoid
{mistakes_formatted}"""

        # Save to DB
        knowledge_id = await save_personal_knowledge(
            learner_id=request.learner_id,
            title=knowledge_entry.title,
            content=formatted_content.strip(),
            tags=knowledge_entry.tags,
            course_id=request.course_id,
            module_id=request.module_id,
            source_chat_history=chat_history
        )

        # Fire-and-forget: extract concepts for the knowledge graph in background
        background_tasks.add_task(
            extract_concepts_from_chat,
            chat_history=chat_history,
            user_id=request.learner_id,
            knowledge_id=knowledge_id,
        )
        
        return {
            "success": True,
            "knowledge_id": knowledge_id,
            "title": knowledge_entry.title,
            "message": "Chat converted to personal knowledge successfully!"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error converting chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Knowledge Graph Endpoints ──────────────────────────────────────────────────

@router.get("/graph")
async def get_knowledge_graph(user_id: int):
    """Fetch the full knowledge graph for a user (nodes + edges)."""
    try:
        await init_knowledge_graph_tables()
        graph = await get_user_knowledge_graph(user_id)
        return graph
    except Exception as e:
        logger.error(f"Error fetching knowledge graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/rebuild")
async def rebuild_knowledge_graph(user_id: int):
    """Process any unlinked knowledge entries to generate graph concepts."""
    try:
        from api.utils.knowledge_graph_ai import backfill_user_knowledge_graph
        await init_knowledge_graph_tables()
        concepts_extracted = await backfill_user_knowledge_graph(user_id)
        return {"success": True, "concepts_extracted": concepts_extracted}
    except Exception as e:
        logger.error(f"Error rebuilding knowledge graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/concepts/{concept_id}/evidence")
async def get_evidence_for_concept(concept_id: int, user_id: int):
    """Fetch the personal knowledge entries linked to a concept for a user."""
    try:
        evidence = await get_concept_evidence(concept_id, user_id)
        return evidence
    except Exception as e:
        logger.error(f"Error fetching concept evidence: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Existing Knowledge CRUD ────────────────────────────────────────────────────

@router.get("/{learner_id}")
async def get_my_knowledge(learner_id: int):
    """Fetch all knowledge entries for the user."""
    return await get_learner_knowledge(learner_id)

@router.delete("/{learner_id}/{knowledge_id}")
async def remove_knowledge(learner_id: int, knowledge_id: int):
    """Delete a knowledge entry."""
    success = await delete_knowledge(knowledge_id, learner_id)
    if not success:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    return {"success": True}
