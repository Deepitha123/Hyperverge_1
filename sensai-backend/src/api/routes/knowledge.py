from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from api.db.knowledge import save_personal_knowledge, get_learner_knowledge, delete_knowledge
from api.db.chat import get_task_chat_history_for_user
from api.utils.knowledge_ai import summarize_chat_to_knowledge

router = APIRouter()

class ConvertChatRequest(BaseModel):
    learner_id: int
    course_id: Optional[int] = None
    module_id: Optional[int] = None
    task_id: Optional[int] = None # To fetch specific chat history

@router.post("/convert")
async def convert_chat_to_knowledge(request: ConvertChatRequest):
    """
    Endpoint to trigger the conversion of a chat session into a structured knowledge entry.
    """
    try:
        # Fetch chat history for this user and task
        # Note: In our current implementation, get_chat_history_from_db usually takes task_id and learner_id
        if not request.task_id:
            raise HTTPException(status_code=400, detail="task_id is required to find chat history")
            
        chat_history = await get_task_chat_history_for_user(request.task_id, request.learner_id)
        
        if not chat_history:
            raise HTTPException(status_code=404, detail="No chat history found to convert")
            
        # Summarize using AI
        knowledge_entry = await summarize_chat_to_knowledge(chat_history)
        
        # Format the content into a beautiful note
        formatted_content = f"""
## Summary
{knowledge_entry.explanation}

### Key Takeaways
{"".join([f"- {item}\n" for item in knowledge_entry.takeaways])}

### Pitfalls & Mistakes to Avoid
{"".join([f"- {item}\n" for item in knowledge_entry.mistakes_to_avoid])}
        """

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
        
        return {
            "success": True,
            "knowledge_id": knowledge_id,
            "title": knowledge_entry.title,
            "message": "Chat converted to personal knowledge successfully!"
        }
    except Exception as e:
        print(f"Error converting chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
